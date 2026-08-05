/*
 * Shikaku puzzle core: seeded generation + uniqueness-checking solver.
 * Supports arbitrary rectangular boards (w × h). No DOM dependencies —
 * also loadable from Node for testing.
 */

// --- Seeded PRNG -----------------------------------------------------------

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Partition generation --------------------------------------------------

// Recursively split the board into rectangles, never producing a piece of
// area 1 (a "1" clue makes the puzzle trivially noisy).
function generatePartition(w, h, rng) {
  const area = w * h;
  const maxArea = area <= 36 ? 8 : area <= 64 ? 9 : area <= 150 ? 12 : 14;

  function splitOptions(r) {
    const opts = [];
    for (let c = 1; c < r.w; c++) {
      if (c * r.h >= 2 && (r.w - c) * r.h >= 2) opts.push({ dir: 'v', at: c });
    }
    for (let c = 1; c < r.h; c++) {
      if (c * r.w >= 2 && (r.h - c) * r.w >= 2) opts.push({ dir: 'h', at: c });
    }
    return opts;
  }

  function splitChance(a) {
    if (a >= 10) return 0.8;
    if (a >= 8) return 0.6;
    if (a >= 6) return 0.45;
    if (a >= 4) return 0.25;
    return 0;
  }

  const stack = [{ x: 0, y: 0, w, h }];
  const done = [];
  while (stack.length) {
    const r = stack.pop();
    const a = r.w * r.h;
    const opts = splitOptions(r);
    const mustSplit = a > maxArea;
    if (opts.length && (mustSplit || rng() < splitChance(a))) {
      const o = opts[Math.floor(rng() * opts.length)];
      if (o.dir === 'v') {
        stack.push({ x: r.x, y: r.y, w: o.at, h: r.h });
        stack.push({ x: r.x + o.at, y: r.y, w: r.w - o.at, h: r.h });
      } else {
        stack.push({ x: r.x, y: r.y, w: r.w, h: o.at });
        stack.push({ x: r.x, y: r.y + o.at, w: r.w, h: r.h - o.at });
      }
    } else {
      done.push(r);
    }
  }
  return done;
}

// --- Solver ----------------------------------------------------------------

// Exact-cover style search: branch on the first uncovered cell (row-major)
// over all candidate rectangles that cover it. Returns up to `limit` full
// solutions (one rect per clue, aligned to clue order), plus a count of -1
// if the node budget was exhausted before the search finished.
function solveShikaku(w, h, clues, limit, nodeBudget) {
  if (nodeBudget === undefined) nodeBudget = Infinity;
  const clueAt = new Int16Array(w * h).fill(-1);
  clues.forEach((c, i) => (clueAt[c.y * w + c.x] = i));

  // cellCands[cell] = candidate placements {i, r} covering that cell, where a
  // candidate is a rect of clue i's area containing clue i and no other clue.
  const cellCands = Array.from({ length: w * h }, () => []);
  clues.forEach((c, i) => {
    for (let rw = 1; rw <= c.n && rw <= w; rw++) {
      if (c.n % rw) continue;
      const rh = c.n / rw;
      if (rh > h) continue;
      for (let x = Math.max(0, c.x - rw + 1); x <= c.x && x + rw <= w; x++) {
        outer: for (let y = Math.max(0, c.y - rh + 1); y <= c.y && y + rh <= h; y++) {
          for (let yy = y; yy < y + rh; yy++) {
            for (let xx = x; xx < x + rw; xx++) {
              const idx = clueAt[yy * w + xx];
              if (idx >= 0 && idx !== i) continue outer;
            }
          }
          const r = { x, y, w: rw, h: rh };
          for (let yy = y; yy < y + rh; yy++) {
            for (let xx = x; xx < x + rw; xx++) {
              cellCands[yy * w + xx].push({ i, r });
            }
          }
        }
      }
    }
  });

  const grid = new Int8Array(w * h);
  const placed = new Array(clues.length).fill(false);
  const assign = new Array(clues.length).fill(null);
  const sols = [];
  const total = w * h;
  let nodes = 0;
  let aborted = false;
  let covered = 0;

  function fits(r) {
    for (let yy = r.y; yy < r.y + r.h; yy++) {
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        if (grid[yy * w + xx]) return false;
      }
    }
    return true;
  }

  function mark(r, v) {
    for (let yy = r.y; yy < r.y + r.h; yy++) {
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        grid[yy * w + xx] = v;
      }
    }
  }

  function recurse(startCell) {
    if (aborted) return;
    if (++nodes > nodeBudget) {
      aborted = true;
      return;
    }
    if (covered === total) {
      sols.push(assign.slice());
      return;
    }
    let cell = startCell;
    while (grid[cell]) cell++;
    for (const { i, r } of cellCands[cell]) {
      if (placed[i] || !fits(r)) continue;
      placed[i] = true;
      assign[i] = r;
      mark(r, 1);
      covered += r.w * r.h;
      recurse(cell + 1);
      covered -= r.w * r.h;
      mark(r, 0);
      assign[i] = null;
      placed[i] = false;
      if (sols.length >= limit || aborted) return;
    }
  }

  recurse(0);
  return { count: aborted ? -1 : sols.length, sols };
}

function countSolutions(w, h, clues, limit, nodeBudget) {
  return solveShikaku(w, h, clues, limit, nodeBudget).count;
}

// --- Puzzle generation -----------------------------------------------------

function placeClues(solution, rng) {
  return solution.map((r) => ({
    x: r.x + Math.floor(rng() * r.w),
    y: r.y + Math.floor(rng() * r.h),
    n: r.w * r.h,
  }));
}

function sameRect(a, b) {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

// Deterministic for a given (w, h, seed), so every visitor gets the same
// daily board. Strategy: partition the board, drop clues at random cells,
// then *repair* — when the solver finds two solutions, re-place the clues of
// exactly the pieces where those solutions disagree, which surgically removes
// the ambiguity. Falls back to a fresh partition if repair stalls.
function generatePuzzle(w, h, baseSeed) {
  const rng = mulberry32(baseSeed >>> 0);
  const nodeBudget = 300000;
  let fallback = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = generatePartition(w, h, rng);
    let clues = placeClues(solution, rng);
    for (let iter = 0; iter < 25; iter++) {
      fallback = { w, h, clues, solution, seed: baseSeed };
      const res = solveShikaku(w, h, clues, 2, nodeBudget);
      if (res.count === 1) return fallback;
      if (res.count === 2) {
        // Re-scatter only the clues whose piece is ambiguous.
        clues = clues.map((c, i) => {
          if (sameRect(res.sols[0][i], res.sols[1][i])) return c;
          const p = solution[i];
          return {
            x: p.x + Math.floor(rng() * p.w),
            y: p.y + Math.floor(rng() * p.h),
            n: p.w * p.h,
          };
        });
      } else {
        // Budget blown or degenerate — full re-scatter.
        clues = placeClues(solution, rng);
      }
    }
  }
  return fallback;
}

const ShikakuCore = {
  hashString,
  mulberry32,
  generatePartition,
  solveShikaku,
  countSolutions,
  generatePuzzle,
};

if (typeof module !== 'undefined' && module.exports) module.exports = ShikakuCore;
if (typeof window !== 'undefined') window.ShikakuCore = ShikakuCore;
