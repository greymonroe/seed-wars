# Seed Wars

A live breeding and market-share game for PLS 152 (climate adaptation lecture, first played 2026-11-05). Each final-project group is a seed company. Every season they cross two parent plants, release one offspring to farmers, and keep two as next season's parents. Farmers in each county buy whichever seed yields best in their climate, and the climate warms 1 °C every season. It's a teaching simulation, not real data.

- **Phones:** `https://greymonroe.github.io/seed-wars/?g=<game-id>`
- **Projector:** `https://greymonroe.github.io/seed-wars/screen.html?g=<game-id>` (QR, timer, farm map, leaderboard; sign in as host to run it)
- Default game id: `pls152-2026-11-05`. A new class uses a new id. Testing uses `?g=test-...`.

## The model (`game.js`)
- **Plants:** inbred lines with 18 genes, 10 heat genes and 8 yield genes.
  - Climate optimum = 21 + 1.2 × (heat alleles), so 21–33 °C.
  - Yield potential = 6 + 0.75 × (yield alleles), so 6–12 t/ha.
  - Yield in a county = potential × a Gaussian of (county temperature − optimum), with sd 1.8 °C.
- **Crosses:** each offspring takes each gene from one parent or the other at random, made homozygous like a doubled haploid. Each cross gives 6 offspring, seeded so a reload shows the same ones.
- **Starting lines:** every company starts with two elite lines. They're high yield, fit about 26 °C, and are identical at the heat genes, so they can't follow the warming on their own.
- **Gene bank:** three landraces (Sonora, Sahel, Rajasthan). They're heat-adapted with low yield.
- **Market:** 12 counties from 20 to 31 °C, with 84 farmers in total and more in the middle.
  - Released seed is grown the next summer, which is 1 °C warmer each season.
  - In each county, farmers split their purchases in proportion to yield^6 across every variety released so far, plus an old public variety adapted to the original climate.
  - Each farmer is worth $1M of sales.
- **Balance:** `node test/sim.mjs` plays 300 bot games.
  - Never using a landrace averaged $14M and won 0 games.
  - Using a landrace averaged $22–30M.
  - Waiting a season or two before crossing one in did slightly better than doing it in season 1.

## Data
Firebase Realtime Database of `live-poll-test` (project `live-poll-8088d`), under `seedwars/<game-id>/`:
- `state`: host only (`phase` lobby / breed / harvest / over, `round`, `rkey`, `endsAt`).
- `teams/<g>`: create-only. The first phone to claim group g owns it, and its anonymous uid is stored.
- `moves/<r>/<g>`: written only by the owning phone, and only while season r is open: `{release: {name, geno}, keep: [geno, geno], landrace}`.

The rules are in the `seedwars` block of `~/repos/live-poll-test/database.rules.json`, deployed with a REST PUT (see that repo's SECURITY.md). The host's Reset button deletes the whole game. Phones can't delete anything.

## Testing
`node test/bots.mjs <game-id> setup|open <r>|bots <r>|harvest <r>` drives a game with 12 bot companies through the REST API, using the gcloud admin login.
