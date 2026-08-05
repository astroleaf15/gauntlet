/* Gauntlet stage: Minesweeper (11×11, 15 mines). First click is always safe,
 * and boards are vetted so they can be fully cleared by pure deduction — no
 * guessing ever required. Hitting a mine deals a fresh board; the run clock
 * keeps ticking. */
(() => {
  'use strict';

  const W = 11;
  const H = 11;
  const MINES = 15;
  const GEN_ATTEMPTS = 600;

  function neighborsOf(i) {
    const x = i % W;
    const y = (i / W) | 0;
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) out.push(ny * W + nx);
      }
    }
    return out;
  }
  const NEIGHBORS = Array.from({ length: W * H }, (_, i) => neighborsOf(i));

  function makeCounts(mines) {
    const counts = new Int8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      counts[i] = mines[i] ? -1 : NEIGHBORS[i].filter((n) => mines[n]).length;
    }
    return counts;
  }

  // Can this layout be fully cleared from `start` by deduction alone?
  // Rules used: (a) a satisfied number's unknowns are safe, (b) a number
  // whose remaining count equals its unknowns marks them all as mines,
  // (c) subset rule — if constraint A's cells ⊂ B's cells, the difference
  // is forced. These are exactly the deductions a human can make locally.
  function solvableWithoutGuessing(mines, counts, start) {
    const open = new Uint8Array(W * H);
    const known = new Uint8Array(W * H); // deduced mines
    let openCount = 0;

    function flood(i) {
      const stack = [i];
      while (stack.length) {
        const c = stack.pop();
        if (open[c]) continue;
        open[c] = 1;
        openCount++;
        if (counts[c] === 0) for (const n of NEIGHBORS[c]) if (!open[n]) stack.push(n);
      }
    }
    flood(start);

    for (;;) {
      if (openCount === W * H - MINES) return true;
      let progress = false;
      const cons = [];
      for (let i = 0; i < W * H; i++) {
        if (!open[i] || counts[i] <= 0) continue;
        const unk = [];
        let rem = counts[i];
        for (const n of NEIGHBORS[i]) {
          if (known[n]) rem--;
          else if (!open[n]) unk.push(n);
        }
        if (!unk.length) continue;
        if (rem === 0) {
          for (const n of unk) if (!open[n]) flood(n);
          progress = true;
        } else if (rem === unk.length) {
          for (const n of unk) {
            if (!known[n]) {
              known[n] = 1;
              progress = true;
            }
          }
        } else {
          cons.push({ cells: unk, n: rem });
        }
      }
      if (progress) continue;

      // Subset rule.
      outer: for (let a = 0; a < cons.length && !progress; a++) {
        for (let b = 0; b < cons.length; b++) {
          if (a === b) continue;
          const A = cons[a];
          const B = cons[b];
          if (A.cells.length >= B.cells.length) continue;
          const bset = new Set(B.cells);
          if (!A.cells.every((c) => bset.has(c))) continue;
          const diff = B.cells.filter((c) => !A.cells.includes(c));
          if (B.n - A.n === diff.length) {
            for (const c of diff) known[c] = 1;
            progress = true;
            break outer;
          }
          if (B.n === A.n) {
            for (const c of diff) if (!open[c]) flood(c);
            progress = true;
            break outer;
          }
        }
      }
      if (!progress) return false;
    }
  }

  function create(container, { rng, onWin }) {
    let mines = null; // Uint8Array, placed on first reveal
    let open = new Uint8Array(W * H);
    let flags = new Uint8Array(W * H);
    let counts = new Int8Array(W * H);
    let done = false;
    let booming = false;
    let flagMode = false;
    let attempt = 1;
    let pressTimer = null;
    let suppressClick = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint">💣 <b class="ms-count">${MINES}</b> · attempt <b class="ms-attempt">1</b> · <span class="ms-noguess">no guessing needed</span></span>
        <button class="btn subtle small ms-flagmode" title="Toggle flag mode (or right-click / long-press a cell)">🚩 off</button>
      </div>
      <div class="ms-wrap">
        <div class="ms-grid" role="grid"></div>
        <div class="ms-boom" hidden><div class="ms-boom-card">💥 Boom!<span>new board…</span></div></div>
      </div>
    `;
    const gridEl = container.querySelector('.ms-grid');
    const boomEl = container.querySelector('.ms-boom');
    const countEl = container.querySelector('.ms-count');
    const attemptEl = container.querySelector('.ms-attempt');
    const flagBtn = container.querySelector('.ms-flagmode');
    gridEl.style.gridTemplateColumns = `repeat(${W}, 1fr)`;

    const cells = [];
    for (let i = 0; i < W * H; i++) {
      const b = document.createElement('button');
      b.className = 'ms-cell';
      b.dataset.i = i;
      gridEl.appendChild(b);
      cells.push(b);
    }

    function placeMines(safe) {
      const banned = new Set([safe, ...NEIGHBORS[safe]]);
      const pool = [];
      for (let i = 0; i < W * H; i++) if (!banned.has(i)) pool.push(i);
      let fallback = null;
      for (let attemptNo = 0; attemptNo < GEN_ATTEMPTS; attemptNo++) {
        window.GCore.shuffle(pool, rng);
        const m = new Uint8Array(W * H);
        for (let k = 0; k < MINES; k++) m[pool[k]] = 1;
        const c = makeCounts(m);
        fallback = { m, c };
        if (solvableWithoutGuessing(m, c, safe)) break;
      }
      mines = fallback.m;
      counts = fallback.c;
    }

    function resetBoard() {
      mines = null;
      open = new Uint8Array(W * H);
      flags = new Uint8Array(W * H);
      counts = new Int8Array(W * H);
      booming = false;
      attempt++;
      attemptEl.textContent = attempt;
      render();
    }

    function reveal(i) {
      if (open[i] || flags[i]) return;
      if (mines === null) placeMines(i);
      if (mines[i]) {
        boom(i);
        return;
      }
      const stack = [i];
      while (stack.length) {
        const c = stack.pop();
        if (open[c] || flags[c]) continue;
        open[c] = 1;
        if (counts[c] === 0) for (const n of NEIGHBORS[c]) if (!open[n]) stack.push(n);
      }
      checkWin();
    }

    function chord(i) {
      const flagCount = NEIGHBORS[i].filter((n) => flags[n]).length;
      if (flagCount !== counts[i]) return;
      for (const n of NEIGHBORS[i]) {
        if (!flags[n] && !open[n]) {
          if (mines[n]) {
            boom(n);
            return;
          }
          reveal(n);
        }
        if (booming || done) return;
      }
    }

    function boom(i) {
      booming = true;
      open[i] = 1;
      for (let c = 0; c < W * H; c++) if (mines[c]) open[c] = 1;
      render();
      cells[i].classList.add('ms-hit');
      boomEl.hidden = false;
      setTimeout(() => {
        if (done) return;
        boomEl.hidden = true;
        resetBoard();
      }, 1100);
    }

    function checkWin() {
      let openCount = 0;
      for (let i = 0; i < W * H; i++) if (open[i]) openCount++;
      if (openCount === W * H - MINES) {
        done = true;
        for (let i = 0; i < W * H; i++) if (mines[i]) flags[i] = 1;
        render();
        setTimeout(onWin, 350);
      }
    }

    function render() {
      let flagCount = 0;
      for (let i = 0; i < W * H; i++) {
        const b = cells[i];
        b.className = 'ms-cell';
        b.textContent = '';
        if (flags[i] && !open[i]) {
          b.classList.add('ms-flag');
          b.textContent = '🚩';
          flagCount++;
        } else if (open[i]) {
          b.classList.add('ms-open');
          if (mines && mines[i]) {
            b.classList.add('ms-mine');
            b.textContent = '💣';
          } else if (counts[i] > 0) {
            b.textContent = counts[i];
            b.classList.add('ms-n' + counts[i]);
          }
        }
      }
      countEl.textContent = Math.max(0, MINES - flagCount);
    }

    function toggleFlag(i) {
      if (open[i] || booming || done) return;
      flags[i] = flags[i] ? 0 : 1;
      render();
    }

    function act(i) {
      if (booming || done) return;
      if (flags[i]) return;
      if (open[i]) {
        if (counts[i] > 0) {
          chord(i);
          if (!booming && !done) render();
        }
        return;
      }
      reveal(i);
      if (!booming && !done) render();
    }

    function cellIndex(e) {
      const t = e.target.closest('.ms-cell');
      return t ? Number(t.dataset.i) : null;
    }

    const onClick = (e) => {
      const i = cellIndex(e);
      if (i === null) return;
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (flagMode && !open[i]) toggleFlag(i);
      else act(i);
    };
    const onContext = (e) => {
      const i = cellIndex(e);
      if (i === null) return;
      e.preventDefault();
      toggleFlag(i);
    };
    const onPointerDown = (e) => {
      if (e.pointerType !== 'touch') return;
      const i = cellIndex(e);
      if (i === null) return;
      pressTimer = setTimeout(() => {
        suppressClick = true;
        toggleFlag(i);
        if (navigator.vibrate) navigator.vibrate(30);
      }, 400);
    };
    const cancelPress = () => clearTimeout(pressTimer);

    gridEl.addEventListener('click', onClick);
    gridEl.addEventListener('contextmenu', onContext);
    gridEl.addEventListener('pointerdown', onPointerDown);
    gridEl.addEventListener('pointerup', cancelPress);
    gridEl.addEventListener('pointerleave', cancelPress);
    gridEl.addEventListener('pointermove', cancelPress);
    flagBtn.addEventListener('click', () => {
      flagMode = !flagMode;
      flagBtn.textContent = flagMode ? '🚩 on' : '🚩 off';
      flagBtn.classList.toggle('active', flagMode);
    });

    render();

    return {
      destroy() {
        clearTimeout(pressTimer);
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.minesweeper = {
    key: 'minesweeper',
    name: 'Minesweeper',
    icon: '💣',
    blurb: 'Clear all safe cells — every board is solvable without guessing. Boom = fresh board, clock keeps running.',
    create,
    _test: { W, H, MINES, NEIGHBORS, makeCounts, solvableWithoutGuessing },
  };
})();
