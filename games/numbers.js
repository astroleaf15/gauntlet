/* Gauntlet stage: Numbers rush. 1–100 scattered on a 10×10 grid — click them
 * in order as fast as you can. */
(() => {
  'use strict';

  const N = 100;

  function create(container, { rng, onWin }) {
    const order = window.GCore.shuffle(
      Array.from({ length: N }, (_, i) => i + 1),
      rng
    );
    let next = 1;
    let done = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint">Find <b class="nm-next">1</b></span>
        <span class="stage-hint nm-done-label"><b class="nm-found">0</b> / ${N}</span>
      </div>
      <div class="nm-grid"></div>
    `;
    const gridEl = container.querySelector('.nm-grid');
    const nextEl = container.querySelector('.nm-next');
    const foundEl = container.querySelector('.nm-found');

    for (const n of order) {
      const b = document.createElement('button');
      b.className = 'nm-cell';
      b.textContent = n;
      b.dataset.n = n;
      gridEl.appendChild(b);
    }

    const onClick = (e) => {
      const b = e.target.closest('.nm-cell');
      if (!b || done || b.classList.contains('found')) return;
      const n = Number(b.dataset.n);
      if (n === next) {
        b.classList.add('found');
        b.style.setProperty('--found-hue', String((n * 3.6 + 210) % 360));
        next++;
        foundEl.textContent = n;
        if (next > N) {
          done = true;
          nextEl.textContent = '✓';
          setTimeout(onWin, 350);
        } else {
          nextEl.textContent = next;
        }
      } else {
        b.classList.remove('shake-bad');
        void b.offsetWidth; // restart the animation
        b.classList.add('shake-bad');
      }
    };
    gridEl.addEventListener('click', onClick);

    return {
      destroy() {
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.numbers = {
    key: 'numbers',
    name: 'Numbers Rush',
    icon: '🔢',
    blurb: 'Click 1 through 100 in order. Wrong clicks just cost you time.',
    create,
  };
})();
