// node test/bots.mjs <gameId> <action> : drive a test game through the REST API with the gcloud admin token.
//   setup        wipe the game, add 12 bot companies
//   open <r>     start breeding season r      harvest <r>   harvest season r      bots <r>  bots send moves for r
import { execSync } from "node:child_process";
import * as G from "../game.js";
const [gid, action, rs] = process.argv.slice(2), r = +rs;
const T = execSync("gcloud auth print-access-token").toString().trim();
const URL = (p) => `https://live-poll-8088d-default-rtdb.firebaseio.com/seedwars/${gid}${p}.json`;
const call = (p, method, body) => fetch(URL(p), { method, headers: { Authorization: "Bearer " + T }, body: body && JSON.stringify(body) }).then((x) => x.json());
const NAMES = ["Cob Squad", "Maize Daze", "Husker Du", "Kernel Panic", "Ear We Go", "Stalk Stars", "Popcorn Pals", "Silk Road",
  "Tassel Hoff", "Corn Stars", "Grain Drain", "Seedy Biz"];
const value = (g, r) => G.climate(r).reduce((a, t, c) => a + G.FARMERS[c] * G.yieldIn(g, t) ** 2, 0);
if (action === "setup") {
  await call("", "DELETE");
  for (let g = 1; g <= 12; g++) await call(`/teams/${g}`, "PUT", { name: NAMES[g - 1], uid: "bot" + g, ts: { ".sv": "timestamp" } });
} else if (action === "open") await call("/state", "PUT", { phase: "breed", round: r, rkey: String(r), endsAt: Date.now() + 180000 });
else if (action === "harvest") await call("/state", "PUT", { phase: "harvest", round: r, rkey: String(r) });
else if (action === "bots") {
  const all = await call("", "GET");
  for (let g = 1; g <= 12; g++) {
    let parents = G.ELITE.slice();
    for (let k = r - 1; k >= 1; k--) if (all.moves?.[k]?.[g]?.keep) { parents = all.moves[k][g].keep; break; }
    const strat = g % 4;   // 0 never landrace, 1 landrace r1, 2 landrace r2, 3 landrace r3
    if (strat && strat === r) parents[1] = G.LANDRACES[g % 3].geno;
    const kids = G.cross(parents[0], parents[1], `${gid}:${g}:${r}`);
    const best = kids.slice().sort((a, b) => value(b, r) - value(a, r));
    const ahead = kids.slice().sort((a, b) => value(b, r + 1) - value(a, r + 1))[0];
    await call(`/moves/${r}/${g}`, "PUT", { release: { name: `${NAMES[g - 1].split(" ")[0]} ${r}00`, geno: best[0] },
      keep: [best[0], ahead === best[0] ? best[1] : ahead], landrace: strat > 0 && strat <= r, ts: { ".sv": "timestamp" } });
  }
}
console.log("ok", action, r || "");
