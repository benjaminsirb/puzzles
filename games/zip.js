import { makeRng } from '../lib/rng.js';

export const id = 'zip';
export const name = 'Zip';
export const sizes = [6, 7];
export const defaultSize = 6;
export const rules = 'Draw one path from 1 to the last number, visiting the numbers in order and every cell exactly once. Thick lines are walls. Drag to draw, drag back or tap a cell on the path to undo.';

function randomHamPath(n, rng) {
  const N = n * n;
  let path = [];
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) path.push(r * n + (r % 2 === 0 ? k : n - 1 - k));
  const pos = new Array(N);
  const nb = (i) => {
    const r = Math.floor(i / n), c = i % n, out = [];
    if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
    return out;
  };
  // Backbite moves give a near-uniform random Hamiltonian path.
  for (let it = 0; it < N * N * 3; it++) {
    if (rng.chance(0.5)) path.reverse();
    for (let i = 0; i < N; i++) pos[path[i]] = i;
    const cand = nb(path[0]).filter((x) => pos[x] > 1);
    if (!cand.length) continue;
    const j = pos[rng.pick(cand)];
    path = path.slice(0, j).reverse().concat(path.slice(j));
  }
  return path;
}

// Enumerates up to `limit` solutions. Returns null when the step budget runs out.
function solutions(n, numAt, wallR, wallD, limit, budget) {
  const N = n * n;
  let total = 0;
  for (const k of numAt) if (k > total) total = k;
  const visited = new Uint8Array(N);
  const nbrs = [];
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / n), c = i % n, list = [];
    if (c > 0 && !wallR[r][c - 1]) list.push(i - 1);
    if (c < n - 1 && !wallR[r][c]) list.push(i + 1);
    if (r > 0 && !wallD[r - 1][c]) list.push(i - n);
    if (r < n - 1 && !wallD[r][c]) list.push(i + n);
    nbrs.push(list);
  }
  const out = [];
  const order = [];
  let steps = 0, aborted = false;
  const mark = new Int32Array(N);
  let stamp = 0;
  const stack = new Int32Array(N);
  // All unvisited cells must stay reachable from the head.
  const reachable = (head, seen) => {
    stamp++;
    let sp = 0, got = 0;
    for (const j of nbrs[head]) if (!visited[j] && mark[j] !== stamp) { mark[j] = stamp; stack[sp++] = j; got++; }
    while (sp) {
      const i = stack[--sp];
      for (const j of nbrs[i]) if (!visited[j] && mark[j] !== stamp) { mark[j] = stamp; stack[sp++] = j; got++; }
    }
    return got === N - seen;
  };
  const rec = (i, seen, expect) => {
    if (out.length >= limit || aborted) return;
    if (++steps > budget) { aborted = true; return; }
    if (seen === N) { out.push(order.slice()); return; }
    if (!reachable(i, seen)) return;
    for (const j of nbrs[i]) {
      if (visited[j]) continue;
      const k = numAt[j];
      let ne = expect;
      if (k) {
        if (k !== expect) continue;
        if (k === total && seen + 1 !== N) continue;
        ne = expect + 1;
      }
      visited[j] = 1; order.push(j);
      rec(j, seen + 1, ne);
      order.pop(); visited[j] = 0;
    }
  };
  const start = numAt.indexOf(1);
  visited[start] = 1; order.push(start);
  rec(start, 1, 2);
  return aborted ? null : out;
}

export function generate(seed, size) {
  const n = size || defaultSize;
  const N = n * n;
  const rng = makeRng(seed);
  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const path = randomHamPath(n, rng);
    const wallR = Array.from({ length: n }, () => new Array(n).fill(false));
    const wallD = Array.from({ length: n }, () => new Array(n).fill(false));
    const consec = new Set();
    for (let i = 0; i < N - 1; i++) { consec.add(path[i] + ',' + path[i + 1]); consec.add(path[i + 1] + ',' + path[i]); }
    const edges = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (c < n - 1) edges.push(['R', r, c]);
      if (r < n - 1) edges.push(['D', r, c]);
    }
    rng.shuffle(edges);
    const want = (n - 3) + rng.int(n - 1), used = [];
    for (const [d, r, c] of edges) {
      if (used.length >= want) break;
      const a = r * n + c, b = d === 'R' ? a + 1 : a + n;
      if (consec.has(a + ',' + b)) continue;
      if (d === 'R') wallR[r][c] = true; else wallD[r][c] = true;
      used.push([d, r, c]);
    }
    const posOf = new Array(N);
    path.forEach((cell, p) => { posOf[cell] = p; });
    const marks = new Set([0, N - 1]);
    for (let extra = 0; extra < 14; extra++) {
      const idx = [...marks].sort((a, b) => a - b);
      const numAt = new Array(N).fill(0);
      idx.forEach((p, i) => { numAt[path[p]] = i + 1; });
      last = { n, numAt, wallR, wallD, solution: path, count: idx.length };
      const sols = solutions(n, numAt, wallR, wallD, 2, 400000);
      if (sols && sols.length === 1) return last;
      // Greedy: try candidate cells where the alternate path diverges, keep the one that leaves fewest solutions.
      const alt = sols && sols.find((s) => s.some((cell, p) => cell !== path[p]));
      const cands = [];
      for (let p = 1; p < N - 1; p++) {
        if (marks.has(p)) continue;
        if (alt && alt[p] === path[p]) continue;
        cands.push(p);
      }
      rng.shuffle(cands);
      const distTo = (p) => { let d = Infinity; for (const m of idx) d = Math.min(d, Math.abs(m - p)); return d; };
      let pick = -1, bestScore = Infinity, bestDist = -1;
      for (const p of cands.slice(0, n <= 6 ? 10 : 6)) {
        const trial = numAt.slice();
        const ti = [...marks, p].sort((a, b) => a - b);
        trial.fill(0); ti.forEach((q, i) => { trial[path[q]] = i + 1; });
        const r = solutions(n, trial, wallR, wallD, n <= 6 ? 40 : 24, n <= 6 ? 120000 : 60000);
        const score = r ? r.length : 1000;
        const d = distTo(p);
        if (score < bestScore || (score === bestScore && d > bestDist)) { bestScore = score; bestDist = d; pick = p; }
        if (score === 1) break;
      }
      if (pick < 0) break;
      marks.add(pick);
    }
  }
  return last;
}

export function mount(root, puzzle, api, saved) {
  const { n, numAt, wallR, wallD } = puzzle;
  const N = n * n;
  let total = 0;
  for (const k of numAt) if (k > total) total = k;
  let path = saved && Array.isArray(saved.path) ? saved.path.slice() : [];
  if (path.length && numAt[path[0]] !== 1) path = [];

  const wrap = document.createElement('div');
  wrap.className = 'wrap zip';
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--n', n);
  const cells = [];
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / n), c = i % n;
    const d = document.createElement('div');
    d.className = 'cell';
    if (wallR[r][c]) d.classList.add('wr');
    if (wallD[r][c]) d.classList.add('wd');
    if (numAt[i]) { const s = document.createElement('div'); s.className = 'num'; s.textContent = numAt[i]; d.appendChild(s); }
    cells.push(d); grid.appendChild(d);
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'path'); svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  head.setAttribute('r', '0.21');
  svg.appendChild(line); svg.appendChild(head);
  wrap.appendChild(grid); wrap.appendChild(svg); root.appendChild(wrap);

  const inPath = new Uint8Array(N);
  function render() {
    inPath.fill(0);
    for (const i of path) inPath[i] = 1;
    line.setAttribute('points', path.map((i) => `${(i % n) + 0.5},${Math.floor(i / n) + 0.5}`).join(' '));
    if (path.length) {
      const h = path[path.length - 1];
      head.setAttribute('cx', (h % n) + 0.5); head.setAttribute('cy', Math.floor(h / n) + 0.5); head.style.display = '';
    } else head.style.display = 'none';
    for (let i = 0; i < N; i++) { const s = cells[i].firstChild; if (s) s.classList.toggle('hit', !!inPath[i]); }
    return path.length === N;
  }
  const expected = () => { let m = 0; for (const i of path) if (numAt[i] > m) m = numAt[i]; return m + 1; };
  function canStep(from, to) {
    const fr = Math.floor(from / n), fc = from % n, tr = Math.floor(to / n), tc = to % n;
    if (Math.abs(fr - tr) + Math.abs(fc - tc) !== 1 || inPath[to]) return false;
    if (fr === tr) { if (wallR[fr][Math.min(fc, tc)]) return false; } else if (wallD[Math.min(fr, tr)][fc]) return false;
    const k = numAt[to];
    if (k) { if (k !== expected()) return false; if (k === total && path.length + 1 !== N) return false; }
    return true;
  }
  function cellAt(e) {
    const b = grid.getBoundingClientRect();
    const c = Math.floor(((e.clientX - b.left) / b.width) * n), r = Math.floor(((e.clientY - b.top) / b.height) * n);
    if (r < 0 || c < 0 || r >= n || c >= n) return -1;
    return r * n + c;
  }
  function commit() { const win = render(); api.onChange({ path }); if (win) api.onWin(); }
  function step(to) {
    if (to < 0) return;
    if (!path.length) { if (numAt[to] === 1) { path.push(to); commit(); } return; }
    const headCell = path[path.length - 1];
    if (to === headCell) return;
    if (path.length > 1 && to === path[path.length - 2]) { path.pop(); commit(); return; }
    if (canStep(headCell, to)) { path.push(to); commit(); }
  }
  let dragging = false;
  grid.addEventListener('pointerdown', (e) => {
    if (api.isSolved()) return;
    e.preventDefault();
    grid.setPointerCapture(e.pointerId);
    dragging = true;
    const i = cellAt(e);
    if (i < 0) return;
    const at = path.indexOf(i);
    if (at >= 0) { path.length = at + 1; commit(); } else step(i);
  });
  grid.addEventListener('pointermove', (e) => { if (dragging && !api.isSolved()) step(cellAt(e)); });
  const end = () => { dragging = false; };
  grid.addEventListener('pointerup', end); grid.addEventListener('pointercancel', end);
  api.addAction('Clear', () => { if (api.isSolved()) return; path = []; commit(); });
  render();
}
