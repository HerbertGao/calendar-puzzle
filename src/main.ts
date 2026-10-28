import './style.css';
import {
  CalendarSolver,
  DAY_LABELS,
  MONTH_LABELS,
  ROWS,
  COLS,
  WEEKDAY_LABELS,
  daysInMonth,
  isBlocked,
  labelAt,
  todayShanghai,
} from './solver/solver.ts';
import type { Placement } from './solver/types.ts';

const PIECE_COLORS: Record<string, string> = {
  T5: '#E07070',
  L5: '#5B9BD5',
  N5: '#70C070',
  V5: '#E8A838',
  W5: '#C080D0',
  P5: '#F0C050',
  U5: '#60C0C0',
  I4: '#D08050',
  S4: '#8090E0',
  L4: '#A0B070',
};

const app = document.querySelector<HTMLDivElement>('#app')!;

const today = todayShanghai();

app.innerHTML = `
  <header class="app-header">
    <h1>日历拼图求解器</h1>
    <p>露出「月 · 日 · 星期」，其余 47 格用 10 块积木覆盖（可旋转/翻转）</p>
  </header>
  <div class="layout">
    <aside class="panel controls">
      <h2>日期</h2>
      <div class="field">
        <label for="month">月</label>
        <select id="month"></select>
      </div>
      <div class="field">
        <label for="day">日</label>
        <select id="day"></select>
      </div>
      <div class="field">
        <label for="weekday">星期</label>
        <select id="weekday"></select>
      </div>
      <div class="btn-row">
        <button type="button" class="primary" id="btn-solve">求解</button>
        <button type="button" id="btn-next" disabled>下一解</button>
        <button type="button" id="btn-play" disabled>播放</button>
        <button type="button" id="btn-clear">清空</button>
      </div>
      <div class="speed-row">
        <span>速度</span>
        <input type="range" id="speed" min="50" max="600" value="220" />
        <span id="speed-label">220ms</span>
      </div>
      <div class="status info" id="status">选择日期后点「求解」。</div>
    </aside>
    <section class="panel">
      <h2>棋盘</h2>
      <div class="board-wrap">
        <div class="board" id="board" aria-label="日历拼图棋盘"></div>
      </div>
      <div class="legend" id="legend"></div>
    </section>
  </div>
  <p class="footer-note">DLX 精确覆盖 · 最多缓存 20 个不同解 · 方块可旋转与翻转</p>
`;

const monthSel = app.querySelector<HTMLSelectElement>('#month')!;
const daySel = app.querySelector<HTMLSelectElement>('#day')!;
const weekdaySel = app.querySelector<HTMLSelectElement>('#weekday')!;
const boardEl = app.querySelector<HTMLDivElement>('#board')!;
const statusEl = app.querySelector<HTMLDivElement>('#status')!;
const legendEl = app.querySelector<HTMLDivElement>('#legend')!;
const speedInput = app.querySelector<HTMLInputElement>('#speed')!;
const speedLabel = app.querySelector<HTMLSpanElement>('#speed-label')!;
const btnSolve = app.querySelector<HTMLButtonElement>('#btn-solve')!;
const btnNext = app.querySelector<HTMLButtonElement>('#btn-next')!;
const btnPlay = app.querySelector<HTMLButtonElement>('#btn-play')!;
const btnClear = app.querySelector<HTMLButtonElement>('#btn-clear')!;

for (let m = 1; m <= 12; m++) {
  const opt = document.createElement('option');
  opt.value = String(m);
  opt.textContent = MONTH_LABELS[m - 1]!;
  if (m === today.month) opt.selected = true;
  monthSel.appendChild(opt);
}

function refillDays(): void {
  const month = Number(monthSel.value);
  const max = daysInMonth(month);
  const prev = Number(daySel.value) || today.day;
  daySel.innerHTML = '';
  for (let d = 1; d <= max; d++) {
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = DAY_LABELS[d - 1]!;
    daySel.appendChild(opt);
  }
  daySel.value = String(Math.min(prev, max));
}

refillDays();
daySel.value = String(Math.min(today.day, daysInMonth(today.month)));

WEEKDAY_LABELS.forEach((label, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = label;
  if (i === today.weekday) opt.selected = true;
  weekdaySel.appendChild(opt);
});

legendEl.innerHTML = Object.entries(PIECE_COLORS)
  .map(
    ([id, color]) =>
      `<span><i class="swatch" style="background:${color}"></i>${id}</span>`,
  )
  .join('');

interface CellEl {
  el: HTMLDivElement;
  r: number;
  c: number;
}

const cells: CellEl[] = [];

function buildBoard(): void {
  boardEl.innerHTML = '';
  cells.length = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = String(r);
      el.dataset.c = String(c);
      if (isBlocked(r, c)) {
        el.classList.add('blocked');
      } else {
        const label = labelAt(r, c);
        el.textContent = label ?? '';
      }
      boardEl.appendChild(el);
      cells.push({ el, r, c });
    }
  }
}

buildBoard();

let solver: CalendarSolver | null = null;
let currentPlacements: Placement[] = [];
let animToken = 0;

function setStatus(msg: string, kind: 'info' | 'ok' | 'err' = 'info'): void {
  statusEl.className = `status ${kind}`;
  statusEl.textContent = msg;
}

function targetSet(): Set<string> {
  const month = Number(monthSel.value);
  const day = Number(daySel.value);
  const weekday = Number(weekdaySel.value);
  const keys = new Set<string>();
  const m = `${month}月`;
  const d = `${day}日`;
  const w = WEEKDAY_LABELS[weekday]!;
  for (const { r, c } of cells) {
    if (isBlocked(r, c)) continue;
    const lab = labelAt(r, c);
    if (lab === m || lab === d || lab === w) keys.add(`${r},${c}`);
  }
  return keys;
}

function clearPieces(keepTargets = true): void {
  const targets = keepTargets ? targetSet() : new Set<string>();
  for (const { el, r, c } of cells) {
    if (isBlocked(r, c)) continue;
    el.classList.remove('piece', 'target', 'placing');
    el.style.background = '';
    const pid = el.querySelector('.pid');
    if (pid) pid.remove();
    const lab = labelAt(r, c);
    el.textContent = lab ?? '';
    if (targets.has(`${r},${c}`)) el.classList.add('target');
  }
}

function paintTargetsOnly(): void {
  clearPieces(true);
}


async function animateSolution(placements: Placement[]): Promise<void> {
  const token = ++animToken;
  paintTargetsOnly();
  const delay = Number(speedInput.value);
  for (const p of placements) {
    if (token !== animToken) return;
    const color = PIECE_COLORS[p.pieceId] ?? '#888';
    for (const [r, c] of p.cells) {
      const cell = cells.find((x) => x.r === r && x.c === c);
      if (!cell) continue;
      cell.el.classList.add('piece', 'placing');
      cell.el.classList.remove('target');
      cell.el.style.background = color;
      cell.el.innerHTML = `${labelAt(r, c) ?? ''}<span class="pid">${p.pieceId}</span>`;
    }
    await new Promise((res) => setTimeout(res, delay));
    for (const [r, c] of p.cells) {
      const cell = cells.find((x) => x.r === r && x.c === c);
      cell?.el.classList.remove('placing');
    }
  }
}

function syncDayOptions(): void {
  refillDays();
  paintTargetsOnly();
  solver = null;
  currentPlacements = [];
  btnNext.disabled = true;
  btnPlay.disabled = true;
  setStatus('日期已更改，请重新求解。', 'info');
}

monthSel.addEventListener('change', syncDayOptions);
daySel.addEventListener('change', () => {
  paintTargetsOnly();
  solver = null;
  currentPlacements = [];
  btnNext.disabled = true;
  btnPlay.disabled = true;
  setStatus('日期已更改，请重新求解。', 'info');
});
weekdaySel.addEventListener('change', () => {
  paintTargetsOnly();
  solver = null;
  currentPlacements = [];
  btnNext.disabled = true;
  btnPlay.disabled = true;
  setStatus('日期已更改，请重新求解。', 'info');
});

speedInput.addEventListener('input', () => {
  speedLabel.textContent = `${speedInput.value}ms`;
});

btnClear.addEventListener('click', () => {
  animToken++;
  solver = null;
  currentPlacements = [];
  btnNext.disabled = true;
  btnPlay.disabled = true;
  paintTargetsOnly();
  setStatus('已清空。选择日期后点「求解」。', 'info');
});

btnSolve.addEventListener('click', async () => {
  animToken++;
  const month = Number(monthSel.value);
  const day = Number(daySel.value);
  const weekday = Number(weekdaySel.value);
  btnSolve.disabled = true;
  btnNext.disabled = true;
  btnPlay.disabled = true;
  paintTargetsOnly();
  setStatus('正在求解…', 'info');
  await new Promise((r) => setTimeout(r, 30));

  try {
    solver = new CalendarSolver(month, day, weekday, 20);
    const result = solver.solveFirst();
    if (!result) {
      setStatus('无解（请检查月/日/星期组合）。', 'err');
      currentPlacements = [];
      return;
    }
    currentPlacements = result.placements;
    const more =
      solver.solutionCount > 1
        ? `，已缓存 ${solver.solutionCount} 个解`
        : result.exhausted
          ? '（仅此解）'
          : '';
    setStatus(
      `解 #${result.solutionIndex + 1}${more} · 耗时 ${result.elapsedMs.toFixed(1)} ms`,
      'ok',
    );
    btnNext.disabled = solver.solutionCount <= 1;
    btnPlay.disabled = false;
    await animateSolution(currentPlacements);
  } catch (e) {
    setStatus(`求解失败：${e instanceof Error ? e.message : String(e)}`, 'err');
  } finally {
    btnSolve.disabled = false;
  }
});

btnNext.addEventListener('click', async () => {
  if (!solver) return;
  animToken++;
  const result = solver.nextSolution();
  if (!result) {
    setStatus(
      `已到缓存末尾（共 ${solver.solutionCount} 个解）。`,
      'info',
    );
    btnNext.disabled = true;
    return;
  }
  currentPlacements = result.placements;
  btnNext.disabled = result.solutionIndex >= solver.solutionCount - 1;
  setStatus(
    `解 #${result.solutionIndex + 1} / ${solver.solutionCount} · 首次求解 ${result.elapsedMs.toFixed(1)} ms`,
    'ok',
  );
  btnPlay.disabled = false;
  await animateSolution(currentPlacements);
});

btnPlay.addEventListener('click', async () => {
  if (!currentPlacements.length) return;
  btnPlay.disabled = true;
  await animateSolution(currentPlacements);
  btnPlay.disabled = false;
});

paintTargetsOnly();
setStatus(
  `默认今天（Asia/Shanghai）：${today.month}月 ${today.day}日 ${WEEKDAY_LABELS[today.weekday]}。点「求解」开始。`,
  'info',
);

// ?demo=1 → auto-solve (instant paint) for screenshots / quick demo
if (new URLSearchParams(location.search).has('demo')) {
  speedInput.value = '50';
  speedLabel.textContent = '50ms';
  const origAnimate = animateSolution;
  // replace play path: after solveFirst, paint instantly by hijacking delay
  void (async () => {
    const month = Number(monthSel.value);
    const day = Number(daySel.value);
    const weekday = Number(weekdaySel.value);
    solver = new CalendarSolver(month, day, weekday, 20);
    const result = solver.solveFirst();
    if (!result) {
      setStatus('无解', 'err');
      return;
    }
    currentPlacements = result.placements;
    setStatus(
      `解 #1 / ${solver.solutionCount} · 耗时 ${result.elapsedMs.toFixed(1)} ms`,
      'ok',
    );
    btnNext.disabled = solver.solutionCount <= 1;
    btnPlay.disabled = false;
    paintTargetsOnly();
    for (const pl of currentPlacements) {
      const color = PIECE_COLORS[pl.pieceId] ?? '#888';
      for (const [r, c] of pl.cells) {
        const cell = cells.find((x) => x.r === r && x.c === c);
        if (!cell) continue;
        cell.el.classList.add('piece');
        cell.el.classList.remove('target');
        cell.el.style.background = color;
        cell.el.innerHTML = `${labelAt(r, c) ?? ''}<span class="pid">${pl.pieceId}</span>`;
      }
    }
    void origAnimate;
  })();
}
