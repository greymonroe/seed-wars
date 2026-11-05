// Seed Wars: the game model (pure functions, shared by phone, screen and the node tests).
//
// A teaching simulation for PLS 152 (climate adaptation). Each group is a seed company.
// Plants are inbred lines described by a genome string of 18 genes:
//   H0..H9  heat genes   allele 1 = heat-adapted. Climate optimum = 21 + 1.2 x (# heat alleles), 21-33 C
//   Y0..Y7  yield genes  allele 1 = high yield.  Yield potential = 6 + 0.75 x (# yield alleles), 6-12 t/ha
// A cross gives offspring that take each gene from one parent or the other at random
// (independent assortment, offspring made homozygous, like doubled haploids).
// Every company starts with two elite lines: high yield, adapted to today's middle climate,
// and nearly identical at the heat genes, so they can't breed for heat on their own.
// The gene bank offers landraces from hot, dry places: heat-adapted, low yield.
// Farm counties run cool to hot and warm 1 C every round. Farmers in each county buy
// seed in proportion to yield^POWER among every variety on the market (all releases so far)
// plus an old public variety that fits the original climate.

export const NH = 10, NY = 8, NG = NH + NY;
export const COUNTIES = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];  // summer high at the start (C)
export const FARMERS  = [3, 4, 6, 8, 10, 11, 11, 10, 8, 6, 4, 3];         // 84 farmers
export const WARMING = 1.0, ROUNDS = 5, POWER = 6, WIDTH = 1.8, OFFSPRING = 6;
export const MONEY = 1;   // $M seed sales per farmer per season
export const COLORS = ["#e6194b","#3cb44b","#4363d8","#f58231","#911eb4","#00a6c8","#f032e6","#9a6324",
  "#469990","#800000","#808000","#000075","#ff6f91","#2f4f4f","#c79b00","#5b8c00","#7b68ee","#d2691e","#20b2aa","#8b008b"];

export const ELITE = ["1111000000" + "11111110", "1111000000" + "11111101"];
export const LANDRACES = [
  { name: "Sonora landrace",     geno: "1111111110" + "11000000", from: "Sonoran Desert, Mexico" },
  { name: "Sahel landrace",      geno: "1111111101" + "10100000", from: "Sahel, West Africa" },
  { name: "Rajasthan landrace",  geno: "1111110111" + "01010000", from: "Rajasthan, India" },
];

export const heat  = (g) => [...g.slice(0, NH)].filter((c) => c === "1").length;
export const yld   = (g) => [...g.slice(NH)].filter((c) => c === "1").length;
export const topt  = (g) => 21 + 1.2 * heat(g);
export const potential = (g) => 6 + 0.75 * yld(g);
export const yieldIn = (g, T) => potential(g) * Math.exp(-((T - topt(g)) ** 2) / (2 * WIDTH ** 2));
export const climate = (r) => COUNTIES.map((t) => t + WARMING * r);      // summer when round r's releases are grown
export const publicYield = (c, T) => 7 * Math.exp(-((T - COUNTIES[c]) ** 2) / (2 * 2 ** 2));

// small seeded RNG so a reload re-shows the same offspring (no re-rolling a cross)
export function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
export function cross(p0, p1, seedStr, n = OFFSPRING) {
  const r = rng(seedStr);
  return Array.from({ length: n }, () => [...p0].map((a, i) => (r() < 0.5 ? a : p1[i])).join(""));
}

// Score one harvest. market = [{g, name, geno}] (every variety released up to and including round r).
export function harvest(market, r) {
  const T = climate(r), revenue = {}, counties = [];
  market.forEach((v) => (revenue[v.g] ??= 0));
  T.forEach((t, c) => {
    const w = market.map((v) => yieldIn(v.geno, t) ** POWER), wp = publicYield(c, t) ** POWER;
    const den = w.reduce((a, b) => a + b, 0) + wp;
    const byTeam = {};
    market.forEach((v, i) => { byTeam[v.g] = (byTeam[v.g] || 0) + w[i] / den; });
    Object.entries(byTeam).forEach(([g, s]) => (revenue[g] += FARMERS[c] * s * MONEY));
    let best = null, bv = -1;
    market.forEach((v, i) => { if (w[i] > bv) { bv = w[i]; best = v; } });
    counties.push({ T: t, farmers: FARMERS[c], byTeam, publicShare: wp / den, best });
  });
  return { counties, revenue };
}

// Whole-game standings from the database snapshot of seedwars/<gid>.
export function standings(snap) {
  const st = snap.state || { phase: "lobby", round: 0 }, moves = snap.moves || {}, teams = snap.teams || {};
  const market = [], perRound = {}, total = {};
  Object.keys(teams).forEach((g) => (total[g] = 0));
  for (let r = 1; r <= ROUNDS; r++) {
    const m = moves[r] || {};
    Object.entries(m).forEach(([g, mv]) => mv && mv.release && market.push({ g: +g, r, name: mv.release.name, geno: mv.release.geno }));
    const scored = r < st.round || (r === st.round && (st.phase === "harvest" || st.phase === "over"));
    if (!scored) break;
    perRound[r] = harvest(market.slice(), r);
    Object.entries(perRound[r].revenue).forEach(([g, v]) => (total[g] = (total[g] || 0) + v));
  }
  return { state: st, teams, market, perRound, total };
}

// Allocate whole farmer icons in a county to teams (largest remainder), for the farm map.
export function farmerIcons(county) {
  const parts = Object.entries(county.byTeam).map(([g, s]) => [g, s * county.farmers]);
  parts.push(["pub", county.publicShare * county.farmers]);
  const base = parts.map(([g, x]) => [g, Math.floor(x), x - Math.floor(x)]);
  let left = county.farmers - base.reduce((a, b) => a + b[1], 0);
  base.sort((a, b) => b[2] - a[2]).forEach((b) => { if (left > 0) { b[1]++; left--; } });
  const icons = [];
  base.sort((a, b) => b[1] - a[1]).forEach(([g, k]) => { for (let i = 0; i < k; i++) icons.push(g); });
  return icons;
}
