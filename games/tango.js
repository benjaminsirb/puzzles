import { makeRng } from '../lib/rng.js';

export const id = 'tango';
export const name = 'Tango';
export const sizes = null;
export const defaultSize = 6;
export const rules = 'Fill the grid with suns and moons so each row and column holds three of each. No more than two of the same symbol may sit next to each other. Cells joined by = match; cells joined by × differ. Tap to cycle a cell.';

const N = 6;
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.5" fill="#f59e0b"/><g stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M14.5 3a9 9 0 1 0 6.5 15.3A8 8 0 0 1 14.5 3z" fill="#60a5fa"/></svg>';

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
    const bad = new Set();
    const at = (r, c) => vals[r * N + c];
    for (let r = 0; r < N; r++) {
      for (const v of [1, 2]) {
        const row = [], col = [];
        for (let k = 0; k < N; k++) { if (at(r, k) === v) row.push(r * N + k); if (at(k, r) === v) col.push(k * N + r); }
        if (row.length > N / 2) row.forEach((i) => bad.add(i));
        if (col.length > N / 2) col.forEach((i) => bad.add(i));
      }
      for (let k = 0; k < N - 2; k++) {
        const a = at(r, k); if (a && a === at(r, k + 1) && a === at(r, k + 2)) [0, 1, 2].forEach((d) => bad.add(r * N + k + d));
        const b = at(k, r); if (b && b === at(k + 1, r) && b === at(k + 2, r)) [0, 1, 2].forEach((d) => bad.add((k + d) * N + r));
      }
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = at(r, c); if (!v) continue;
      const cr = cons.right[r][c], o = c < N - 1 ? at(r, c + 1) : 0;
      if (cr && o && (cr === 'eq' ? o !== v : o === v)) { bad.add(r * N + c); bad.add(r * N + c + 1); }
      const cd = cons.down[r][c], p = r < N - 1 ? at(r + 1, c) : 0;
      if (cd && p && (cd === 'eq' ? p !== v : p === v)) { bad.add(r * N + c); bad.add((r + 1) * N + c); }
    }
    let filled = 0;
    for (let i = 0; i < N * N; i++) {
      cells[i].innerHTML = vals[i] === 1 ? SUN : vals[i] === 2 ? MOON : '';
      cells[i].classList.toggle('error', bad.has(i));
      if (vals[i]) filled++;
    }
    return filled === N * N && bad.size === 0;
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
