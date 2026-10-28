import './style.css';
import {
  CalendarSolver,
  DAY_LABELS,
  MONTH_LABELS,
  ROWS,
  COLS,
  WEEKDAY_LABELS,
  daysInMonth,
  daysInRealMonth,
  isBlocked,
  labelAt,
  todayShanghai,
  weekdayOf,
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

type DateMode = 'real' | 'combo';

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
      <div class="mode-switch" role="group" aria-label="日期模式">
        <button type="button" id="mode-real" aria-pressed="true">真实日期</button>
        <button type="button" id="mode-combo" aria-pressed="false">指定组合</button>
      </div>
      <p class="mode-hint" id="mode-hint"></p>
      <div class="field" id="year-field">
        <label for="year">年</label>
        <input id="year" type="number" inputmode="numeric" min="1" max="9999" step="1" autocomplete="off" />
      </div>
      <div class="field">
        <label for="month">月</label>
        <select id="month"></select>
      </div>
      <div class="field">
        <label for="day">日</label>
        <select id="day"></select>
      </div>
      <div class="field">
        <label for="weekday" id="weekday-label">星期</label>
        <select id="weekday"></select>
      </div>
      <div class="btn-row">
        <button type="button" class="primary" id="btn-solve">求解</button>
        <button type="button" id="btn-prev" disabled>上一解</button>
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
  <p class="footer-note">DLX 精确覆盖 · 穷尽搜索全部解 · 方块可旋转与翻转</p>
`;

const monthSel = app.querySelector<HTMLSelectElement>('#month')!;
const daySel = app.querySelector<HTMLSelectElement>('#day')!;
const weekdaySel = app.querySelector<HTMLSelectElement>('#weekday')!;
const yearInput = app.querySelector<HTMLInputElement>('#year')!;
const yearField = app.querySelector<HTMLDivElement>('#year-field')!;
const weekdayLabel = app.querySelector<HTMLLabelElement>('#weekday-label')!;
const modeHint = app.querySelector<HTMLParagraphElement>('#mode-hint')!;
const modeRealBtn = app.querySelector<HTMLButtonElement>('#mode-real')!;
const modeComboBtn = app.querySelector<HTMLButtonElement>('#mode-combo')!;
const boardEl = app.querySelector<HTMLDivElement>('#board')!;
const statusEl = app.querySelector<HTMLDivElement>('#status')!;
const legendEl = app.querySelector<HTMLDivElement>('#legend')!;
const speedInput = app.querySelector<HTMLInputElement>('#speed')!;
const speedLabel = app.querySelector<HTMLSpanElement>('#speed-label')!;
const btnSolve = app.querySelector<HTMLButtonElement>('#btn-solve')!;
const btnPrev = app.querySelector<HTMLButtonElement>('#btn-prev')!;
const btnNext = app.querySelector<HTMLButtonElement>('#btn-next')!;
const btnPlay = app.querySelector<HTMLButtonElement>('#btn-play')!;
const btnClear = app.querySelector<HTMLButtonElement>('#btn-clear')!;

let mode: DateMode = 'real';
let appliedYear: number | null = today.year;

for (let m = 1; m <= 12; m++) {
  const opt = document.createElement('option');
  opt.value = String(m);
  opt.textContent = MONTH_LABELS[m - 1]!;
  if (m === today.month) opt.selected = true;
  monthSel.appendChild(opt);
}

yearInput.value = String(today.year);

WEEKDAY_LABELS.forEach((label, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = label;
  if (i === today.weekday) opt.selected = true;
  weekdaySel.appendChild(opt);
});

function readYear(): number | null {
  const y = Number(yearInput.value);
  if (!Number.isInteger(y) || y < 1 || y > 9999) return null;
  return y;
}

function maxDay(): number {
  const month = Number(monthSel.value);
  if (mode === 'combo') return daysInMonth(month);
  const year = readYear() ?? today.year;
  return daysInRealMonth(year, month);
}

function refillDays(): void {
  const max = maxDay();
  const prev = Number(daySel.value) || today.day;
  daySel.innerHTML = '';
  for (let d = 1; d <= max; d++) {
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = DAY_LABELS[d - 1]!;
    daySel.appendChild(opt);
  }
  daySel.value = String(Math.min(Math.max(prev, 1), max));
}

function syncWeekdayFromDate(): void {
  if (mode !== 'real') return;
  const year = readYear();
  if (year === null) return;
  const month = Number(monthSel.value);
  const day = Number(daySel.value);
  weekdaySel.value = String(weekdayOf(year, month, day));
}

function applyModeControls(): void {
  const real = mode === 'real';
  modeRealBtn.classList.toggle('active', real);
  modeComboBtn.classList.toggle('active', !real);
  modeRealBtn.setAttribute('aria-pressed', String(real));
  modeComboBtn.setAttribute('aria-pressed', String(!real));
  yearField.hidden = !real;
  weekdaySel.disabled = real;
  weekdayLabel.textContent = real ? '星期（自动）' : '星期';
  modeHint.textContent = real
    ? '星期按公历自动计算（Asia/Shanghai），不能单独修改。2 月 29 日仅闰年可选。'
    : '月、日、星期可独立选择，不必是真实日期。2 月固定 28 天。';
}

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
let solveToken = 0;

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

function paintSolution(placements: Placement[]): void {
  paintTargetsOnly();
  for (const p of placements) {
    const color = PIECE_COLORS[p.pieceId] ?? '#888';
    for (const [r, c] of p.cells) {
      const cell = cells.find((x) => x.r === r && x.c === c);
      if (!cell) continue;
      cell.el.classList.add('piece');
      cell.el.classList.remove('target');
      cell.el.style.background = color;
      cell.el.innerHTML = `${labelAt(r, c) ?? ''}<span class="pid">${p.pieceId}</span>`;
    }
  }
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
    if (token !== animToken) return;
    for (const [r, c] of p.cells) {
      const cell = cells.find((x) => x.r === r && x.c === c);
      cell?.el.classList.remove('placing');
    }
  }
}

function updateNav(): void {
  if (!solver || solver.solutionCount === 0 || solver.currentIndex < 0) {
    btnPrev.disabled = true;
    btnNext.disabled = true;
    btnPlay.disabled = currentPlacements.length === 0;
    return;
  }
  btnPrev.disabled = solver.currentIndex <= 0;
  btnNext.disabled = solver.currentIndex >= solver.solutionCount - 1;
  btnPlay.disabled = false;
}

function formatStatus(): string {
  if (!solver) return '';
  const n = solver.solutionCount;
  const ms = solver.elapsedMs.toFixed(1);
  const idx = solver.currentIndex >= 0 ? solver.currentIndex + 1 : 0;
  if (solver.exhausted) {
    if (n === 0) return `无解 · 耗时 ${ms} ms · 已穷尽`;
    return `解 #${idx} / ${n} · 共 ${n} 个解 · 耗时 ${ms} ms · 已穷尽`;
  }
  if (idx > 0) {
    return `已找到 ${n} 个解… · 解 #${idx} / ${n} · 耗时 ${ms} ms · 搜索中`;
  }
  return `已找到 ${n} 个解… · 耗时 ${ms} ms · 搜索中`;
}

function resetSolutions(message: string): void {
  solveToken++;
  animToken++;
  solver = null;
  currentPlacements = [];
  btnSolve.disabled = false;
  btnPrev.disabled = true;
  btnNext.disabled = true;
  btnPlay.disabled = true;
  paintTargetsOnly();
  setStatus(message, 'info');
}

function onDateEdited(): void {
  resetSolutions('日期已更改，请重新求解。');
}

async function presentSolution(index: number, instant: boolean): Promise<void> {
  if (!solver) return;
  const result = solver.solutionAt(index);
  if (!result) return;
  currentPlacements = result.placements;
  updateNav();
  if (instant) paintSolution(currentPlacements);
  else await animateSolution(currentPlacements);
}

async function runSolve(instant: boolean): Promise<void> {
  if (mode === 'real') {
    const year = readYear();
    if (year === null) {
      setStatus('请输入有效年份（1–9999）。', 'err');
      return;
    }
    // Always resync weekday before solving: year may match appliedYear after
    // a clear → edit month/day → restore same year path that skipped sync.
    appliedYear = year;
    refillDays();
    syncWeekdayFromDate();
  }
  const token = ++solveToken;
  animToken++;
  const month = Number(monthSel.value);
  const day = Number(daySel.value);
  const weekday = Number(weekdaySel.value);
  btnSolve.disabled = true;
  btnPrev.disabled = true;
  btnNext.disabled = true;
  btnPlay.disabled = true;
  currentPlacements = [];
  paintTargetsOnly();
  setStatus('正在求解…', 'info');
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  if (token !== solveToken) return;

  const local = new CalendarSolver(month, day, weekday);
  solver = local;
  let revealed = false;

  try {
    await local.enumerate((progress) => {
      if (token !== solveToken) return;
      if (!revealed && progress.found > 0) {
        revealed = true;
        void presentSolution(0, instant);
      }
      updateNav();
      if (progress.found === 0 && progress.exhausted) {
        setStatus(formatStatus(), 'err');
        return;
      }
      setStatus(formatStatus(), progress.found > 0 ? 'ok' : 'info');
    }, () => token !== solveToken);

    if (token !== solveToken) return;
    updateNav();
    if (local.solutionCount === 0) {
      currentPlacements = [];
      setStatus(formatStatus(), 'err');
    } else {
      setStatus(formatStatus(), 'ok');
    }
  } catch (e) {
    if (token !== solveToken) return;
    setStatus(`求解失败：${e instanceof Error ? e.message : String(e)}`, 'err');
  } finally {
    if (token === solveToken) btnSolve.disabled = false;
  }
}

modeRealBtn.addEventListener('click', () => {
  if (mode === 'real') return;
  mode = 'real';
  applyModeControls();
  refillDays();
  syncWeekdayFromDate();
  resetSolutions('已切换到真实日期，请重新求解。');
});

modeComboBtn.addEventListener('click', () => {
  if (mode === 'combo') return;
  mode = 'combo';
  applyModeControls();
  refillDays();
  resetSolutions('已切换到指定组合，请重新求解。');
});

monthSel.addEventListener('change', () => {
  refillDays();
  syncWeekdayFromDate();
  onDateEdited();
});

daySel.addEventListener('change', () => {
  syncWeekdayFromDate();
  onDateEdited();
});

weekdaySel.addEventListener('change', () => {
  if (mode === 'real') return;
  onDateEdited();
});

function commitYear(force: boolean): void {
  if (mode !== 'real') return;
  const raw = yearInput.value.trim();
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1 || year > 9999) return;
  // Avoid resetting on every keystroke of a multi-digit year; blur still commits.
  if (!force && raw.length < 4) return;
  const yearChanged = year !== appliedYear;
  const prevWeekday = weekdaySel.value;
  appliedYear = year;
  if (yearChanged) refillDays();
  syncWeekdayFromDate();
  // Same year after a clear/edit can leave weekday stale — still treat as edit.
  if (yearChanged || weekdaySel.value !== prevWeekday) onDateEdited();
}

yearInput.addEventListener('input', () => {
  // Clearing the year invalidates appliedYear so restoring the same digits resyncs.
  if (readYear() === null) appliedYear = null;
  commitYear(false);
});

yearInput.addEventListener('change', () => {
  commitYear(true);
});

speedInput.addEventListener('input', () => {
  speedLabel.textContent = `${speedInput.value}ms`;
});

btnClear.addEventListener('click', () => {
  resetSolutions('已清空。选择日期后点「求解」。');
});

btnSolve.addEventListener('click', () => {
  void runSolve(false);
});

btnNext.addEventListener('click', () => {
  if (!solver) return;
  const result = solver.nextSolution();
  if (!result) return;
  currentPlacements = result.placements;
  updateNav();
  setStatus(formatStatus(), 'ok');
  void animateSolution(currentPlacements);
});

btnPrev.addEventListener('click', () => {
  if (!solver) return;
  const result = solver.prevSolution();
  if (!result) return;
  currentPlacements = result.placements;
  updateNav();
  setStatus(formatStatus(), 'ok');
  void animateSolution(currentPlacements);
});

btnPlay.addEventListener('click', () => {
  if (!currentPlacements.length) return;
  void animateSolution(currentPlacements);
});

refillDays();
daySel.value = String(Math.min(today.day, maxDay()));
applyModeControls();
syncWeekdayFromDate();
paintTargetsOnly();
setStatus(
  `真实日期 · 今天（Asia/Shanghai）：${today.year}年${today.month}月${today.day}日 ${WEEKDAY_LABELS[today.weekday]}。点「求解」开始。`,
  'info',
);

// ?demo=1 → auto-solve today's real date (instant paint) for screenshots / quick demo
if (new URLSearchParams(location.search).has('demo')) {
  speedInput.value = '50';
  speedLabel.textContent = '50ms';
  void runSolve(true);
}
