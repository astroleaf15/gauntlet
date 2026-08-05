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

      const target = 12 + Math.floor(rng() * 6);
      const region = new Set([horse]);
      while (region.size < target) {
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

      return { water, horse, budget, target: region.size };
    }
    return null;
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
        <span class="stage-hint">Fences: <b class="hp-used">0</b>/<b>${budget}</b> · pen ≥ <b>${target}</b> tiles</span>
        <button class="btn primary small hp-release">Release the horse 🐴</button>
      </div>
      <div class="hp-grid"></div>
      <p class="hp-msg">Tap grass to place fences. Water is a free wall — the horse can't swim.</p>
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
        msgEl.textContent = `Penned, but only ${comp.cells.size} tiles — the horse needs ≥ ${target}.`;
        return;
      }
      done = true;
      for (const c of comp.cells) cells[c].classList.add('hp-penned');
      msgEl.textContent = `🐴 Happily penned in ${comp.cells.size} tiles!`;
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
    blurb: 'Fence the horse in before it bolts — limited fences, and it needs room to graze.',
    create,
    _test: { N, generate, reachable },
  };
})();
