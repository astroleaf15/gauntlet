# ⛓️ The Gauntlet

**Play it here → [astroleaf15.github.io/gauntlet](https://astroleaf15.github.io/gauntlet/)**

Eight quick puzzle games, played back to back, on **one clock**. Everyone in
the world gets the same daily run — how fast can you finish?

## Today's stages

1. 🟦 **Shikaku** (9×9) — drag boxes so every number sits alone in a box of
   exactly that area, tiling the whole grid. Guaranteed unique solution.
2. 💣 **Minesweeper** (11×11, 15 mines) — clear every safe cell. First click
   is always safe, and every board is vetted by a deduction solver so **no
   guessing is ever required**. Hitting a mine deals a fresh board; the clock
   keeps running.
3. ➿ **Zip** (6×6) — draw one continuous path that hits the numbered dots in
   order and covers every cell (LinkedIn-Zip-style). Boards are random
   Hamiltonian paths made with the backbite algorithm.
4. 🔤 **Word Hunt** — a 4×4 Boggle-dice board; drag through adjacent letters
   to spell words (ENABLE dictionary). Reach 5,000 points to move on. Boards
   are vetted to have several times that available.
5. 🌗 **Tango** (6×6) — fill the grid with suns and moons: three of each per
   row/column, never three alike together, and `=` / `×` pair constraints
   (LinkedIn-Tango-style). Unique solution guaranteed.
6. 🐴 **Horse Pen** — inspired by [enclose.horse](https://enclose.horse):
   fence in the horse with a limited fence budget so it can't reach the edge —
   and give it at least the target number of tiles to graze. Water is a free
   wall. Constructive generation guarantees it's solvable.
7. ⌨️ **Typing Sprint** — type the passage exactly; wrong keystrokes don't
   advance.
8. 🔢 **Numbers Rush** — the numbers 1–36 scattered on a 6×6 grid. Click them
   in order.

The clock starts when you hit *Start* and doesn't stop until the final stage is done.
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
