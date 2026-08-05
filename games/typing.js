/* Gauntlet stage: Typing sprint. Type the passage exactly — wrong keystrokes
 * simply don't advance, so accuracy is speed. */
(() => {
  'use strict';

  const WORD_COUNT = 24;
  const WORDS = (
    'the be to of and a in that have it for not on with he as you do at this ' +
    'but his by from they we say her she or an will my one all would there ' +
    'their what so up out if about who get which go me when make can like ' +
    'time no just him know take people into year your good some could them ' +
    'see other than then now look only come its over think also back after ' +
    'use two how our work first well way even new want because any these ' +
    'give day most us great where much through long might never house world ' +
    'still own last right off found small every sound place little very ' +
    'again life name form part turn same mean keep show land here need big ' +
    'high such follow act why ask men change went light kind between own ' +
    'below country plant school father tree start city earth eye story sea ' +
    'left late run open seem together next white children begin got walk ' +
    'example paper group always music those both mark often letter until ' +
    'mile river car feet care second book carry took science eat room ' +
    'friend began idea fish mountain stop once base hear horse cut sure ' +
    'watch color face wood main enough plain girl usual young ready above ' +
    'ever red list though feel talk bird soon body dog family direct pose ' +
    'leave song measure door product black short numeral class wind question ' +
    'happen complete ship area half rock order fire south problem piece told ' +
    'knew pass since top whole king space heard best hour better true during ' +
    'hundred five remember step early hold west ground interest reach fast ' +
    'verb sing listen six table travel less morning ten simple several ' +
    'vowel toward war lay against pattern slow center love person money ' +
    'serve appear road map rain rule govern pull cold notice voice unit ' +
    'power town fine certain fly fall lead cry dark machine note wait plan ' +
    'figure star box noun field rest correct able pound done beauty drive ' +
    'stood contain front teach week final gave green quick develop ocean'
  ).split(/\s+/);

  function makePassage(rng) {
    const out = [];
    let prev = '';
    while (out.length < WORD_COUNT) {
      const w = WORDS[Math.floor(rng() * WORDS.length)];
      if (w === prev) continue;
      out.push(w);
      prev = w;
    }
    return out.join(' ');
  }

  function create(container, { rng, onWin }) {
    const passage = makePassage(rng);
    let pos = 0;
    let startedAt = null;
    let done = false;

    container.innerHTML = `
      <div class="stage-top">
        <span class="stage-hint"><b class="tp-wpm">–</b> wpm · <b class="tp-progress">0%</b></span>
        <span class="stage-hint">mistakes don't advance</span>
      </div>
      <div class="tp-text" tabindex="0"></div>
      <input class="tp-input" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Type the passage">
      <p class="tp-hint-line">Click the text and start typing.</p>
    `;
    const textEl = container.querySelector('.tp-text');
    const inputEl = container.querySelector('.tp-input');
    const wpmEl = container.querySelector('.tp-wpm');
    const progressEl = container.querySelector('.tp-progress');
    const hintEl = container.querySelector('.tp-hint-line');

    const charEls = [];
    for (const ch of passage) {
      const s = document.createElement('span');
      s.textContent = ch;
      if (ch === ' ') s.className = 'tp-space';
      textEl.appendChild(s);
      charEls.push(s);
    }

    function paint() {
      for (let i = 0; i < charEls.length; i++) {
        charEls[i].classList.toggle('tp-done', i < pos);
        charEls[i].classList.toggle('tp-cur', i === pos);
      }
      progressEl.textContent = Math.floor((pos / passage.length) * 100) + '%';
      if (startedAt && pos > 0) {
        const mins = (Date.now() - startedAt) / 60000;
        wpmEl.textContent = Math.round(pos / 5 / Math.max(mins, 1 / 60));
      }
    }

    function acceptChar(ch) {
      if (done) return;
      if (startedAt === null) startedAt = Date.now();
      if (ch === passage[pos]) {
        pos++;
        if (pos === passage.length) {
          done = true;
          paint();
          setTimeout(onWin, 350);
          return;
        }
      } else {
        const el = charEls[pos];
        el.classList.remove('tp-wrong');
        void el.offsetWidth;
        el.classList.add('tp-wrong');
      }
      paint();
    }

    const onKeydown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1) {
        e.preventDefault();
        acceptChar(e.key);
      }
    };
    // Mobile keyboards often deliver text via input events instead of
    // meaningful keydowns — take the last inserted char and reset the field.
    const onInput = () => {
      const v = inputEl.value;
      if (v) acceptChar(v[v.length - 1]);
      inputEl.value = '';
    };
    const focusInput = () => {
      inputEl.focus({ preventScroll: true });
      hintEl.textContent = ' ';
    };

    inputEl.addEventListener('keydown', onKeydown);
    inputEl.addEventListener('input', onInput);
    textEl.addEventListener('click', focusInput);
    textEl.addEventListener('keydown', onKeydown);
    setTimeout(focusInput, 50);

    const tick = setInterval(paint, 1000);
    paint();

    return {
      destroy() {
        clearInterval(tick);
        container.innerHTML = '';
      },
    };
  }

  window.GauntletGames.typing = {
    key: 'typing',
    name: 'Typing Sprint',
    icon: '⌨️',
    blurb: 'Type the passage exactly — wrong keys don\'t advance, accuracy is speed.',
    create,
    _test: { makePassage, WORDS },
  };
})();
