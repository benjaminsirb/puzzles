import { makeRng } from '../lib/rng.js';

export const id = 'queens';
export const name = 'Queens';
export const sizes = [7, 8, 9];
export const defaultSize = 8;
export const rules = 'Place exactly one queen in each row, column and colour region. Queens never touch, not even diagonally. Tap a cell once for an X and twice for a queen.';

const PALETTE = ['#f7b8b8', '#fbd59f', '#f8f1a0', '#bfe8b5', '#aee0ee', '#c3c6f5', '#e8bdee', '#dccfbd', '#b2e8d6', '#f5c3df'];

const QUEEN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18h16l1.2-9-4.6 3.2L12 5l-4.6 7.2L2.8 9z"/><rect x="4" y="19" width="16" height="2.5" rx="1"/></svg>';
const X = '<svg class="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const AUTO_X = X.replace('class="x"', 'class="x auto"');
const AUTO_KEY = 'puzzles.queens.autoX';
// marks: 0 empty, 1 X, 2 queen, 3 auto-placed X

function placeQueens(n, rng) {
  const cols = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  const rec = (r) => {
    if (r === n) return true;
    for (const c of rng.shuffle([...Array(n).keys()])) {
      if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
      cols[r] = c; used[c] = true;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    cols[r] = -1; return false;
  };
  rec(0);
  return cols;
}

function growRegions(n, cols, rng) {
  const region = Array.from({ length: n }, () => new Array(n).fill(-1));
  const cells = [];
  const greed = [];
  for (let r = 0; r < n; r++) {
    region[r][cols[r]] = r; cells.push([[r, cols[r]]]);
    // Skewed appetite: some regions stay tiny, others sprawl.
    greed.push(0.05 + rng.next() ** 2 * 0.95);
  }
  let remaining = n * n - n;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let stall = 0;
  while (remaining > 0) {
    const k = rng.int(n);
    if (!rng.chance(greed[k]) && stall < 50) { stall++; continue; }
    // Snaky growth: half the time extend from the newest cell only.
    const from = rng.chance(0.5) ? [cells[k][cells[k].length - 1]] : cells[k];
    const cand = [];
    for (const [r, c] of from) for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= n || nc >= n || region[nr][nc] !== -1) continue;
      cand.push([nr, nc]);
    }
    if (!cand.length) { stall++; continue; }
    stall = 0;
    const [r, c] = rng.pick(cand);
    region[r][c] = k; cells[k].push([r, c]); remaining--;
  }
  return region;
}

function solutions(n, region, limit = 2) {
  const out = [];
  const cols = new Array(n).fill(-1);
  const usedCol = new Array(n).fill(false), usedReg = new Array(n).fill(false);
  const rec = (r) => {
    if (out.length >= limit) return;
    if (r === n) { out.push(cols.slice()); return; }
    for (let c = 0; c < n; c++) {
      const g = region[r][c];
      if (usedCol[c] || usedReg[g] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
      cols[r] = c; usedCol[c] = usedReg[g] = true;
      rec(r + 1);
      usedCol[c] = usedReg[g] = false;
    }
    cols[r] = -1;
  };
  rec(0);
  return out;
}

function connectedWithout(n, region, g, skipR, skipC) {
  let start = null, total = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (region[r][c] !== g || (r === skipR && c === skipC)) continue;
    total++; if (!start) start = [r, c];
  }
  if (!start) return false;
  const seen = new Set([start[0] * n + start[1]]);
  const stack = [start];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= n || nc >= n || region[nr][nc] !== g) continue;
      if (nr === skipR && nc === skipC) continue;
      const key = nr * n + nc;
      if (!seen.has(key)) { seen.add(key); stack.push([nr, nc]); }
    }
  }
  return seen.size === total;
}

// Move cells that host queens of an alternate solution into a neighbouring region until one solution remains.
function repair(n, region, cols, rng) {
  for (let it = 0; it < 300; it++) {
    const sols = solutions(n, region, 2);
    if (sols.length === 1) return true;
    const alt = sols.find((s) => s.some((c, r) => c !== cols[r])) || sols[0];
    const rows = rng.shuffle([...Array(n).keys()].filter((r) => alt[r] !== cols[r]));
    let moved = false;
    for (const r of rows) {
      const c = alt[r], g = region[r][c];
      if (!connectedWithout(n, region, g, r, c)) continue;
      const targets = [];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n || region[nr][nc] === g) continue;
        targets.push(region[nr][nc]);
      }
      if (!targets.length) continue;
      region[r][c] = rng.pick(targets);
      moved = true;
      break;
    }
    if (!moved) return false;
  }
  return false;
}

export function generate(seed, size) {
  const n = size || defaultSize;
  const rng = makeRng(seed);
  let last = null;
  for (let t = 0; t < 200; t++) {
    const cols = placeQueens(n, rng);
    const region = growRegions(n, cols, rng);
    last = { n, region, solution: cols, tries: t + 1 };
    if (repair(n, region, cols, rng)) return last;
  }
  return last;
}

export function mount(root, puzzle, api, saved) {
  const { n, region } = puzzle;
  const marks = saved && Array.isArray(saved.marks) && saved.marks.length === n * n ? saved.marks.slice() : new Array(n * n).fill(0);
  let autoX = localStorage.getItem(AUTO_KEY) !== 'off';
  const grid = document.createElement('div');
  grid.className = 'grid queens';
  grid.style.setProperty('--n', n);
  const cells = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const d = document.createElement('div');
    d.className = 'cell';
    d.style.background = PALETTE[region[r][c] % PALETTE.length];
    if (r === 0 || region[r - 1][c] !== region[r][c]) d.classList.add('bt');
    if (c === 0 || region[r][c - 1] !== region[r][c]) d.classList.add('bl');
    if (r === n - 1 || region[r + 1][c] !== region[r][c]) d.classList.add('bb');
    if (c === n - 1 || region[r][c + 1] !== region[r][c]) d.classList.add('br');
    d.dataset.i = i;
    cells.push(d); grid.appendChild(d);
  }
  root.appendChild(grid);

  // Cells a queen at i rules out: same row, column, region, or touching.
  const attacked = (i) => {
    const r = Math.floor(i / n), c = i % n, out = [];
    for (let j = 0; j < n * n; j++) {
      if (j === i) continue;
      const rj = Math.floor(j / n), cj = j % n;
      if (rj === r || cj === c || region[rj][cj] === region[r][c] || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) out.push(j);
    }
    return out;
  };
  // Re-derive every auto X from the queens on the board.
  function refreshAuto() {
    for (let i = 0; i < n * n; i++) if (marks[i] === 3) marks[i] = 0;
    if (!autoX) return;
    for (let i = 0; i < n * n; i++) if (marks[i] === 2) for (const j of attacked(i)) if (marks[j] === 0) marks[j] = 3;
  }

  function render() {
    const queens = [];
    for (let i = 0; i < n * n; i++) {
      cells[i].classList.remove('error');
      cells[i].innerHTML = marks[i] === 1 ? X : marks[i] === 3 ? AUTO_X : marks[i] === 2 ? QUEEN : '';
      if (marks[i] === 2) queens.push(i);
    }
    const bad = new Set();
    for (let a = 0; a < queens.length; a++) for (let b = a + 1; b < queens.length; b++) {
      const ra = Math.floor(queens[a] / n), ca = queens[a] % n, rb = Math.floor(queens[b] / n), cb = queens[b] % n;
      if (ra === rb || ca === cb || region[ra][ca] === region[rb][cb] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1)) {
        bad.add(queens[a]); bad.add(queens[b]);
      }
    }
    for (const i of bad) cells[i].classList.add('error');
    return queens.length === n && bad.size === 0;
  }

  function tap(i) {
    // empty -> X -> queen -> empty; an auto X goes straight to queen
    marks[i] = marks[i] === 0 ? 1 : marks[i] === 2 ? 0 : 2;
    refreshAuto();
    const win = render();
    api.onChange({ marks });
    if (win) api.onWin();
  }
  function cellAt(e) {
    const b = grid.getBoundingClientRect();
    const c = Math.floor(((e.clientX - b.left) / b.width) * n), r = Math.floor(((e.clientY - b.top) / b.height) * n);
    return r < 0 || c < 0 || r >= n || c >= n ? -1 : r * n + c;
  }
  // Press and drag paints an X on every empty cell passed over; a plain tap cycles the cell.
  let down = -1, last = -1, dragged = false;
  const paint = (i) => { if (i >= 0 && marks[i] === 0) { marks[i] = 1; render(); } };
  // Fill every cell on the straight line between two cells so a fast swipe leaves no gaps.
  const paintLine = (a, b) => {
    const ar = Math.floor(a / n), ac = a % n, br = Math.floor(b / n), bc = b % n;
    const steps = Math.max(Math.abs(br - ar), Math.abs(bc - ac), 1);
    for (let k = 0; k <= steps; k++) paint(Math.round(ar + ((br - ar) * k) / steps) * n + Math.round(ac + ((bc - ac) * k) / steps));
  };
  grid.addEventListener('pointerdown', (e) => {
    if (api.isSolved()) return;
    e.preventDefault();
    grid.setPointerCapture(e.pointerId);
    down = last = cellAt(e); dragged = false;
  });
  grid.addEventListener('pointermove', (e) => {
    if (down < 0) return;
    const i = cellAt(e);
    if (i < 0 || i === last) return;
    if (!dragged) { dragged = true; paint(down); }
    paintLine(last, i);
    last = i;
  });
  const up = () => {
    if (down < 0) return;
    if (dragged) api.onChange({ marks }); else tap(down);
    down = -1; dragged = false;
  };
  grid.addEventListener('pointerup', up);
  grid.addEventListener('pointercancel', () => { if (dragged) api.onChange({ marks }); down = -1; dragged = false; });
  api.addAction('Clear', () => { if (api.isSolved()) return; marks.fill(0); render(); api.onChange({ marks }); });
  const toggle = api.addAction('', () => {
    autoX = !autoX;
    localStorage.setItem(AUTO_KEY, autoX ? 'on' : 'off');
    toggle.textContent = 'Auto-X: ' + (autoX ? 'on' : 'off');
    if (api.isSolved()) return;
    refreshAuto(); render(); api.onChange({ marks });
  });
  toggle.textContent = 'Auto-X: ' + (autoX ? 'on' : 'off');
  render();
}

// State that shows the solved board, used for replays.
export function solvedState(puzzle) {
  const marks = new Array(puzzle.n * puzzle.n).fill(0);
  puzzle.solution.forEach((c, r) => { marks[r * puzzle.n + c] = 2; });
  return { marks };
}
