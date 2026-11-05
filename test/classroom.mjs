// Simulated classrooms: 17 groups with plausible, partly adaptive student behaviours. Compares two farmer rules:
//   local  - farmers only buy hybrids with data from their own region (current game)
//   extrap - farmers without local data go by the hybrid's overall published average (like a seed-bag claim)
import * as T from "../trial.js";

const MODE = process.argv[2] || "local", XPEN = +(process.argv[3] || 0), GPEAK = +(process.argv[4] || 10), OLDV = +(process.argv[5] || 8);
const rate = (m, n) => T.rating(m, n);
function scoreRound(gid, snap, r, trust) {
  const offers = [];
  for (const [g, v] of Object.entries(snap.release[r])) {
    const cat = T.catalog(gid, g), ys = T.REGIONS.map(() => []);
    for (let k = 1; k <= r; k++) T.trialResults(gid, g, k, snap.plots[k][g])[v.h].forEach((c, ri) => ys[ri].push(...c.ys));
    const all = ys.flat();
    offers.push({ g, h: v.h, ys, all, truth: T.REGIONS.map((R) => T.trueYield(cat[v.h], R)) });
  }
  const rev = {}, events = [];
  offers.forEach((o) => (rev[o.g] = 0));
  T.REGIONS.forEach((R, ri) => {
    const cand = offers.map((o) => {
      let m, n, local = true;
      if (o.ys[ri].length) { m = o.ys[ri].reduce((a, b) => a + b, 0) / o.ys[ri].length; n = o.ys[ri].length; }
      else if (MODE === "extrap" && o.all.length) { m = o.all.reduce((a, b) => a + b, 0) / o.all.length; n = o.all.length; local = false; }
      else return null;
      return { o, m, n, local, w: Math.max(0.01, rate(m, n) - (local ? 0 : XPEN)) ** T.POWER };
    }).filter(Boolean);
    const den = cand.reduce((a, c) => a + c.w, 0) + OLDV ** T.POWER;
    cand.forEach((c) => { const s = c.w / den;
      if (s > 0.02 && c.m - c.o.truth[ri] > T.OVERPROMISE) { events.push({ g: c.o.g, kind: c.local ? "noise" : "GxE", farmers: R.farmers * s }); }
      else rev[c.o.g] += R.farmers * s; });   // refund rule: overpromised regions pay nothing
  });
  return { rev, events };
}
const L = (a) => a.join("");
// behaviours. view = what a group can see: its own trial history, last round's revenue table and who sold where.
const TYPES = {
  luckyPicker: { plant(v) { const a = Array(24).fill(0); for (let k = 0; k < 12; k++) a[Math.floor(v.rnd() * 24)]++; return a; },
                 pick: "maxPlot" },
  bigMarket:   { plant(v) { const a = Array(24).fill(0); for (let h = 0; h < 6; h++) a[h * 4 + 3] += 2; return a; }, pick: "rating" },
  careful:     { plant(v) { const a = Array(24).fill(0);
                   if (v.r === 1) { for (let h = 0; h < 6; h++) { a[h * 4 + v.home] ++; a[h * 4 + v.home2]++; } }
                   else { a[v.best(v.home) * 4 + v.home] += 6; a[v.best(v.home2) * 4 + v.home2] += 6; } return a; }, pick: "rating" },
  generalistSeeker: { plant(v) { const a = Array(24).fill(0);   // round 1: all 6 in two contrasting regions; then the best-average one, 3 plots in every region
                   if (v.r === 1) { for (let h = 0; h < 6; h++) { a[h * 4 + 0]++; a[h * 4 + 3]++; } }
                   else { const b = v.bestAvg(); for (let ri = 0; ri < 4; ri++) a[b * 4 + ri] += 3; } return a; }, pick: "avg" },
  narrowThenBroad: { plant(v) { const a = Array(24).fill(0); for (let h = 0; h < 6; h++) a[h * 4 + v.home] += 2; return a; }, pick: "rating" },  // tests one region, sells anywhere
  copycat:     { plant(v) { const ri = v.r === 1 ? v.home : v.leaderRegion; const a = Array(24).fill(0);
                   if (v.r === 1) for (let h = 0; h < 6; h++) a[h * 4 + ri] += 2; else a[v.best(ri) * 4 + ri] += 12; return a; }, pick: "rating" },
};
const typeNames = Object.keys(TYPES);
function classroom(seed) {
  const gid = "cls" + seed, rnd = T.rng(gid), snap = { plots: {}, release: {} }, trust = {}, total = {}, kind = {}, home = {};
  for (let g = 1; g <= 17; g++) { kind[g] = typeNames[Math.floor(rnd() * typeNames.length)]; trust[g] = 1; total[g] = 0; home[g] = Math.floor(rnd() * 4); }
  let lastLeaderRegion = 3; const log = [];
  for (let r = 1; r <= 3; r++) {
    snap.plots[r] = {}; snap.release[r] = {};
    for (let g = 1; g <= 17; g++) {
      const hist = (h, ri) => { const ys = []; for (let k = 1; k < r; k++) T.trialResults(gid, g, k, snap.plots[k][g])[h][ri].ys.forEach((y) => ys.push(y)); return ys; };
      const best = (ri) => [0,1,2,3,4,5].sort((a, b) => { const A = hist(a, ri), B = hist(b, ri); return (B.length ? B.reduce((x, y) => x + y) / B.length : -1) - (A.length ? A.reduce((x, y) => x + y) / A.length : -1); })[0];
      const bestAvg = () => [0,1,2,3,4,5].sort((a, b) => { const A = [0,1,2,3].flatMap((ri) => hist(a, ri)), B = [0,1,2,3].flatMap((ri) => hist(b, ri)); return (B.length ? Math.min(...[0,3].map((ri)=>{const y=hist(b,ri);return y.length?y.reduce((x,z)=>x+z)/y.length:-1;})) : -1) - (A.length ? Math.min(...[0,3].map((ri)=>{const y=hist(a,ri);return y.length?y.reduce((x,z)=>x+z)/y.length:-1;})) : -1); })[0];
      const v = { r, rnd, bestAvg, home: home[g], home2: (home[g] + 1 + g % 3) % 4, best, leaderRegion: lastLeaderRegion };
      let a = TYPES[kind[g]].plant(v); const tot = a.reduce((x, y) => x + y, 0); if (tot > 12) a = a.map((x) => Math.min(x, 9));
      snap.plots[r][g] = L(a);
      const res = T.trialResults(gid, g, r, L(a)), pool = (h) => { const ys = T.REGIONS.map((_, ri) => [...hist(h, ri), ...res[h][ri].ys]); return ys; };
      const p = TYPES[kind[g]].pick;
      const val = (h) => { const ys = pool(h);
        if (p === "maxPlot") return Math.max(-1, ...ys.flat());
        if (p === "avg") { const f = ys.flat(); return f.length ? f.reduce((x, y) => x + y) / f.length : -1; }
        return Math.max(-9, ...ys.map((y) => (y.length ? rate(y.reduce((x, z) => x + z) / y.length, y.length) : -9))); };
      snap.release[r][g] = { h: [0,1,2,3,4,5].sort((x, y) => val(y) - val(x))[0] };
    }
    const { rev, events } = scoreRound(gid, snap, r, trust);
    Object.entries(rev).forEach(([g, x]) => (total[g] += x));

    log.push({ r, events });
    lastLeaderRegion = 3;
  }
  const ranking = Object.keys(total).sort((a, b) => total[b] - total[a]);
  return { kind, total, ranking, log };
}
T.setGPeak(GPEAK);
const N = 300, winsBy = {}, meanBy = {}, cnt = {}, ev = { noise: 0, GxE: 0 }, classesWithAha = { any: 0, GxE: 0 };
let spread = 0, winnerTypes = new Set();
for (let s = 0; s < N; s++) {
  const c = classroom(s);
  winsBy[c.kind[c.ranking[0]]] = (winsBy[c.kind[c.ranking[0]]] || 0) + 1;
  Object.entries(c.total).forEach(([g, t]) => { meanBy[c.kind[g]] = (meanBy[c.kind[g]] || 0) + t; cnt[c.kind[g]] = (cnt[c.kind[g]] || 0) + 1; });
  const all = c.log.flatMap((l) => l.events); all.forEach((e) => ev[e.kind]++);
  if (all.length) classesWithAha.any++; if (all.some((e) => e.kind === "GxE")) classesWithAha.GxE++;
  const t = Object.values(c.total).sort((a, b) => b - a); spread += (t[0] - t[16]);
}
console.log(`farmer rule: ${MODE} xpen ${XPEN} generalist peak ${GPEAK} old ${OLDV}`);
for (const k of typeNames) console.log(`  ${k.padEnd(17)} mean $${(meanBy[k] / cnt[k]).toFixed(1)}M   won ${(100 * (winsBy[k] || 0) / N).toFixed(0)}% of classes`);
console.log(`  burn events per class: noise ${(ev.noise / N).toFixed(1)}, GxE ${(ev.GxE / N).toFixed(1)};  classes with any burn ${(100 * classesWithAha.any / N).toFixed(0)}%, with a GxE burn ${(100 * classesWithAha.GxE / N).toFixed(0)}%`);
console.log(`  mean gap first-last: $${(spread / N).toFixed(1)}M`);
