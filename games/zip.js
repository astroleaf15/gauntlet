/* Gauntlet stage: Zip (LinkedIn-style). Draw one continuous path that visits
 * the numbered dots in order and covers every cell of the grid. */
(() => {
  'use strict';

  const N = 6;

  function orthAdjacent(a, b) {
    const ax = a % N, ay = (a / N) | 0;
    const bx = b % N, by = (b / N) | 0;
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  // Random Hamiltonian path via the backbite algorithm: start from a snake
  // path, then repeatedly reverse a prefix/suffix at a random endpoint.
  function randomHamPath(rng) {
    let path = [];
    for (let y = 0; y < N; y++) {
      if (y % 2 === 0) for (let x = 0; x < N; x++) path.push(y * N + x);
      else for (let x = N - 1; x >= 0; x--) path.push(y * N + x);
    }
    for (let it = 0; it < 600; it++) {
      const fromHead = rng() < 0.5;
      if (!fromHead) path.reverse();
      const head = path[0];
      const nbrs = [];
      for (const c of path) if (orthAdjacent(head, c) && c !== path[1]) nbrs.push(c);
      if (nbrs.length) {
        const v = nbrs[Math.floor(rng() * nbrs.length)];
        const i = path.indexOf(v);
        const prefix = path.slice(0, i).reverse();
        path = prefix.concat(path.slice(i));
      }
      if (!fromHead) path.reverse();
    }
    return path;
  }

  function generate(rng) {
    const sol = randomHamPath(rng);
    const numberAt = new Int8Array(N * N); // 0 = plain, else waypoint order
    const waypointIdx = [0];
    let cur = 0;
    for (;;) {
      cur += 4 + Math.floor(rng() * 4);
      if (cur >= N * N - 2) break;
      waypointIdx.push(cur);
    }
    waypointIdx.push(N * N - 1);
    waypointIdx.forEach((pi, k) => (numberAt[sol[pi]] = k + 1));
    return { sol, numberAt, maxNum: waypointIdx.length };
  }

  function create(container, { rng, onWin }) {
    const { numberAt, maxNum } = generate(rng);
    let path = [];
    let visited = 0; // numbered cells passed, always in order
    let done = false;
    let dragging = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint">Cover every cell, hit <b class="zp-progress">1</b>→<b>${maxNum}</b> in order</span>
        <button class="btn subtle small zp-clear">Clear</button>
      </div>
      <div class="zp-wrap">
        <div class="zp-grid"></div>
        <canvas class="zp-canvas"></canvas>
      </div>
    `;
    const wrap = container.querySelector('.zp-wrap');
    const gridEl = container.querySelector('.zp-grid');
    const canvas = container.querySelector('.zp-canvas');
    const progressEl = container.querySelector('.zp-progress');
    const ctx = canvas.getContext('2d');
    gridEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;

    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const d = document.createElement('div');
      d.className = 'zp-cell';
      if (numberAt[i]) {
        const s = document.createElement('span');
        s.className = 'zp-num';
        s.textContent = numberAt[i];
        d.appendChild(s);
      }
      gridEl.appendChild(d);
      cells.push(d);
    }

    function recountVisited() {
      visited = 0;
      for (const c of path) if (numberAt[c]) visited++;
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = wrap.clientWidth;
      if (!cssW) return;
      if (canvas.width !== Math.round(cssW * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssW * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssW);
      if (!path.length) return;
      const cell = cssW / N;
      const cx = (i) => ((i % N) + 0.5) * cell;
      const cy = (i) => (((i / N) | 0) + 0.5) * cell;
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-2')
        .trim();
      ctx.lineWidth = cell * 0.45;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(cx(path[0]), cy(path[0]));
      for (let k = 1; k < path.length; k++) ctx.lineTo(cx(path[k]), cy(path[k]));
      if (path.length === 1) ctx.lineTo(cx(path[0]), cy(path[0]));
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Head dot
      const head = path[path.length - 1];
      ctx.beginPath();
      ctx.arc(cx(head), cy(head), cell * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    }

    function updateProgress() {
      progressEl.textContent = Math.min(visited + 1, maxNum);
      draw();
    }

    function cellFromEvent(e) {
      const rect = gridEl.getBoundingClientRect();
      const cell = rect.width / N;
      const x = Math.floor((e.clientX - rect.left) / cell);
      const y = Math.floor((e.clientY - rect.top) / cell);
      if (x < 0 || y < 0 || x >= N || y >= N) return null;
      return y * N + x;
    }

    function rejectFlash(i) {
      cells[i].classList.add('zp-reject');
      setTimeout(() => cells[i].classList.remove('zp-reject'), 250);
    }

    function tryExtend(target) {
      const last = path[path.length - 1];
      if (target === path[path.length - 2]) {
        // Backtrack one step.
        path.pop();
        recountVisited();
        updateProgress();
        return;
      }
      if (path.includes(target)) return;
      // Fill straight-line moves so fast drags don't skip cells.
      const steps = [];
      const lx = last % N, ly = (last / N) | 0;
      const tx = target % N, ty = (target / N) | 0;
      if (lx === tx) {
        const dir = ty > ly ? N : -N;
        for (let c = last + dir; ; c += dir) {
          steps.push(c);
          if (c === target) break;
        }
      } else if (ly === ty) {
        const dir = tx > lx ? 1 : -1;
        for (let c = last + dir; ; c += dir) {
          steps.push(c);
          if (c === target) break;
        }
      } else if (orthAdjacent(last, target)) {
        steps.push(target);
      } else {
        return;
      }
      for (const c of steps) {
        if (path.includes(c)) return;
        const num = numberAt[c];
        if (num) {
          if (num !== visited + 1) {
            rejectFlash(c);
            return;
          }
          if (num === maxNum && path.length !== N * N - 1) {
            rejectFlash(c);
            return;
          }
        }
        path.push(c);
        if (num) visited++;
      }
      updateProgress();
      if (path.length === N * N && visited === maxNum) {
        done = true;
        dragging = false;
        canvas.classList.add('zp-won');
        setTimeout(onWin, 400);
      }
    }

    const onDown = (e) => {
      if (done) return;
      const c = cellFromEvent(e);
      if (c === null) return;
      wrap.setPointerCapture(e.pointerId);
      if (!path.length) {
        if (numberAt[c] === 1) {
          path = [c];
          visited = 1;
          dragging = true;
          updateProgress();
        } else {
          rejectFlash(c);
        }
        return;
      }
      const idx = path.indexOf(c);
      if (idx >= 0) {
        path = path.slice(0, idx + 1);
        recountVisited();
        dragging = true;
        updateProgress();
      } else if (orthAdjacent(c, path[path.length - 1])) {
        dragging = true;
        tryExtend(c);
      }
    };
    const onMove = (e) => {
      if (!dragging || done) return;
      const c = cellFromEvent(e);
      if (c === null || c === path[path.length - 1]) return;
      tryExtend(c);
    };
    const onUp = () => {
      dragging = false;
    };

    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', onUp);
    wrap.addEventListener('pointercancel', onUp);
    container.querySelector('.zp-clear').addEventListener('click', () => {
      if (done) return;
      path = [];
      visited = 0;
      updateProgress();
    });

    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    draw();

    return {
      destroy() {
        ro.disconnect();
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.zip = {
    key: 'zip',
    name: 'Zip',
    icon: '➿',
    blurb: 'Drag one path from 1 through every number in order — covering every single cell.',
    create,
    _test: { N, randomHamPath, generate, orthAdjacent },
  };
})();
