/* The Gauntlet orchestrator: intro → 3 stages on one clock → results. */
(() => {
  'use strict';

  const { hashString, mulberry32, fmtTime, todayStr } = window.GCore;
  const PAGE_URL = 'https://astroleaf15.github.io/gauntlet/';
  const STAGES = [
    window.GauntletGames.shikaku,
    window.GauntletGames.minesweeper,
    window.GauntletGames.zip,
    window.GauntletGames.wordhunt,
    window.GauntletGames.tango,
    window.GauntletGames.horse,
    window.GauntletGames.typing,
    window.GauntletGames.numbers,
  ];

  const screenEl = document.getElementById('screen');
  const runStatusEl = document.getElementById('runStatus');
  const stageLabelEl = document.getElementById('stageLabel');
  const runTimerEl = document.getElementById('runTimer');
  const restartBtn = document.getElementById('restartBtn');

  let run = null; // {practice, seedBase, stageIdx, startStamp, cums: [], game}

  // --- Persistence ---------------------------------------------------------

  function dayKey(dateStr) {
    return 'gauntlet-daily-' + dateStr;
  }

  function savedDaily(dateStr) {
    try {
      const v = localStorage.getItem(dayKey(dateStr));
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }

  function saveDaily(total, splits) {
    const key = todayStr();
    const prev = savedDaily(key);
    if (!prev || total < prev.total) {
      localStorage.setItem(dayKey(key), JSON.stringify({ total, splits }));
    }
  }

  function computeStreak() {
    let streak = 0;
    const d = new Date();
    for (;;) {
      const key =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
      if (!savedDaily(key)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // --- Clock ---------------------------------------------------------------

  function runElapsed() {
    return run && run.startStamp ? Date.now() - run.startStamp : 0;
  }

  setInterval(() => {
    if (run && run.startStamp && run.stageIdx < STAGES.length) {
      runTimerEl.textContent = fmtTime(runElapsed());
    }
  }, 200);

  // --- Screens -------------------------------------------------------------

  function destroyGame() {
    if (run && run.game) {
      run.game.destroy();
      run.game = null;
    }
  }

  function showRunStatus(show) {
    runStatusEl.hidden = !show;
  }

  function renderIntro() {
    destroyGame();
    run = null;
    showRunStatus(false);
    const done = savedDaily(todayStr());
    const streak = computeStreak();
    const nice = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    screenEl.innerHTML = `
      <div class="panel intro">
        <p class="intro-date">${nice}</p>
        <p class="intro-lead">Three quick puzzle games, back to back, on <b>one clock</b>. Everyone gets the same daily run — how fast can you finish?</p>
        <ol class="stage-list">
          ${STAGES.map(
            (s, i) => `<li><span class="stage-ico">${s.icon}</span><div><b>${s.name}</b><span>${s.blurb}</span></div></li>`
          ).join('')}
        </ol>
        ${
          done
            ? `<p class="intro-done">✓ Solved today in <b>${fmtTime(done.total)}</b>${
                streak > 1 ? ` · ${streak}-day streak 🔥` : ''
              }</p>`
            : ''
        }
        <div class="intro-actions">
          <button class="btn primary big" id="startDaily">${
            done ? 'Replay daily (beat your time)' : "Start today's run"
          }</button>
          <button class="btn" id="startPractice">Practice run</button>
        </div>
        <p class="intro-note">The clock starts immediately and doesn't stop until stage 3 is done. Hitting a mine just deals a new board.</p>
      </div>
    `;
    document.getElementById('startDaily').addEventListener('click', () => startRun(false));
    document.getElementById('startPractice').addEventListener('click', () => startRun(true));
  }

  function startRun(practice) {
    run = {
      practice,
      seedBase: practice
        ? 'practice-' + Math.floor(Math.random() * 0xffffffff).toString(16)
        : 'daily-' + todayStr(),
      stageIdx: 0,
      startStamp: Date.now(),
      cums: [],
      game: null,
    };
    showRunStatus(true);
    startStage();
  }

  function startStage() {
    destroyGame();
    const i = run.stageIdx;
    const def = STAGES[i];
    stageLabelEl.textContent = `Stage ${i + 1}/${STAGES.length} · ${def.icon} ${def.name}`;
    runTimerEl.textContent = fmtTime(runElapsed());
    screenEl.innerHTML = `<div class="panel stage"><div class="stage-mount"></div></div>`;
    const mount = screenEl.querySelector('.stage-mount');
    const rng = mulberry32(hashString('gauntlet-' + run.seedBase + '-s' + i));
    run.game = def.create(mount, { rng, onWin: onStageWin });
  }

  function onStageWin() {
    const cum = runElapsed();
    run.cums.push(cum);
    destroyGame();
    if (run.stageIdx === STAGES.length - 1) {
      renderResults();
      return;
    }
    const i = run.stageIdx;
    const split = cum - (i > 0 ? run.cums[i - 1] : 0);
    const nextDef = STAGES[i + 1];
    screenEl.innerHTML = `
      <div class="panel interstitial">
        <div class="inter-emoji">${STAGES[i].icon}</div>
        <h2>${STAGES[i].name} cleared!</h2>
        <p>Split <b>${fmtTime(split)}</b> · total <b>${fmtTime(cum)}</b></p>
        <p class="inter-next">Up next: ${nextDef.icon} <b>${nextDef.name}</b>…</p>
      </div>
    `;
    run.stageIdx++;
    setTimeout(() => {
      // Only advance if the user didn't restart in the meantime.
      if (run && run.stageIdx === i + 1) startStage();
    }, 2000);
  }

  function splitsOf(cums) {
    return cums.map((c, i) => c - (i > 0 ? cums[i - 1] : 0));
  }

  function renderResults() {
    run.stageIdx = STAGES.length; // freeze the header clock
    const total = run.cums[run.cums.length - 1];
    const splits = splitsOf(run.cums);
    const practice = run.practice;
    if (!practice) saveDaily(total, splits);
    const streak = practice ? 0 : computeStreak();
    stageLabelEl.textContent = 'Finished!';
    runTimerEl.textContent = fmtTime(total);
    screenEl.innerHTML = `
      <div class="panel results">
        <div class="inter-emoji">🏁</div>
        <h2>${practice ? 'Practice run' : 'Gauntlet'} complete — ${fmtTime(total)}</h2>
        <table class="splits">
          ${STAGES.map(
            (s, i) =>
              `<tr><td>${s.icon} ${s.name}</td><td>${fmtTime(splits[i])}</td><td class="cum">${fmtTime(run.cums[i])}</td></tr>`
          ).join('')}
        </table>
        ${!practice && streak > 1 ? `<p class="intro-done">${streak}-day streak 🔥</p>` : ''}
        <div class="intro-actions">
          <button class="btn primary" id="shareRun">Share</button>
          <button class="btn" id="backHome">Back to start</button>
        </div>
      </div>
    `;
    const shareBtnEl = document.getElementById('shareRun');
    shareBtnEl.addEventListener('click', async () => {
      const text =
        `⛓️ The Gauntlet ${practice ? '(practice)' : todayStr()} — ${fmtTime(total)}\n` +
        STAGES.map((s, i) => `${s.icon} ${fmtTime(splits[i])}`).join(' · ') +
        `\n${PAGE_URL}`;
      try {
        if (navigator.share) {
          await navigator.share({ text });
        } else {
          await navigator.clipboard.writeText(text);
          shareBtnEl.textContent = 'Copied!';
          setTimeout(() => (shareBtnEl.textContent = 'Share'), 1500);
        }
      } catch {
        /* cancelled */
      }
    });
    document.getElementById('backHome').addEventListener('click', renderIntro);
  }

  restartBtn.addEventListener('click', () => {
    if (!run) return;
    if (run.stageIdx < STAGES.length && !confirm('Abandon this run?')) return;
    renderIntro();
  });

  renderIntro();
})();
