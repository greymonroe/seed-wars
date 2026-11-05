// Seed Wars: Firebase helpers (same project as live-poll-test, its own subtree):
//   seedwars/<gid>/state            host only: {phase: lobby|breed|harvest|over, round, endsAt}
//   seedwars/<gid>/teams/<g>        create-only: {name, uid, ts}; the first phone to claim group g owns it
//   seedwars/<gid>/moves/<r>/<g>    the owning phone, during round r's breed phase:
//                                   {release: {name, geno}, keep: [geno, geno], landrace, ts}
// Students get an anonymous Firebase session (no accounts, no PII). Rules: live-poll-test/database.rules.json.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export const gameId = (new URLSearchParams(location.search).get("g") || "pls152-2026-11-05")
  .toLowerCase().replace(/[^a-z0-9-]/g, "");
export const base = `seedwars/${gameId}`;
export const tbase = `trials/${gameId}`;

export const ready = new Promise((resolve) => {
  let settled = false;
  const done = (u) => { if (!settled) { settled = true; resolve(u); } };
  onAuthStateChanged(auth, (user) => {
    if (user) return done(user);
    signInAnonymously(auth).catch((e) => { console.error(e); done(null); });
  });
});

export async function amHost() {
  const u = auth.currentUser; if (!u) return false;
  const s = await get(ref(db, "admin/hostUid"));
  return s.exists() && s.val() === u.uid;
}
export async function signInAsHost() {
  await signInWithPopup(auth, new GoogleAuthProvider());
  return amHost();
}

// ---- drawing ------------------------------------------------------------------

import { topt, potential, heat, yld, NH, NG } from "./game.js";

// leaf colour runs blue-green (cool-adapted) to orange (heat-adapted)
export function heatColor(t) {
  const x = Math.max(0, Math.min(1, (t - 20) / 16));
  return `hsl(${205 - 197 * x}, ${60 + 15 * x}%, ${45 + 3 * x}%)`;
}

// A corn plant: height from yield potential, leaf colour from climate optimum.
export function plantSVG(geno, size = 90) {
  const h = 30 + (potential(geno) - 6) / 6 * 50, c = heatColor(topt(geno)), base = 96, top = base - h;
  let s = `<svg viewBox="0 0 60 100" width="${size * 0.6}" height="${size}">`;
  s += `<line x1="30" y1="${base}" x2="30" y2="${top}" stroke="#4e7d2a" stroke-width="3.5" stroke-linecap="round"/>`;
  for (let i = 0; i < 4; i++) {
    const y = base - 10 - i * (h - 12) / 4, d = i % 2 ? -1 : 1;
    s += `<path d="M30 ${y} Q ${30 + d * 16} ${y - 10} ${30 + d * 26} ${y - 2}" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
  const cobs = 1 + Math.round((potential(geno) - 6) / 3);
  for (let i = 0; i < cobs; i++) s += `<ellipse cx="${34 + i * 2}" cy="${base - h * 0.45 - i * 9}" rx="3.4" ry="7" fill="#f2c230" stroke="#c99a10" stroke-width="1"/>`;
  s += `<path d="M30 ${top} l-5 -7 M30 ${top} l0 -9 M30 ${top} l5 -7" stroke="#c9a227" stroke-width="2" stroke-linecap="round"/>`;
  s += `<line x1="12" y1="${base}" x2="48" y2="${base}" stroke="#8d6e63" stroke-width="3"/></svg>`;
  return s;
}

// 18 little squares: heat genes (orange when heat allele) then yield genes (green when high-yield allele)
export function genomeSVG(geno, w = 150) {
  const cell = w / (NG + 1);
  let s = `<svg viewBox="0 0 ${w} ${cell + 2}" width="${w}" height="${cell + 2}">`;
  [...geno].forEach((a, i) => {
    const x = i * cell + (i >= NH ? cell : 0);
    const col = a === "1" ? (i < NH ? "#ef6c00" : "#2e7d32") : "#e0e0e0";
    s += `<rect x="${x + 0.5}" y="1" width="${cell - 1.5}" height="${cell - 1.5}" rx="1.5" fill="${col}"/>`;
  });
  return s + "</svg>";
}

export function stats(geno) {
  return { topt: topt(geno), pot: potential(geno), heat: heat(geno), yld: yld(geno) };
}
