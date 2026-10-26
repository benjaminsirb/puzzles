import { makeRng } from '../lib/rng.js';

export const id = 'tango';
export const name = 'Tango';
export const levels = ['easy', 'medium', 'hard'];
export const rules = 'Fill the grid with suns and moons so each row and column holds three of each. No more than two of the same symbol may sit next to each other. Cells joined by = match; cells joined by × differ. Tap to cycle a cell.';

const N = 6;
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="#f5a623"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M14.8 3.3a8.7 8.7 0 1 0 6 15.4 10.2 10.2 0 0 1-6-15.4z" fill="#5b7cc4"/></svg>';
const EQ = '<svg viewBox="0 0 10 10"><path d="M1.5 3.3h7M1.5 6.7h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const NE = '<svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const makeCons = () => ({
  right: Array.from({ length: N }, () => new Array(N).fill(null)),
  down: Array.from({ length: N }, () => new Array(N).fill(null)),
});

function ok(g, r, c, v, cons) {
  let cnt = 0;
  for (let k = 0; k < N; k++) if (g[r * N + k] === v) cnt++;
  if (cnt >= N / 2) return false;
  cnt = 0;
  for (let k = 0; k < N; k++) if (g[k * N + c] === v) cnt++;
  if (cnt >= N / 2) return false;
  const at = (rr, cc) => (rr < 0 || cc < 0 || rr >= N || cc >= N ? 0 : g[rr * N + cc]);
  if (at(r, c - 1) === v && at(r, c - 2) === v) return false;
  if (at(r, c - 1) === v && at(r, c + 1) === v) return false;
  if (at(r, c + 1) === v && at(r, c + 2) === v) return false;
  if (at(r - 1, c) === v && at(r - 2, c) === v) return false;
  if (at(r - 1, c) === v && at(r + 1, c) === v) return false;
  if (at(r + 1, c) === v && at(r + 2, c) === v) return false;
  const chk = (t, o) => (!t || !o ? true : t === 'eq' ? o === v : o !== v);
  if (!chk(cons.right[r][c], at(r, c + 1))) return false;
  if (c > 0 && !chk(cons.right[r][c - 1], at(r, c - 1))) return false;
  if (!chk(cons.down[r][c], at(r + 1, c))) return false;
  if (r > 0 && !chk(cons.down[r - 1][c], at(r - 1, c))) return false;
  return true;
}

function countSolutions(start, cons, limit = 2) {
  const g = start.slice();
  let count = 0;
  const rec = (i) => {
    if (count >= limit) return;
    while (i < N * N && g[i]) i++;
    if (i === N * N) { count++; return; }
    const r = Math.floor(i / N), c = i % N;
    for (const v of [1, 2]) {
      if (ok(g, r, c, v, cons)) { g[i] = v; rec(i + 1); g[i] = 0; }
    }
  };
  rec(0);
  return count;
}

function fillRandom(rng) {
  const g = new Array(N * N).fill(0);
  const cons = makeCons();
  const rec = (i) => {
    if (i === N * N) return true;
    const r = Math.floor(i / N), c = i % N;
    for (const v of rng.shuffle([1, 2])) {
      if (ok(g, r, c, v, cons)) { g[i] = v; if (rec(i + 1)) return true; g[i] = 0; }
    }
    return false;
  };
  rec(0);
  return g;
}

// ---- Human-technique solver used for grading ----
// Level 1: direct rules (pairs, gaps, counts, = and x). Level 2: one-cell lookahead. Level 3: needs bifurcation.
function grade(given, cons) {
  const g = given.slice();
  const other = (v) => 3 - v;
  const setv = (i, v) => { if (g[i] && g[i] !== v) throw 0; g[i] = v; };
  const at = (r, c) => (r < 0 || c < 0 || r >= N || c >= N ? 0 : g[r * N + c]);
  const direct = () => {
    let changed = false;
    const lines = [];
    for (let k = 0; k < N; k++) { lines.push([...Array(N).keys()].map((c) => k * N + c)); lines.push([...Array(N).keys()].map((r) => r * N + k)); }
    for (const line of lines) {
      for (let k = 0; k < N - 1; k++) {
        const a = g[line[k]], b = g[line[k + 1]];
        if (a && a === b) {
          if (k > 0 && !g[line[k - 1]]) { setv(line[k - 1], other(a)); changed = true; }
          if (k + 2 < N && !g[line[k + 2]]) { setv(line[k + 2], other(a)); changed = true; }
        }
        if (k + 2 < N) { const c2 = g[line[k + 2]]; if (a && a === c2 && !g[line[k + 1]]) { setv(line[k + 1], other(a)); changed = true; } }
      }
      for (const v of [1, 2]) {
        const cnt = line.filter((i) => g[i] === v).length;
        if (cnt > N / 2) throw 0;
        if (cnt === N / 2) for (const i of line) if (!g[i]) { setv(i, other(v)); changed = true; }
      }
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const pairs = [];
      if (cons.right[r][c]) pairs.push([cons.right[r][c], i + 1]);
      if (cons.down[r][c]) pairs.push([cons.down[r][c], i + N]);
      for (const [t, j] of pairs) {
        const a = g[i], b = g[j];
        if (a && b) { if (t === 'eq' ? a !== b : a === b) throw 0; continue; }
        if (a && !b) { setv(j, t === 'eq' ? a : other(a)); changed = true; }
        else if (!a && b) { setv(i, t === 'eq' ? b : other(b)); changed = true; }
      }
    }
    // a triple anywhere is a contradiction
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = at(r, c); if (!v) continue;
      if (at(r, c + 1) === v && at(r, c + 2) === v) throw 0;
      if (at(r + 1, c) === v && at(r + 2, c) === v) throw 0;
    }
    return changed;
  };
  const propagate = () => { while (direct()) { /* keep going */ } };
  let level = 1, deep = 0;
  for (let guard = 0; guard < 200; guard++) {
    try { propagate(); } catch { return null; }
    if (g.every(Boolean)) return { level, deep };
    // Level 2: a value that leads to a contradiction under direct rules is eliminated.
    let found = false;
    for (let i = 0; i < N * N && !found; i++) {
      if (g[i]) continue;
      for (const v of [1, 2]) {
        const save = g.slice();
        g[i] = v;
        let bad = false;
        try { propagate(); } catch { bad = true; }
        for (let k = 0; k < N * N; k++) g[k] = save[k];
        if (bad) { g[i] = other(v); found = true; level = Math.max(level, 2); deep++; break; }
      }
    }
    if (!found) return { level: 3, deep };
  }
  return null;
}

// One deduction from the current board under direct rules: returns the cell index, or -1.
function nextDirect(vals, cons) {
  const before = vals.slice();
  const g = before.slice();
  try {
    const r = gradeStep(g, cons);
    if (!r) return -1;
  } catch { return -1; }
  for (let i = 0; i < N * N; i++) if (!before[i] && g[i]) return i;
  return -1;
}
// Applies direct rules once to g in place; returns whether anything changed. Throws on contradiction.
function gradeStep(g, cons) {
  const other = (v) => 3 - v;
  const setv = (i, v) => { if (g[i] && g[i] !== v) throw 0; g[i] = v; };
  let changed = false;
  const lines = [];
  for (let k = 0; k < N; k++) { lines.push([...Array(N).keys()].map((c) => k * N + c)); lines.push([...Array(N).keys()].map((r) => r * N + k)); }
  for (const line of lines) {
    for (let k = 0; k < N - 1; k++) {
      const a = g[line[k]], b = g[line[k + 1]];
      if (a && a === b) {
        if (k > 0 && !g[line[k - 1]]) { setv(line[k - 1], other(a)); changed = true; }
        if (k + 2 < N && !g[line[k + 2]]) { setv(line[k + 2], other(a)); changed = true; }
      }
      if (k + 2 < N) { const c2 = g[line[k + 2]]; if (a && a === c2 && !g[line[k + 1]]) { setv(line[k + 1], other(a)); changed = true; } }
    }
    for (const v of [1, 2]) {
      const cnt = line.filter((i) => g[i] === v).length;
      if (cnt === N / 2) for (const i of line) if (!g[i]) { setv(i, other(v)); changed = true; }
    }
  }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const i = r * N + c;
    const pairs = [];
    if (cons.right[r][c]) pairs.push([cons.right[r][c], i + 1]);
    if (cons.down[r][c]) pairs.push([cons.down[r][c], i + N]);
    for (const [t, j] of pairs) {
      const a = g[i], b = g[j];
      if (a && !b) { setv(j, t === 'eq' ? a : other(a)); changed = true; }
      else if (!a && b) { setv(i, t === 'eq' ? b : other(b)); changed = true; }
    }
  }
  return changed;
}

const FITS = {
  easy: (g) => g.level === 1,
  medium: (g) => g.level === 2 && g.deep <= 3,
  hard: (g) => g.level === 2 && g.deep >= 4,
};

export function generate(seed, diff = 'medium') {
  const rng = makeRng(seed);
  let last = null;
  for (let t = 0; t < 300; t++) {
    const full = fillRandom(rng);
    const cons = makeCons();
    const pairs = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (c < N - 1) pairs.push(['right', r, c]);
      if (r < N - 1) pairs.push(['down', r, c]);
    }
    rng.shuffle(pairs);
    const nCons = diff === 'easy' ? 6 + rng.int(4) : diff === 'medium' ? 4 + rng.int(4) : 2 + rng.int(4);
    for (const [d, r, c] of pairs.slice(0, nCons)) {
      const o = d === 'right' ? full[r * N + c + 1] : full[(r + 1) * N + c];
      cons[d][r][c] = o === full[r * N + c] ? 'eq' : 'ne';
    }
    // Strip givens to a minimal unique set.
    const given = full.slice();
    const order = rng.shuffle([...Array(N * N).keys()]);
    for (const i of order) { const v = given[i]; given[i] = 0; if (countSolutions(given, cons) !== 1) given[i] = v; }
    if (diff === 'easy') {
      // Add givens back until direct rules alone solve it.
      for (const i of order) {
        const g = grade(given, cons);
        if (g && g.level === 1) break;
        if (!given[i]) given[i] = full[i];
      }
    }
    const g = grade(given, cons);
    last = { n: N, diff, given, cons, solution: full, grade: g, tries: t + 1 };
    if (g && FITS[diff](g)) return last;
  }
  return last;
}

export function mount(root, puzzle, api, saved) {
  const { given, cons } = puzzle;
  const vals = saved && Array.isArray(saved.vals) && saved.vals.length === N * N ? saved.vals.slice() : given.slice();
  for (let i = 0; i < N * N; i++) if (given[i]) vals[i] = given[i];

  const wrap = document.createElement('div');
  wrap.className = 'wrap tango';
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--n', N);
  const cells = [];
  for (let i = 0; i < N * N; i++) {
    const d = document.createElement('div');
    d.className = 'cell' + (given[i] ? ' given' : '');
    d.dataset.i = i;
    cells.push(d); grid.appendChild(d);
  }
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (cons.right[r][c]) {
      const s = document.createElement('div');
      s.className = 'con'; s.innerHTML = cons.right[r][c] === 'eq' ? EQ : NE;
      s.style.left = ((c + 1) / N) * 100 + '%'; s.style.top = ((r + 0.5) / N) * 100 + '%';
      overlay.appendChild(s);
    }
    if (cons.down[r][c]) {
      const s = document.createElement('div');
      s.className = 'con'; s.innerHTML = cons.down[r][c] === 'eq' ? EQ : NE;
      s.style.left = ((c + 0.5) / N) * 100 + '%'; s.style.top = ((r + 1) / N) * 100 + '%';
      overlay.appendChild(s);
    }
  }
  wrap.appendChild(grid); wrap.appendChild(overlay); root.appendChild(wrap);

  function render() {
    // Flag mistakes only in rows and columns that are completely filled.
    const bad = new Set();
    const at = (r, c) => vals[r * N + c];
    const full = (line) => line.every((i) => vals[i]);
    const check = (line) => {
      if (!full(line)) return;
      for (const v of [1, 2]) if (line.filter((i) => vals[i] === v).length > N / 2) line.forEach((i) => bad.add(i));
      for (let k = 0; k < N - 2; k++) {
        const a = vals[line[k]];
        if (a && a === vals[line[k + 1]] && a === vals[line[k + 2]]) { bad.add(line[k]); bad.add(line[k + 1]); bad.add(line[k + 2]); }
      }
      for (let k = 0; k < N - 1; k++) {
        const i = line[k], j = line[k + 1];
        const r = Math.floor(i / N), c = i % N;
        const t = j === i + 1 ? cons.right[r][c] : cons.down[r][c];
        if (t && (t === 'eq' ? vals[i] !== vals[j] : vals[i] === vals[j])) { bad.add(i); bad.add(j); }
      }
    };
    for (let r = 0; r < N; r++) check([...Array(N).keys()].map((c) => r * N + c));
    for (let c = 0; c < N; c++) check([...Array(N).keys()].map((r) => r * N + c));
    let filled = 0;
    for (let i = 0; i < N * N; i++) {
      cells[i].innerHTML = vals[i] === 1 ? SUN : vals[i] === 2 ? MOON : '';
      if (vals[i]) filled++;
    }
    showErrors(bad);
    return filled === N * N && bad.size === 0;
  }

  // Clear stale highlights at once, but wait a moment before adding new ones so a row
  // that is being corrected does not flash red mid-edit.
  let errTimer = null;
  function showErrors(bad) {
    for (let i = 0; i < N * N; i++) if (!bad.has(i)) cells[i].classList.remove('error');
    clearTimeout(errTimer);
    if (!bad.size) return;
    errTimer = setTimeout(() => { for (const i of bad) if (vals[i]) cells[i].classList.add('error'); }, 700);
  }

  // Act on pointerdown so rapid taps are never swallowed by the double-tap zoom guard.
  grid.addEventListener('pointerdown', (e) => {
    const d = e.target.closest('.cell');
    if (!d || api.isSolved()) return;
    e.preventDefault();
    const i = +d.dataset.i;
    if (given[i]) return;
    vals[i] = (vals[i] + 1) % 3;
    const win = render();
    api.onChange({ vals });
    if (win) api.onWin();
  });
  api.addAction('Clear', () => {
    if (api.isSolved()) return;
    for (let i = 0; i < N * N; i++) vals[i] = given[i];
    render(); api.onChange({ vals });
  });
  api.addAction('Hint', () => {
    if (api.isSolved()) return;
    const wrong = vals.findIndex((v, i) => v && v !== puzzle.solution[i]);
    if (wrong >= 0) { api.hint([cells[wrong]], 'This cell is wrong.'); return; }
    const i = nextDirect(vals, cons);
    if (i >= 0) { api.hint([cells[i]], 'This cell can be worked out from its row, column or a nearby hint.'); return; }
    const empties = vals.map((v, k) => (v ? -1 : k)).filter((k) => k >= 0);
    if (!empties.length) return;
    const k = empties[Math.floor(empties.length / 2)];
    api.hint([cells[k]], 'Try both symbols here. One of them leads to a contradiction.');
  });
  render();
}

export function solvedState(puzzle) { return { vals: puzzle.solution.slice() }; }
