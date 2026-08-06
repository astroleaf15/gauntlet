/* Gauntlet stage: Word Hunt. A 4×4 Boggle-dice board — drag through adjacent
 * letters to make words (3+ letters, ENABLE dictionary). Reach the target
 * score to advance. Boards are vetted to have plenty of points available. */
(() => {
  'use strict';

  const SIZE = 4;
  const TARGET = 5000;
  // Classic 16 Boggle dice ("new" distribution); Q plays as Qu.
  const DICE = [
    'aaeegn', 'abbjoo', 'achops', 'affkps',
    'aoottw', 'cimotu', 'deilrx', 'delrvy',
    'distty', 'eeghnw', 'eeinsu', 'ehrtvw',
    'eiosst', 'elrtty', 'himnqu', 'hlnnrz',
  ];
  const POINTS = { 3: 100, 4: 400, 5: 800, 6: 1400, 7: 1800, 8: 2200 };

  let DICT = null; // Set of all words (built lazily on first stage create)

  function tileLetters(rng) {
    const dice = window.GCore.shuffle(DICE.slice(), rng);
    return dice.map((d) => {
      const c = d[Math.floor(rng() * d.length)];
      return c === 'q' ? 'qu' : c;
    });
  }

  function neighborsOf(i) {
    const x = i % SIZE;
    const y = (i / SIZE) | 0;
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) out.push(ny * SIZE + nx);
      }
    }
    return out;
  }
  const NEIGHBORS = Array.from({ length: SIZE * SIZE }, (_, i) => neighborsOf(i));

  function wordPoints(word) {
    return POINTS[Math.min(word.length, 8)] || 0;
  }

  // Every dictionary word findable on this board, via prefix-pruned DFS.
  function solveBoard(tiles) {
    const letterSet = new Set(tiles.join(''));
    const candidates = [];
    for (const w of DICT) {
      let ok = true;
      for (const ch of w) {
        if (!letterSet.has(ch)) {
          ok = false;
          break;
        }
      }
      if (ok) candidates.push(w);
    }
    const words = new Set(candidates);
    const prefixes = new Set();
    for (const w of candidates) {
      for (let l = 1; l < w.length; l++) prefixes.add(w.slice(0, l));
    }
    const found = new Set();
    const used = new Array(SIZE * SIZE).fill(false);
    function dfs(i, cur) {
      const next = cur + tiles[i];
      if (next.length > 8) return;
      if (next.length >= 3 && words.has(next)) found.add(next);
      if (!prefixes.has(next)) return;
      used[i] = true;
      for (const n of NEIGHBORS[i]) if (!used[n]) dfs(n, next);
      used[i] = false;
    }
    for (let i = 0; i < SIZE * SIZE; i++) dfs(i, '');
    return found;
  }

  function generateBoard(rng) {
    let best = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const tiles = tileLetters(rng);
      const found = solveBoard(tiles);
      let total = 0;
      for (const w of found) total += wordPoints(w);
      if (!best || total > best.total) best = { tiles, total, wordCount: found.size };
      if (total >= TARGET * 3 && found.size >= 80) return best.tiles === tiles ? best : { tiles, total, wordCount: found.size };
    }
    return best;
  }

  function create(container, { rng, onWin }) {
    if (!DICT) DICT = new Set(window.WH_DICT.split('\n').filter(Boolean));
    const board = generateBoard(rng);
    const tiles = board.tiles;
    const found = [];
    let score = 0;
    let done = false;
    let chain = []; // tile indices in current drag
    let dragging = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint"><b class="wh-score">0</b> / ${TARGET} pts</span>
        <span class="stage-hint wh-current">&nbsp;</span>
      </div>
      <div class="wh-bar"><div class="wh-bar-fill"></div></div>
      <div class="wh-wrap">
        <div class="wh-grid"></div>
        <canvas class="wh-canvas"></canvas>
      </div>
      <div class="wh-found"></div>
    `;
    const wrapEl = container.querySelector('.wh-wrap');
    const canvas = container.querySelector('.wh-canvas');
    const traceCtx = canvas.getContext('2d');
    const gridEl = container.querySelector('.wh-grid');
    const scoreEl = container.querySelector('.wh-score');
    const currentEl = container.querySelector('.wh-current');
    const barEl = container.querySelector('.wh-bar-fill');
    const foundEl = container.querySelector('.wh-found');

    const cellEls = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const d = document.createElement('div');
      d.className = 'wh-cell';
      d.textContent = tiles[i].toUpperCase();
      gridEl.appendChild(d);
      cellEls.push(d);
    }

    function chainWord() {
      return chain.map((i) => tiles[i]).join('');
    }

    // The trace line: drawn through the centers of the chained tiles while
    // dragging, flashed green/red on release so you can see the word's shape.
    let traceTimer = null;
    function drawTrace(indices, color) {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrapEl.getBoundingClientRect();
      if (!rect.width) return;
      if (canvas.width !== Math.round(rect.width * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      traceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      traceCtx.clearRect(0, 0, rect.width, rect.height);
      if (indices.length === 0) return;
      const pts = indices.map((i) => {
        const r = cellEls[i].getBoundingClientRect();
        return [r.left - rect.left + r.width / 2, r.top - rect.top + r.height / 2];
      });
      traceCtx.lineWidth = Math.max(6, pts.length ? cellEls[0].getBoundingClientRect().width * 0.14 : 8);
      traceCtx.lineCap = 'round';
      traceCtx.lineJoin = 'round';
      traceCtx.strokeStyle = color;
      traceCtx.fillStyle = color;
      traceCtx.globalAlpha = 0.6;
      traceCtx.beginPath();
      traceCtx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) traceCtx.lineTo(pts[k][0], pts[k][1]);
      traceCtx.stroke();
      for (const [x, y] of pts) {
        traceCtx.beginPath();
        traceCtx.arc(x, y, traceCtx.lineWidth * 0.55, 0, Math.PI * 2);
        traceCtx.fill();
      }
      traceCtx.globalAlpha = 1;
    }
    function traceColor() {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim();
    }
    function flashTrace(color) {
      clearTimeout(traceTimer);
      drawTrace(chain, color);
      traceTimer = setTimeout(() => drawTrace([], '#000'), 300);
    }

    function updateCurrent() {
      const w = chainWord();
      if (!w) {
        currentEl.innerHTML = '&nbsp;';
        return;
      }
      const pts = w.length >= 3 && DICT.has(w) && !found.includes(w) ? wordPoints(w) : 0;
      currentEl.textContent = w.toUpperCase() + (pts ? ` (+${pts})` : '');
    }

    function setChainClass(cls) {
      for (const i of chain) cellEls[i].classList.add(cls);
      const snapshot = chain.slice();
      setTimeout(() => {
        for (const i of snapshot) cellEls[i].classList.remove(cls);
      }, 280);
    }

    function tileFromEvent(e) {
      const rect = gridEl.getBoundingClientRect();
      const cell = rect.width / SIZE;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const x = Math.floor(px / cell);
      const y = Math.floor(py / cell);
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
      // Require the pointer near the tile center so diagonal drags don't
      // clip tiles the player didn't mean to touch.
      const cxp = (x + 0.5) * cell;
      const cyp = (y + 0.5) * cell;
      if (Math.hypot(px - cxp, py - cyp) > cell * 0.42) return null;
      return y * SIZE + x;
    }

    const onDown = (e) => {
      if (done) return;
      const t = tileFromEvent(e);
      if (t === null) return;
      gridEl.setPointerCapture(e.pointerId);
      dragging = true;
      chain = [t];
      cellEls[t].classList.add('wh-sel');
      clearTimeout(traceTimer);
      drawTrace(chain, traceColor());
      updateCurrent();
    };
    const onMove = (e) => {
      if (!dragging || done) return;
      const t = tileFromEvent(e);
      if (t === null) return;
      const last = chain[chain.length - 1];
      if (t === last) return;
      if (chain.length > 1 && t === chain[chain.length - 2]) {
        cellEls[last].classList.remove('wh-sel');
        chain.pop();
        drawTrace(chain, traceColor());
        updateCurrent();
        return;
      }
      if (!chain.includes(t) && NEIGHBORS[last].includes(t)) {
        chain.push(t);
        cellEls[t].classList.add('wh-sel');
        drawTrace(chain, traceColor());
        updateCurrent();
      }
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      const w = chainWord();
      for (const i of chain) cellEls[i].classList.remove('wh-sel');
      if (w.length >= 3 && DICT.has(w) && !found.includes(w)) {
        found.push(w);
        score += wordPoints(w);
        setChainClass('wh-good');
        flashTrace('#5c9c46');
        scoreEl.textContent = score;
        barEl.style.width = Math.min(100, (score / TARGET) * 100) + '%';
        const chip = document.createElement('span');
        chip.className = 'wh-chip';
        chip.textContent = `${w.toUpperCase()} +${wordPoints(w)}`;
        foundEl.prepend(chip);
        if (score >= TARGET && !done) {
          done = true;
          setTimeout(onWin, 400);
        }
      } else if (w.length >= 3) {
        setChainClass('wh-bad');
        flashTrace(
          getComputedStyle(document.documentElement).getPropertyValue('--bad-stroke').trim()
        );
      } else {
        drawTrace([], '#000');
      }
      chain = [];
      updateCurrent();
    };

    gridEl.addEventListener('pointerdown', onDown);
    gridEl.addEventListener('pointermove', onMove);
    gridEl.addEventListener('pointerup', onUp);
    gridEl.addEventListener('pointercancel', onUp);

    return {
      destroy() {
        clearTimeout(traceTimer);
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.wordhunt = {
    key: 'wordhunt',
    name: 'Word Hunt',
    icon: '🔤',
    blurb: `Drag through adjacent letters to spell words. Score ${TARGET} points to move on.`,
    create,
    _test: {
      SIZE,
      TARGET,
      tileLetters,
      wordPoints,
      solveBoard: (tiles, dictSet) => {
        DICT = dictSet;
        return solveBoard(tiles);
      },
      generateBoard: (rng, dictSet) => {
        DICT = dictSet;
        return generateBoard(rng);
      },
    },
  };
})();
