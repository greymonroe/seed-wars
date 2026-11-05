// Trial & Release: the model (pure functions; phone, screen and node tests share it). A simulation, not real data.
//
// Four farm regions differ in heat and water. Each company owns a catalog of 6 hybrids with hidden
// true performance: 2 generalists (decent everywhere) and 4 specialists (great in one kind of place).
// Each round a company plants 12 trial plots (any hybrid, any region), gets noisy plot yields back,
// releases one hybrid, and its trial data is published. Farmers in each region choose among released
// hybrids by their PUBLISHED mean yield for that region. Then the true yield comes in: where it falls more than
// OVERPROMISE t/ha short of what was published, those farmers get refunds (the company loses that region's sales).

export const REGIONS = [
  { key: "CW", name: "Cool & wet", icon: "❄️💧", T: 22, W: 0.8, farmers: 20 },
  { key: "CD", name: "Cool & dry", icon: "❄️🌵", T: 22, W: 0.2, farmers: 15 },
  { key: "HW", name: "Hot & wet",  icon: "☀️💧", T: 33, W: 0.8, farmers: 20 },
  { key: "HD", name: "Hot & dry",  icon: "☀️🌵", T: 33, W: 0.2, farmers: 25 },
];
export let GPEAK = 10.0; export const setGPeak = (v) => (GPEAK = v);
export const NHYB = 6, PLOTS = 12, ROUNDS = 3, NOISE = 1.5, POWER = 8, OVERPROMISE = 2.0, CAUTION = 2.0, OLD = 8.0;   // OLD: farmers' current seed, rated 8 t/ha everywhere
// what farmers go by: the published mean minus its uncertainty (one plot can lie; six plots rarely do)
export const rating = (mean, n) => mean - CAUTION * NOISE / Math.sqrt(n);
export const MONEY = 1;   // $M per farmer
export const COLORS = ["#e6194b","#3cb44b","#4363d8","#f58231","#911eb4","#00a6c8","#f032e6","#9a6324",
  "#469990","#800000","#808000","#000075","#ff6f91","#2f4f4f","#c79b00","#5b8c00","#7b68ee","#d2691e","#20b2aa","#8b008b"];

export function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// a company's catalog: 2 generalists + one specialist for each region, shuffled, with random tweaks
export function catalog(gid, g) {
  const r = rng(`${gid}:cat:${g}`);
  const arche = [
    { kind: "G", T: 27.5, W: 0.5, sT: 6, sW: 0.7, peak: GPEAK },
    { kind: "G", T: 27.5, W: 0.5, sT: 6, sW: 0.7, peak: GPEAK },
    ...REGIONS.map((R) => ({ kind: "S" + R.key, T: R.T, W: R.W, sT: 3.2, sW: 0.32, peak: 12.5 })),
  ];
  const hy = arche.map((a, i) => ({
    T: a.T + gauss(r) * 1.0, W: Math.min(0.95, Math.max(0.05, a.W + gauss(r) * 0.06)),
    sT: a.sT, sW: a.sW, peak: a.peak + gauss(r) * 0.6, kind: a.kind,
  }));
  for (let i = hy.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [hy[i], hy[j]] = [hy[j], hy[i]]; }
  const letters = "ABCDEFGHJKLMNPRSTUVWXZ";
  return hy.map((h, i) => ({ ...h, id: i, code: `${letters[g % letters.length]}${g}-${100 + i * 7 + Math.floor(r() * 7)}` }));
}

export const FLOOR = 2.5;   // even a badly matched hybrid makes some grain
export const trueYield = (h, R) => FLOOR + (h.peak - FLOOR) * Math.exp(-((R.T - h.T) ** 2) / (2 * h.sT ** 2) - ((R.W - h.W) ** 2) / (2 * h.sW ** 2));

// one plot's measured yield (deterministic per game/company/round/hybrid/region/plot)
export function plotYield(gid, g, r, h, ri, k, hyb) {
  const R = REGIONS[ri], rr = rng(`${gid}:plot:${g}:${r}:${h}:${ri}:${k}`);
  return Math.max(0, trueYield(hyb, R) + gauss(rr) * NOISE);
}

// alloc: string of NHYB*4 digits, plots per (hybrid, region), row-major by hybrid
export const allocGet = (a, h, ri) => +a[h * 4 + ri];
export function trialResults(gid, g, r, alloc) {
  const cat = catalog(gid, g), out = [];
  for (let h = 0; h < NHYB; h++) {
    const row = [];
    for (let ri = 0; ri < 4; ri++) {
      const n = allocGet(alloc, h, ri), ys = Array.from({ length: n }, (_, k) => plotYield(gid, g, r, h, ri, k, cat[h]));
      row.push({ n, ys, mean: n ? ys.reduce((a, b) => a + b, 0) / n : null });
    }
    out.push(row);
  }
  return out;
}

// Score the whole game from the database snapshot of trials/<gid>.
export function standings(gid, snap) {
  const st = snap.state || { phase: "lobby", round: 0 }, teams = snap.teams || {};
  const total = {}, rounds = {};
  Object.entries(teams).forEach(([g, t]) => { if (t) total[g] = 0; });
  for (let r = 1; r <= ROUNDS; r++) {
    const done = r < st.round || (r === st.round && ["market", "truth", "over"].includes(st.phase));
    if (!done) break;
    const rel = snap.release?.[r] || {}, plots = snap.plots?.[r] || {};
    const offers = [];
    for (const [g, v] of Object.entries(rel)) {
      if (!v || !plots[g] || v.h == null) continue;
      const cat = catalog(gid, g), ys = REGIONS.map(() => []);
      for (let k = 1; k <= r; k++) { const p = snap.plots?.[k]?.[g]; if (p) trialResults(gid, g, k, p.alloc)[v.h].forEach((c, ri) => ys[ri].push(...c.ys)); }
      offers.push({ g, h: v.h, name: v.name, code: cat[v.h].code,
        pub: ys.map((a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)), n: ys.map((a) => a.length),
        truth: REGIONS.map((R) => trueYield(cat[v.h], R)), });
    }
    const regions = REGIONS.map((R, ri) => {
      const cand = offers.filter((o) => o.pub[ri] != null);
      const w = cand.map((o) => Math.max(0.01, rating(o.pub[ri], o.n[ri])) ** POWER), den = w.reduce((a, b) => a + b, 0) + OLD ** POWER;
      const shares = {};
      cand.forEach((o, i) => (shares[o.g] = den ? w[i] / den : 0));
      return { R, cand, shares };
    });
    const revenue = {}, promise = {};
    offers.forEach((o) => { revenue[o.g] = 0; promise[o.g] = []; });
    regions.forEach(({ R, shares }, ri) => Object.entries(shares).forEach(([g, s]) => {
      revenue[g] += R.farmers * s * MONEY;
      const o = offers.find((x) => x.g === g);
      if (s > 0.02) promise[g].push({ ri, pub: o.pub[ri], truth: o.truth[ri], over: o.pub[ri] - o.truth[ri] > OVERPROMISE });
    }));
    const showTruth = r < st.round || (r === st.round && st.phase !== "market");
    const sales = { ...revenue }, refund = {};
    offers.forEach((o) => (refund[o.g] = 0));
    if (showTruth) offers.forEach((o) => promise[o.g].forEach((p) => {
      if (p.over) { const lost = REGIONS[p.ri].farmers * regions[p.ri].shares[o.g] * MONEY; refund[o.g] += lost; revenue[o.g] -= lost; }
    }));
    Object.entries(revenue).forEach(([g, v]) => (total[g] = (total[g] || 0) + v));
    rounds[r] = { offers, regions, revenue, sales, refund, promise, showTruth };
  }
  return { state: st, teams, rounds, total };
}
