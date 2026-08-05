/* Gauntlet stage: Tango (LinkedIn-style). Fill the 6×6 grid with suns and
 * moons: three of each per row and column, never three in a row, and cells
 * joined by = must match while × must differ. Unique solution guaranteed. */
(() => {
  'use strict';

  const N = 6;

  function genSolution(rng) {
    const g = new Int8Array(N * N).fill(-1);
    function ok(i, v) {
      const x = i % N;
      const y = (i / N) | 0;
      let rc = 0;
      let cc = 0;
      for (let k = 0; k < N; k++) {
        if (g[y * N + k] === v) rc++;
        if (g[k * N + x] === v) cc++;
      }
      if (rc >= N / 2 || cc >= N / 2) return false;
      if (x >= 2 && g[i - 1] === v && g[i - 2] === v) return false;
      if (y >= 2 && g[i - N] === v && g[i - 2 * N] === v) return false;
      return true;
    }
    function fill(i) {
      if (i === N * N) return true;
      const first = rng() < 0.5 ? 0 : 1;
      for (const v of [first, 1 - first]) {
        if (ok(i, v)) {
          g[i] = v;
          if (fill(i + 1)) return true;
          g[i] = -1;
        }
      }
      return false;
    }
    fill(0);
    return g;
  }

  // Count solutions (capped at `limit`) for a set of givens + edge constraints.
  function countSolutions(givens, edges, limit) {
    const g = givens.slice();
    const edgesAt = Array.from({ length: N * N }, () => []);
    for (const e of edges) {
      edgesAt[e.a].push({ other: e.b, eq: e.eq });
      edgesAt[e.b].push({ other: e.a, eq: e.eq });
    }
    let count = 0;
    function ok(i, v) {
      const x = i % N;
      const y = (i / N) | 0;
      let rc = 0;
      let cc = 0;
      for (let k = 0; k < N; k++) {
        if (g[y * N + k] === v) rc++;
        if (g[k * N + x] === v) cc++;
      }
      if (rc >= N / 2 || cc >= N / 2) return false;
      if (x >= 2 && g[i - 1] === v && g[i - 2] === v) return false;
      if (y >= 2 && g[i - N] === v && g[i - 2 * N] === v) return false;
      for (const e of edgesAt[i]) {
        const o = g[e.other];
        if (o !== -1 && (e.eq ? o !== v : o === v)) return false;
      }
      return true;
    }
    function rec(i) {
      while (i < N * N && g[i] !== -1) i++;
      if (i === N * N) {
        count++;
        return;
      }
      for (const v of [0, 1]) {
        if (ok(i, v)) {
          g[i] = v;
          rec(i + 1);
          g[i] = -1;
          if (count >= limit) return;
        }
      }
    }
    rec(0);
    return count;
  }

  function generate(rng) {
    const sol = genSolution(rng);
    const givens = new Int8Array(N * N).fill(-1);
    const edges = [];

    // A few anchor givens for flavor, then add random clues until unique.
    const cellIds = window.GCore.shuffle(Array.from({ length: N * N }, (_, i) => i), rng);
    for (let k = 0; k < 3; k++) givens[cellIds[k]] = sol[cellIds[k]];

    const pool = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (x < N - 1) pool.push({ type: 'edge', a: i, b: i + 1 });
        if (y < N - 1) pool.push({ type: 'edge', a: i, b: i + N });
        if (givens[i] === -1) pool.push({ type: 'given', i });
      }
    }
    window.GCore.shuffle(pool, rng);

    const added = [];
    for (const c of pool) {
      if (countSolutions(givens, edges, 2) === 1) break;
      if (c.type === 'edge') {
        edges.push({ a: c.a, b: c.b, eq: sol[c.a] === sol[c.b] });
      } else {
        givens[c.i] = sol[c.i];
      }
      added.push(c);
    }

    // Prune redundant clues so the puzzle stays interesting.
    for (let k = added.length - 1; k >= 0; k--) {
      const c = added[k];
      if (c.type === 'edge') {
        const idx = edges.findIndex((e) => e.a === c.a && e.b === c.b);
        const saved = edges.splice(idx, 1)[0];
        if (countSolutions(givens, edges, 2) !== 1) edges.splice(idx, 0, saved);
      } else {
        const saved = givens[c.i];
        givens[c.i] = -1;
        if (countSolutions(givens, edges, 2) !== 1) givens[c.i] = saved;
      }
    }

    return { sol, givens, edges };
  }

  // Crisp themed icons instead of emoji: yellow sun, blue moon.
  const SUN_SVG =
    '<svg class="tg-icon tg-sun" viewBox="0 0 24 24" aria-label="sun">' +
    '<circle cx="12" cy="12" r="4.6" fill="currentColor"/>' +
    '<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
    '<line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/>' +
    '<line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/>' +
    '<line x1="4.6" y1="4.6" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"/>' +
    '<line x1="4.6" y1="19.4" x2="6.4" y2="17.6"/><line x1="17.6" y1="6.4" x2="19.4" y2="4.6"/>' +
    '</g></svg>';
  const MOON_SVG =
    '<svg class="tg-icon tg-moon" viewBox="0 0 24 24" aria-label="moon">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>' +
    '</svg>';
  const GLYPHS = [SUN_SVG, MOON_SVG];

  function create(container, { rng, onWin }) {
    const { givens, edges } = generate(rng);
    const grid = givens.slice(); // -1 empty, 0 sun, 1 moon
    let done = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint">3 suns + 3 moons per row/col · never 3 alike · <b>=</b> match, <b>×</b> differ</span>
        <button class="btn subtle small tg-clear">Clear</button>
      </div>
      <div class="tg-wrap"><div class="tg-grid"></div></div>
    `;
    const gridEl = container.querySelector('.tg-grid');
    gridEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;

    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const b = document.createElement('button');
      b.className = 'tg-cell';
      b.dataset.i = i;
      if (givens[i] !== -1) b.classList.add('tg-given');
      gridEl.appendChild(b);
      cells.push(b);
    }
    for (const e of edges) {
      const m = document.createElement('span');
      m.className = 'tg-mark';
      m.textContent = e.eq ? '=' : '×';
      const ax = e.a % N;
      const ay = (e.a / N) | 0;
      const horizontal = e.b === e.a + 1;
      m.style.left = ((horizontal ? ax + 1 : ax + 0.5) / N) * 100 + '%';
      m.style.top = ((horizontal ? ay + 0.5 : ay + 1) / N) * 100 + '%';
      gridEl.appendChild(m);
    }

    function violations() {
      const bad = new Set();
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const i = y * N + x;
          const v = grid[i];
          if (v === -1) continue;
          if (x >= 2 && grid[i - 1] === v && grid[i - 2] === v) {
            bad.add(i).add(i - 1).add(i - 2);
          }
          if (y >= 2 && grid[i - N] === v && grid[i - 2 * N] === v) {
            bad.add(i).add(i - N).add(i - 2 * N);
          }
        }
      }
      for (let k = 0; k < N; k++) {
        for (const v of [0, 1]) {
          let rc = 0;
          let cc = 0;
          for (let j = 0; j < N; j++) {
            if (grid[k * N + j] === v) rc++;
            if (grid[j * N + k] === v) cc++;
          }
          if (rc > N / 2) for (let j = 0; j < N; j++) if (grid[k * N + j] === v) bad.add(k * N + j);
          if (cc > N / 2) for (let j = 0; j < N; j++) if (grid[j * N + k] === v) bad.add(j * N + k);
        }
      }
      for (const e of edges) {
        if (grid[e.a] !== -1 && grid[e.b] !== -1) {
          const conflict = e.eq ? grid[e.a] !== grid[e.b] : grid[e.a] === grid[e.b];
          if (conflict) bad.add(e.a).add(e.b);
        }
      }
      return bad;
    }

    function render() {
      const bad = violations();
      for (let i = 0; i < N * N; i++) {
        const b = cells[i];
        b.innerHTML = grid[i] === -1 ? '' : GLYPHS[grid[i]];
        b.classList.toggle('tg-bad', bad.has(i));
      }
      if (!done && bad.size === 0 && !grid.includes(-1)) {
        done = true;
        setTimeout(onWin, 350);
      }
    }

    gridEl.addEventListener('click', (e) => {
      const t = e.target.closest('.tg-cell');
      if (!t || done) return;
      const i = Number(t.dataset.i);
      if (givens[i] !== -1) return;
      grid[i] = grid[i] === -1 ? 0 : grid[i] === 0 ? 1 : -1;
      render();
    });
    container.querySelector('.tg-clear').addEventListener('click', () => {
      if (done) return;
      for (let i = 0; i < N * N; i++) if (givens[i] === -1) grid[i] = -1;
      render();
    });

    render();

    return {
      destroy() {
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.tango = {
    key: 'tango',
    name: 'Tango',
    icon: '🌗',
    blurb: 'Fill the grid with suns and moons — balanced rows, no triples, and =/× pairs.',
    create,
    _test: { N, genSolution, countSolutions, generate },
  };
})();
