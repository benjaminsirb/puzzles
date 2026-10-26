import { makeRng } from '../lib/rng.js';

export const id = 'tango';
export const name = 'Tango';
export const sizes = null;
export const defaultSize = 6;
export const rules = 'Fill the grid with suns and moons so each row and column holds three of each. No more than two of the same symbol may sit next to each other. Cells joined by = match; cells joined by × differ. Tap to cycle a cell.';

const N = 6;
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="#f5a623"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M14.8 3.3a8.7 8.7 0 1 0 6 15.4 10.2 10.2 0 0 1-6-15.4z" fill="#5b7cc4"/></svg>';
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

export function generate(seed) {
  const rng = makeRng(seed);
  const full = fillRandom(rng);
  const cons = makeCons();
  const pairs = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (c < N - 1) pairs.push(['right', r, c]);
    if (r < N - 1) pairs.push(['down', r, c]);
  }
  rng.shuffle(pairs);
  const nCons = 4 + rng.int(5);
  for (const [d, r, c] of pairs.slice(0, nCons)) {
    const other = d === 'right' ? full[r * N + c + 1] : full[(r + 1) * N + c];
    cons[d][r][c] = other === full[r * N + c] ? 'eq' : 'ne';
  }
  const given = full.slice();
  for (const i of rng.shuffle([...Array(N * N).keys()])) {
    const v = given[i];
    given[i] = 0;
    if (countSolutions(given, cons) !== 1) given[i] = v;
  }
  return { n: N, given, cons, solution: full };
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
      s.className = 'con'; s.textContent = cons.right[r][c] === 'eq' ? '=' : '×';
      s.style.left = ((c + 1) / N) * 100 + '%'; s.style.top = ((r + 0.5) / N) * 100 + '%';
      overlay.appendChild(s);
    }
    if (cons.down[r][c]) {
      const s = document.createElement('div');
      s.className = 'con'; s.textContent = cons.down[r][c] === 'eq' ? '=' : '×';
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

  grid.addEventListener('click', (e) => {
    const d = e.target.closest('.cell');
    if (!d || api.isSolved()) return;
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
  render();
}

export function solvedState(puzzle) { return { vals: puzzle.solution.slice() }; }
