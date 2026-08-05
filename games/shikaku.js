/* Gauntlet stage: Shikaku (7×7). Drag to draw boxes; each box holds exactly
 * one number equal to its area; tile the whole grid to win. */
(() => {
  'use strict';

  const SIZE = 7;

  function create(container, { rng, onWin }) {
    const puzzle = window.ShikakuCore.generatePuzzle(
      SIZE,
      SIZE,
      Math.floor(rng() * 0xffffffff) >>> 0
    );
    let rects = [];
    let drag = null;
    let won = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint">Boxes: <b class="sk-progress">0 / ${puzzle.clues.length}</b></span>
        <button class="btn subtle small sk-clear">Clear</button>
      </div>
      <div class="sk-wrap"><canvas class="sk-board"></canvas></div>
    `;
    const wrap = container.querySelector('.sk-wrap');
    const canvas = container.querySelector('.sk-board');
    const progressEl = container.querySelector('.sk-progress');
    const ctx = canvas.getContext('2d');
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const PAD = 10;

    if (!ctx.roundRect) {
      ctx.roundRect = function (x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
      };
    }

    const cssVar = (n) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const rectHue = (i) => (i * 137.508 + 210) % 360;

    function cluesInRect(r) {
      return puzzle.clues.filter(
        (c) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h
      );
    }
    function rectValid(r) {
      const cs = cluesInRect(r);
      return cs.length === 1 && cs[0].n === r.w * r.h;
    }
    function isSolved() {
      return (
        rects.reduce((a, r) => a + r.w * r.h, 0) === SIZE * SIZE &&
        rects.every(rectValid)
      );
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = wrap.clientWidth;
      if (!cssW) return;
      const cell = (cssW - PAD * 2) / SIZE;
      if (canvas.width !== Math.round(cssW * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssW * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dark = darkQuery.matches;
      const gx = (v) => PAD + v * cell;
      ctx.clearRect(0, 0, cssW, cssW);

      ctx.lineWidth = 1;
      ctx.strokeStyle = cssVar('--grid-line');
      ctx.beginPath();
      for (let i = 1; i < SIZE; i++) {
        ctx.moveTo(gx(i), gx(0));
        ctx.lineTo(gx(i), gx(SIZE));
        ctx.moveTo(gx(0), gx(i));
        ctx.lineTo(gx(SIZE), gx(i));
      }
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = cssVar('--grid-line-strong');
      ctx.strokeRect(gx(0), gx(0), cell * SIZE, cell * SIZE);

      const sat = cssVar('--rect-sat');
      const light = cssVar('--rect-light');
      const strokeLight = cssVar('--rect-stroke-light');
      for (const r of rects) {
        const cs = cluesInRect(r);
        const valid = cs.length === 1 && cs[0].n === r.w * r.h;
        const inset = 2.5;
        ctx.beginPath();
        ctx.roundRect(
          gx(r.x) + inset,
          gx(r.y) + inset,
          r.w * cell - inset * 2,
          r.h * cell - inset * 2,
          Math.min(8, cell * 0.25)
        );
        if (valid) {
          const hue = rectHue(puzzle.clues.indexOf(cs[0]));
          ctx.fillStyle = `hsl(${hue}, ${sat}, ${light})`;
          ctx.strokeStyle = `hsl(${hue}, 65%, ${strokeLight})`;
        } else {
          ctx.fillStyle = cssVar('--bad-fill');
          ctx.strokeStyle = cssVar('--bad-stroke');
        }
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (drag) {
        const x0 = Math.min(drag.ax, drag.bx);
        const y0 = Math.min(drag.ay, drag.by);
        const x1 = Math.max(drag.ax, drag.bx);
        const y1 = Math.max(drag.ay, drag.by);
        const inset = 2.5;
        ctx.beginPath();
        ctx.roundRect(
          gx(x0) + inset,
          gx(y0) + inset,
          (x1 - x0 + 1) * cell - inset * 2,
          (y1 - y0 + 1) * cell - inset * 2,
          Math.min(8, cell * 0.25)
        );
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = cssVar('--accent');
        ctx.fillStyle = dark ? 'rgba(118, 134, 240, 0.12)' : 'rgba(91, 110, 225, 0.08)';
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(cell * 0.42)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      for (let i = 0; i < puzzle.clues.length; i++) {
        const c = puzzle.clues[i];
        const home = rects.find(
          (r) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h
        );
        if (home && rectValid(home) && cluesInRect(home)[0] === c) {
          const hue = rectHue(i);
          ctx.fillStyle = dark ? `hsl(${hue}, 60%, 78%)` : `hsl(${hue}, 55%, 32%)`;
        } else {
          ctx.fillStyle = cssVar('--clue-ink');
        }
        ctx.fillText(String(c.n), gx(c.x) + cell / 2, gx(c.y) + cell / 2 + 1);
      }

      progressEl.textContent = `${rects.filter(rectValid).length} / ${puzzle.clues.length}`;
    }

    function cellFromEvent(e, clamp) {
      const rect = canvas.getBoundingClientRect();
      const cell = (rect.width - PAD * 2) / SIZE;
      let x = Math.floor((e.clientX - rect.left - PAD) / cell);
      let y = Math.floor((e.clientY - rect.top - PAD) / cell);
      if (clamp) {
        x = Math.max(0, Math.min(SIZE - 1, x));
        y = Math.max(0, Math.min(SIZE - 1, y));
        return { x, y };
      }
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
      return { x, y };
    }

    function onDown(e) {
      if (won) return;
      const c = cellFromEvent(e, false);
      if (!c) return;
      drag = { ax: c.x, ay: c.y, bx: c.x, by: c.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
      draw();
    }
    function onMove(e) {
      if (!drag) return;
      const c = cellFromEvent(e, true);
      if (c.x !== drag.bx || c.y !== drag.by) {
        drag.bx = c.x;
        drag.by = c.y;
        if (c.x !== drag.ax || c.y !== drag.ay) drag.moved = true;
        draw();
      }
    }
    function endDrag(commit) {
      if (!drag) return;
      const x = Math.min(drag.ax, drag.bx);
      const y = Math.min(drag.ay, drag.by);
      const w = Math.abs(drag.bx - drag.ax) + 1;
      const h = Math.abs(drag.by - drag.ay) + 1;
      const isClick = !drag.moved && w === 1 && h === 1;
      drag = null;
      if (commit) {
        if (isClick) {
          const idx = rects.findIndex(
            (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
          );
          if (idx >= 0) rects.splice(idx, 1);
        } else if (w > 1 || h > 1) {
          rects = rects.filter(
            (r) => r.x + r.w <= x || x + w <= r.x || r.y + r.h <= y || y + h <= r.y
          );
          rects.push({ x, y, w, h });
        }
        if (!won && isSolved()) {
          won = true;
          draw();
          setTimeout(onWin, 350);
          return;
        }
      }
      draw();
    }
    const onUp = () => endDrag(true);
    const onCancel = () => endDrag(false);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    container.querySelector('.sk-clear').addEventListener('click', () => {
      if (won) return;
      rects = [];
      draw();
    });

    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    const onTheme = () => draw();
    darkQuery.addEventListener('change', onTheme);
    draw();

    return {
      destroy() {
        ro.disconnect();
        darkQuery.removeEventListener('change', onTheme);
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.shikaku = {
    key: 'shikaku',
    name: 'Shikaku',
    icon: '🟦',
    blurb: 'Drag boxes so each number sits alone in a box of exactly that area.',
    create,
  };
})();
