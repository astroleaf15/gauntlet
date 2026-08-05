# ⛓️ The Gauntlet

**Play it here → [astroleaf15.github.io/gauntlet](https://astroleaf15.github.io/gauntlet/)**

Three quick puzzle games, played back to back, on **one clock**. Everyone in
the world gets the same daily run — how fast can you finish?

## Today's stages

1. 🟦 **Shikaku** (7×7) — drag boxes so every number sits alone in a box of
   exactly that area, tiling the whole grid. Generated with a guaranteed
   unique solution.
2. 💣 **Minesweeper** (9×9, 10 mines) — clear every safe cell. Your first
   click is always safe. Hitting a mine deals a fresh board; the clock keeps
   running.
3. 🔢 **Numbers Rush** — the numbers 1–100 scattered on a 10×10 grid. Click
   them in order.

The clock starts when you hit *Start* and doesn't stop until stage 3 is done.
Splits are shown per stage, your daily best and streak are saved in your
browser, and there's a share button for bragging.

- **Daily run** — seeded from the date, identical for every player, streak
  tracked locally.
- **Practice run** — random seed, any time.

## Architecture

No build step, no dependencies — plain HTML/CSS/JS on GitHub Pages.

- `core.js` — seeded PRNG (mulberry32 + string hash), shuffle, time
  formatting. Every stage's randomness flows from a seed derived from the
  date (or a random practice seed), so daily runs are identical for everyone.
- `games/*.js` — each stage is a self-contained module registering
  `{ name, icon, blurb, create(container, { rng, onWin }) }` on
  `window.GauntletGames`. `create` builds its own DOM/canvas and returns a
  `destroy()` handle — adding a new game to the gauntlet is one file plus one
  line in the stage list.
- `shikaku-core.js` — the Shikaku generator/solver from the
  [shikaku](https://github.com/astroleaf15/shikaku) project: exact-cover
  backtracking solver plus a clue-repair loop that guarantees a unique
  solution.
- `gauntlet.js` — the orchestrator: intro screen → stages with one continuous
  clock → interstitial splits → results, persistence, and sharing.

## Development

```sh
cd gauntlet
python3 -m http.server   # any static server works
```

Then open http://localhost:8000.
