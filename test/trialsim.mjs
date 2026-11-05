import * as T from "../trial.js";
const N = 16;
function allocFrom(cells) { const a = Array(T.NHYB * 4).fill(0); cells.forEach(([h, ri]) => a[h * 4 + ri]++); return a.join(""); }
const bestBy = (res, fn) => [...Array(T.NHYB).keys()].sort((a, b) => fn(b) - fn(a))[0];
const strategies = {
  focus_HD(g, r, gid, mem) { const c = []; for (let h = 0; h < 6; h++) c.push([h, 3], [h, 3]); return c; },
  focus_CW(g, r, gid, mem) { const c = []; for (let h = 0; h < 6; h++) c.push([h, 0], [h, 0]); return c; },
  scatter(g, r, gid, mem) { const c = []; for (let k = 0; k < 12; k++) c.push([(k * 5 + r + g) % 6, (k + r * 3 + g) % 4]); return c; },
  adaptive(g, r, gid, mem) {   // round 1: screen all 6 hybrids in two regions; later: 6 plots each of the best hybrid per region
    const a = g % 4, b = (g + 1) % 4; mem.a = a; mem.b = b;
    if (r === 1) { const c = []; for (let h = 0; h < 6; h++) c.push([h, a], [h, b]); return c; }
    return Array(6).fill([mem.bestA, a]).concat(Array(6).fill([mem.bestB, b]));
  },
  generalist_hunt(g, r, gid, mem) {   // 3 hybrids x 4 regions x 1 plot each round
    const c = []; for (let h = 0; h < 3; h++) for (let ri = 0; ri < 4; ri++) c.push([(h + r * 3) % 6, ri]); return c; },
};
const names = Object.keys(strategies), acc = Object.fromEntries(names.map((k) => [k, []])), burned = Object.fromEntries(names.map((k) => [k, 0]));
for (let s = 0; s < 200; s++) {
  const gid = "sim" + s, snap = { teams: {}, plots: {}, release: {}, state: { phase: "over", round: 3 } }, strat = {}, mem = {};
  for (let g = 1; g <= N; g++) { snap.teams[g] = { name: g }; strat[g] = names[(g + s) % names.length]; mem[g] = {}; }
  for (let r = 1; r <= T.ROUNDS; r++) {
    snap.plots[r] = {}; snap.release[r] = {};
    for (let g = 1; g <= N; g++) {
      const alloc = allocFrom(strategies[strat[g]](g, r, gid, mem[g]));
      const res = T.trialResults(gid, g, r, alloc);
      // release: the hybrid with the best mean in any tested region (what a naive student does)
      const score = (h) => Math.max(...res[h].map((c) => c.n ? T.rating(c.mean, c.n) : -1));
      const h = bestBy(res, score); if (r === 1 && mem[g].a != null) { mem[g].bestA = bestBy(res, (x) => res[x][mem[g].a].mean ?? -1); mem[g].bestB = bestBy(res, (x) => res[x][mem[g].b].mean ?? -1); }
      snap.plots[r][g] = { alloc }; snap.release[r][g] = { h, name: "x" };
    }
  }
  const st = T.standings(gid, snap);
  for (let g = 1; g <= N; g++) { acc[strat[g]].push(st.total[g]); if (Object.values(st.rounds).some((R) => (R.refund[g] || 0) > 0.05)) burned[strat[g]]++; }
}
for (const k of names) console.log(k.padEnd(10), "mean $", (acc[k].reduce((a, b) => a + b, 0) / acc[k].length).toFixed(1), "M  had a refund:", burned[k], "/", acc[k].length);
