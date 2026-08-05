/* Gauntlet stage: Horse Pen (inspired by enclose.horse). Place a limited
 * number of fences on grass so the horse can't reach the edge — and the pen
 * must be at least the target size. Water blocks the horse for free. */
(() => {
  'use strict';

  const N = 9;

  function idx(x, y) {
    return y * N + x;
  }
  function orthNeighbors(i) {
    const x = i % N;
    const y = (i / N) | 0;
    const out = [];
    if (x > 0) out.push(i - 1);
    if (x < N - 1) out.push(i + 1);
    if (y > 0) out.push(i - N);
    if (y < N - 1) out.push(i + N);
    return out;
  }
  function isEdge(i) {
    const x = i % N;
    const y = (i / N) | 0;
    return x === 0 || y === 0 || x === N - 1 || y === N - 1;
  }

  // Build a board that is guaranteed solvable: grow a connected pen region
  // around the horse (kept off the border ring), and set the fence budget to
  // exactly that region's grass boundary. Water on the boundary is a free wall.
  function generate(rng) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const water = new Uint8Array(N * N);
      const blobCount = 2 + (rng() < 0.5 ? 1 : 0);
      for (let b = 0; b < blobCount; b++) {
        let c = Math.floor(rng() * N * N);
        const len = 3 + Math.floor(rng() * 4);
        for (let s = 0; s < len; s++) {
          water[c] = 1;
          const ns = orthNeighbors(c);
          c = ns[Math.floor(rng() * ns.length)];
        }
      }

      const hx = 2 + Math.floor(rng() * 5);
      const hy = 2 + Math.floor(rng() * 5);
      const horse = idx(hx, hy);
      if (water[horse]) continue;

      const growSize = 12 + Math.floor(rng() * 6);
      const region = new Set([horse]);
      while (region.size < growSize) {
        const cands = [];
        for (const r of region) {
          for (const n of orthNeighbors(r)) {
            if (!region.has(n) && !water[n] && !isEdge(n)) cands.push(n);
          }
        }
        if (!cands.length) break;
        region.add(cands[Math.floor(rng() * cands.length)]);
      }
      if (region.size < 9) continue;

      const boundary = new Set();
      for (const r of region) {
        for (const n of orthNeighbors(r)) {
          if (!region.has(n) && !water[n]) boundary.add(n);
        }
      }
      const budget = boundary.size;
      if (budget < 6 || budget > 18) continue;

      // Verify by construction: fencing the whole boundary pens the horse in
      // exactly the region.
      const fence = new Uint8Array(N * N);
      for (const b of boundary) fence[b] = 1;
      const comp = reachable(horse, water, fence);
      if (comp.escaped || comp.cells.size !== region.size) continue;

      // The win condition is the OPTIMAL pen: find the biggest enclosure this
      // budget allows (seeded search, so every player gets the same target).
      // Two independent search runs, keep the better result.
      const target = Math.max(
        maxPen(water, horse, budget, rng, region),
        maxPen(water, horse, budget, rng, null)
      );
      return { water, horse, budget, target };
    }
    return null;
  }

  function penCost(R, water) {
    const b = new Set();
    for (const r of R) {
      for (const n of orthNeighbors(r)) {
        if (!R.has(n) && !water[n]) b.add(n);
      }
    }
    return b.size;
  }

  // Best pen area achievable within the fence budget. Epsilon-greedy region
  // growth (prefer additions that keep the fence boundary small) from fresh
  // starts, then basin hopping: carve a few cells off the best region found
  // and regrow. Any region returned is achievable by fencing its boundary,
  // so the target is never unreachable.
  function maxPen(water, horse, budget, rng, seedRegion) {
    function grow(R) {
      for (;;) {
        const cands = new Set();
        for (const r of R) {
          for (const n of orthNeighbors(r)) {
            if (!R.has(n) && !water[n] && !isEdge(n)) cands.add(n);
          }
        }
        if (!cands.size) return;
        const fitting = [];
        let bestCost = Infinity;
        let bestMoves = [];
        for (const c of cands) {
          R.add(c);
          const cost = penCost(R, water);
          R.delete(c);
          if (cost > budget) continue;
          fitting.push(c);
          if (cost < bestCost) {
            bestCost = cost;
            bestMoves = [c];
          } else if (cost === bestCost) {
            bestMoves.push(c);
          }
        }
        if (!fitting.length) return;
        const pool = rng() < 0.3 ? fitting : bestMoves;
        R.add(pool[Math.floor(rng() * pool.length)]);
      }
    }

    function staysConnected(R) {
      const seen = new Set([horse]);
      const stack = [horse];
      while (stack.length) {
        const c = stack.pop();
        for (const n of orthNeighbors(c)) {
          if (R.has(n) && !seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      return seen.size === R.size;
    }

    // Several independent search phases; the target is the best across all
    // of them. Within a phase the walk drifts across equal-size plateaus,
    // which is what lets it slip out of local optima.
    let bestSize = 1;
    for (let phase = 0; phase < 4; phase++) {
      let base = null;
      for (let s = 0; s < 25; s++) {
        const R =
          phase === 0 && s === 0 && seedRegion ? new Set(seedRegion) : new Set([horse]);
        grow(R);
        if (penCost(R, water) <= budget && (!base || R.size > base.size)) base = R;
      }
      if (!base) continue;
      if (base.size > bestSize) bestSize = base.size;
      for (let s = 0; s < 90; s++) {
        const R = new Set(base);
        const carve = 2 + Math.floor(rng() * 7);
        for (let j = 0; j < carve; j++) {
          const cands = [...R].filter((c) => c !== horse);
          if (!cands.length) break;
          const c = cands[Math.floor(rng() * cands.length)];
          R.delete(c);
          if (!staysConnected(R)) R.add(c);
        }
        grow(R);
        if (penCost(R, water) > budget) continue;
        if (R.size >= base.size) base = R;
        if (R.size > bestSize) bestSize = R.size;
      }
    }
    return bestSize;
  }

  // Flood from the horse through grass (no water, no fence). Reports the
  // reachable component and whether it touches the board edge.
  function reachable(horse, water, fence) {
    const cells = new Set([horse]);
    const stack = [horse];
    let escaped = false;
    while (stack.length) {
      const c = stack.pop();
      if (isEdge(c)) escaped = true;
      for (const n of orthNeighbors(c)) {
        if (!cells.has(n) && !water[n] && !fence[n]) {
          cells.add(n);
          stack.push(n);
        }
      }
    }
    return { cells, escaped };
  }

  function create(container, { rng, onWin }) {
    let board = generate(rng);
    if (!board) {
      // Practically unreachable, but never leave the stage unwinnable.
      board = generate(window.GCore.mulberry32(12345));
    }
    const { water, horse, budget, target } = board;
    const fence = new Uint8Array(N * N);
    let done = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint">Fences: <b class="hp-used">0</b>/<b>${budget}</b> · pen target: <b>${target}</b> tiles</span>
        <button class="btn primary small hp-release">Release the horse 🐴</button>
      </div>
      <div class="hp-grid"></div>
      <p class="hp-msg">Fence the horse into a pen of at least <b>${target}</b> tiles — the most these fences allow. Water is a free wall.</p>
    `;
    const gridEl = container.querySelector('.hp-grid');
    const usedEl = container.querySelector('.hp-used');
    const msgEl = container.querySelector('.hp-msg');
    const releaseBtn = container.querySelector('.hp-release');
    gridEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;

    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const b = document.createElement('button');
      b.className = 'hp-cell';
      b.dataset.i = i;
      if (water[i]) b.classList.add('hp-water');
      if (i === horse) {
        b.classList.add('hp-horse');
        b.textContent = '🐴';
      }
      gridEl.appendChild(b);
      cells.push(b);
    }

    function usedCount() {
      let u = 0;
      for (let i = 0; i < N * N; i++) if (fence[i]) u++;
      return u;
    }

    function clearFlashes() {
      for (const b of cells) b.classList.remove('hp-escape', 'hp-penned');
    }

    const onClick = (e) => {
      const t = e.target.closest('.hp-cell');
      if (!t || done) return;
      const i = Number(t.dataset.i);
      if (water[i] || i === horse) return;
      clearFlashes();
      if (fence[i]) {
        fence[i] = 0;
        t.classList.remove('hp-fence');
      } else {
        if (usedCount() >= budget) {
          msgEl.textContent = `Out of fences (${budget}) — remove one to move it.`;
          return;
        }
        fence[i] = 1;
        t.classList.add('hp-fence');
      }
      usedEl.textContent = usedCount();
      msgEl.textContent = ' ';
    };

    const onRelease = () => {
      if (done) return;
      clearFlashes();
      const comp = reachable(horse, water, fence);
      if (comp.escaped) {
        for (const c of comp.cells) if (!fence[c]) cells[c].classList.add('hp-escape');
        msgEl.textContent = '🐎💨 The horse can escape! Plug the gaps.';
        return;
      }
      if (comp.cells.size < target) {
        for (const c of comp.cells) cells[c].classList.add('hp-penned');
        const pct = Math.floor((comp.cells.size / target) * 100);
        msgEl.textContent = `Penned ${comp.cells.size} / ${target} tiles (${pct}%) — a bigger pen is possible. Rearrange and retry!`;
        return;
      }
      done = true;
      for (const c of comp.cells) cells[c].classList.add('hp-penned');
      msgEl.textContent = `🐴 Perfect pen — ${comp.cells.size} tiles!`;
      setTimeout(onWin, 500);
    };

    gridEl.addEventListener('click', onClick);
    releaseBtn.addEventListener('click', onRelease);

    return {
      destroy() {
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.horse = {
    key: 'horse',
    name: 'Horse Pen',
    icon: '🐴',
    blurb: 'Fence the horse into the biggest possible pen — anything less than the max means try again.',
    create,
    _test: { N, generate, reachable, maxPen, penCost },
  };
})();
