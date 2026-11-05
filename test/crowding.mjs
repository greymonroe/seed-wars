// Does the best region depend on where the others go? 16 rivals play "careful" (screen, then replicate their
// best hybrid) aimed at regions drawn from a crowd pattern; one focal company does the same aimed at region X.
import * as T from "../trial.js";
const best = (gid, g, plots, ri) => { const res = plots.map((a, k) => T.trialResults(gid, g, k + 1, a)); return [0,1,2,3,4,5].sort((x, y) => {
  const m = (h) => { const ys = res.flatMap((R) => R[h][ri].ys); return ys.length ? ys.reduce((a, b) => a + b) / ys.length : -1; }; return m(y) - m(x); })[0]; };
function game(seed, targets) {   // targets[g] = region index for company g (1..17)
  const gid = "crowd" + seed, snap = { state: { phase: "over", round: 3 }, teams: {}, plots: {}, release: {} }, hist = {};
  for (let g = 1; g <= 17; g++) { snap.teams[g] = { name: g }; hist[g] = []; }
  for (let r = 1; r <= 3; r++) { snap.plots[r] = {}; snap.release[r] = {};
    for (let g = 1; g <= 17; g++) { const ri = targets[g], a = Array(24).fill(0);
      if (r === 1) for (let h = 0; h < 6; h++) a[h * 4 + ri] += 2; else a[best(gid, g, hist[g], ri) * 4 + ri] += 12;
      const al = a.join(""); hist[g].push(al); snap.plots[r][g] = { alloc: al }; snap.release[r][g] = { h: best(gid, g, hist[g], ri), name: "x" }; } }
  return T.standings(gid, snap).total;
}
const crowds = { "everyone in Hot & dry": [3], "everyone in the two big regions": [2, 3], "spread evenly": [0, 1, 2, 3], "everyone in the cool regions": [0, 1] };
for (const [label, pool] of Object.entries(crowds)) {
  const row = [];
  for (let X = 0; X < 4; X++) { let sum = 0; for (let s = 0; s < 40; s++) { const t = {}; for (let g = 1; g <= 16; g++) t[g] = pool[(g + s) % pool.length]; t[17] = X; sum += game(s * 7 + X, t)[17]; } row.push((sum / 40).toFixed(1)); }
  console.log(label.padEnd(34), T.REGIONS.map((R, i) => `${R.name}: $${row[i]}M`).join("   "));
}
