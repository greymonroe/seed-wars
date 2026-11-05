// node test/tbots.mjs <gid> setup | trial <r> | bots <r> | market <r> | truth <r> | over
import { execSync } from "node:child_process";
import * as T from "../trial.js";
const [gid, action, rs] = process.argv.slice(2), r = +rs;
const TOK = execSync("gcloud auth print-access-token").toString().trim();
const call = (p, method, body) => fetch(`https://live-poll-8088d-default-rtdb.firebaseio.com/trials/${gid}${p}.json`,
  { method, headers: { Authorization: "Bearer " + TOK }, body: body && JSON.stringify(body) }).then((x) => x.json());
const NAMES = ["Cob Squad", "Maize Daze", "Husker Du", "Kernel Panic", "Ear We Go", "Stalk Stars", "Popcorn Pals", "Silk Road", "Tassel Hoff", "Corn Stars", "Grain Drain", "Seedy Biz"];
if (action === "setup") { await call("", "DELETE"); for (let g = 1; g <= 12; g++) await call(`/teams/${g}`, "PUT", { name: NAMES[g - 1], uid: "bot" + g, ts: { ".sv": "timestamp" } }); }
else if (["trial", "market", "truth", "over"].includes(action)) await call("/state", "PUT", { phase: action, round: r || 3, rkey: String(r || 3), endsAt: Date.now() + 300000 });
else if (action === "bots") {
  const all = await call("", "GET");
  for (let g = 1; g <= 12; g++) {
    const a = Array(24).fill(0), kind = g % 3;
    if (kind === 0) for (let k = 0; k < 12; k++) a[((k * 5 + r + g) % 6) * 4 + (k + r + g) % 4]++;                    // scatter
    else if (kind === 1) for (let h = 0; h < 6; h++) { a[h * 4 + (g % 4)] += 2; }                                   // focus one region
    else { const R1 = g % 4, R2 = (g + 1) % 4; if (r === 1) for (let h = 0; h < 6; h++) { a[h * 4 + R1]++; a[h * 4 + R2]++; }
      else { const p1 = T.trialResults(gid, g, 1, all.plots[1][g].alloc); const b = (ri) => [0,1,2,3,4,5].sort((x, y) => (p1[y][ri].mean ?? -1) - (p1[x][ri].mean ?? -1))[0];
        a[b(R1) * 4 + R1] += 6; a[b(R2) * 4 + R2] += 6; } }
    const alloc = a.join(""); await call(`/plots/${r}/${g}`, "PUT", { alloc, ts: { ".sv": "timestamp" } });
    const res = T.trialResults(gid, g, r, alloc), h = [0,1,2,3,4,5].sort((x, y) => Math.max(...res[y].map((c) => c.n ? T.rating(c.mean, c.n) : -9)) - Math.max(...res[x].map((c) => c.n ? T.rating(c.mean, c.n) : -9)))[0];
    await call(`/release/${r}/${g}`, "PUT", { h, name: NAMES[g - 1].split(" ")[0] + " " + ["Gold", "Max", "Pro"][r - 1], ts: { ".sv": "timestamp" } });
  }
}
console.log("ok", action, r || "");
