// node test/sim.mjs : bots play many games; prints mean earnings by strategy.
import * as G from "../game.js";
const strategies = {
  elite_only: { landraceAt: null },
  landrace_r1: { landraceAt: 1 },
  landrace_r2: { landraceAt: 2 },
  landrace_r3: { landraceAt: 3 },
};
function value(geno, r) { return G.climate(r).reduce((a, t, c) => a + G.FARMERS[c] * G.yieldIn(geno, t) ** 2, 0); }
function play(nTeams, assign, seed) {
  const teams = {}, moves = {};
  for (let g = 1; g <= nTeams; g++) teams[g] = { parents: [...G.ELITE], strat: strategies[assign(g)], name: assign(g) };
  for (let r = 1; r <= G.ROUNDS; r++) {
    moves[r] = {};
    for (let g = 1; g <= nTeams; g++) {
      const t = teams[g];
      if (t.strat.landraceAt === r) t.parents[1] = G.LANDRACES[g % 3].geno;
      const kids = G.cross(t.parents[0], t.parents[1], `${seed}:${g}:${r}`);
      const ranked = kids.slice().sort((a, b) => value(b, r) - value(a, r));
      moves[r][g] = { release: { name: `${g}-${r}`, geno: ranked[0] } };
      // keep: best now + most heat-adapted among decent ones (breeders think ahead)
      const heatPick = kids.slice().sort((a, b) => value(b, r + 1) - value(a, r + 1))[0];
      t.parents = [ranked[0], heatPick === ranked[0] ? ranked[1] : heatPick];
    }
  }
  const snap = { state: { phase: "over", round: G.ROUNDS }, teams: Object.fromEntries(Object.keys(teams).map((g) => [g, {}])), moves };
  const s = G.standings(snap);
  return Object.entries(s.total).map(([g, v]) => [teams[g].name, v, s]);
}
const keys = Object.keys(strategies), acc = Object.fromEntries(keys.map((k) => [k, []])), wins = Object.fromEntries(keys.map((k) => [k, 0]));
let pubLast = [];
for (let s = 0; s < 300; s++) {
  const res = play(16, (g) => keys[(g + s) % keys.length], "seed" + s);
  res.forEach(([k, v]) => acc[k].push(v));
  const best = res.slice().sort((a, b) => b[1] - a[1])[0]; wins[best[0]]++;
  if (s === 0) { const st = res[0][2]; for (let r = 1; r <= G.ROUNDS; r++) console.log("round", r, "revenue by team", Object.values(st.perRound[r].revenue).map((x) => x.toFixed(1)).join(" ")); }
}
for (const k of keys) console.log(k.padEnd(12), "mean $", (acc[k].reduce((a, b) => a + b, 0) / acc[k].length).toFixed(1), "M  wins", wins[k]);
