import { makeRng } from '../lib/rng.js';

export const id = 'patches';
export const name = 'Patches';
export const levels = ['easy', 'medium', 'hard'];
const SIZE = { easy: 5, medium: 6, hard: 7 };
export const rules = 'Divide the grid into rectangles so every rectangle holds exactly one clue. The number is the area. The tile's outline is the shape: square, tall, wide, or a dashed plus for any rectangle. Drag from one corner to the opposite corner, or tap the two corners, to draw a patch. Tap a patch to remove it.';

// Soft mid-tones that carry white numerals; a placed patch shows a pale wash of its clue's colour.
const PALETTE = ['#4ba35d', '#d5b864', '#dc6662', '#a58cf5', '#4296a8', '#e9a066', '#4fa9f0', '#4a7f40', '#e08a6f', '#d27aa8', '#7f8fd6', '#52b39a'];

function partition(n, rng, maxArea, stop) {
  const taken = new Uint8Array(n * n);
  const rects = [];
  for (const i of rng.shuffle([...Array(n * n).keys()])) {
    if (taken[i]) continue;
    const r0 = Math.floor(i / n), c0 = i % n;
    let w = 1, h = 1;
    for (let s = 0; s < 10; s++) {
      if (s > 1 && rng.chance(stop)) break;
      let grew = false;
      for (const d of rng.shuffle(['r', 'd'])) {
        if (d === 'r' && c0 + w < n && (w + 1) * h <= maxArea) {
          let free = true;
          for (let r = r0; r < r0 + h; r++) if (taken[r * n + c0 + w]) { free = false; break; }
          if (free) { w++; grew = true; break; }
        } else if (d === 'd' && r0 + h < n && w * (h + 1) <= maxArea) {
          let free = true;
          for (let c = c0; c < c0 + w; c++) if (taken[(r0 + h) * n + c]) { free = false; break; }
          if (free) { h++; grew = true; break; }
        }
      }
      if (!grew) break;
    }
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) taken[r * n + c] = 1;
    rects.push({ r: r0, c: c0, h, w });
  }
  return rects;
}

const shapeOf = (h, w) => (h === w ? 'square' : h > w ? 'tall' : 'wide');

function candidates(n, clues, ci) {
  const cl = clues[ci], out = [];
  for (let h = 1; h <= n; h++) {
    if (cl.area % h) continue;
    const w = cl.area / h;
    if (w > n) continue;
    if (cl.shape !== 'any' && shapeOf(h, w) !== cl.shape) continue;
    for (let r = cl.r - h + 1; r <= cl.r; r++) {
      if (r < 0 || r + h > n) continue;
      for (let c = cl.c - w + 1; c <= cl.c; c++) {
        if (c < 0 || c + w > n) continue;
        let okc = true;
        for (let j = 0; j < clues.length && okc; j++) {
          if (j === ci) continue;
          const o = clues[j];
          if (o.r >= r && o.r < r + h && o.c >= c && o.c < c + w) okc = false;
        }
        if (okc) out.push({ r, c, h, w });
      }
    }
  }
  return out;
}

function countSolutions(n, clues, limit = 2) {
  const cands = clues.map((_, i) => candidates(n, clues, i));
  const cover = new Uint8Array(n * n);
  const assigned = new Array(clues.length).fill(false);
  let count = 0;
  const fits = (rc) => {
    for (let r = rc.r; r < rc.r + rc.h; r++) for (let c = rc.c; c < rc.c + rc.w; c++) if (cover[r * n + c]) return false;
    return true;
  };
  const set = (rc, v) => {
    for (let r = rc.r; r < rc.r + rc.h; r++) for (let c = rc.c; c < rc.c + rc.w; c++) cover[r * n + c] = v;
  };
  const rec = (done) => {
    if (count >= limit) return;
    if (done === clues.length) { count++; return; }
    let best = -1, bestList = null;
    for (let i = 0; i < clues.length; i++) {
      if (assigned[i]) continue;
      const list = cands[i].filter(fits);
      if (!list.length) return;
      if (best < 0 || list.length < bestList.length) { best = i; bestList = list; }
    }
    assigned[best] = true;
    for (const rc of bestList) { set(rc, 1); rec(done + 1); set(rc, 0); if (count >= limit) break; }
    assigned[best] = false;
  };
  rec(0);
  return count;
}

// ---- Human-technique solver used for grading ----
// Level 1: forced rectangles and cells only one clue can reach. Level 2: one-rectangle lookahead. Level 3: bifurcation.
function grade(n, clues) {
  const N = n * n;
  let cands = clues.map((_, i) => candidates(n, clues, i));
  const cover = new Int16Array(N).fill(-1);
  const fixed = new Array(clues.length).fill(false);
  const cellsOf = (rc) => { const out = []; for (let r = rc.r; r < rc.r + rc.h; r++) for (let c = rc.c; c < rc.c + rc.w; c++) out.push(r * n + c); return out; };
  const fits = (rc) => cellsOf(rc).every((i) => cover[i] < 0);
  const fix = (ci, rc) => { for (const i of cellsOf(rc)) cover[i] = ci; fixed[ci] = true; cands[ci] = [rc]; };
  const direct = () => {
    let changed = false;
    for (let ci = 0; ci < clues.length; ci++) {
      if (fixed[ci]) continue;
      const list = cands[ci].filter(fits);
      if (!list.length) throw 0;
      if (list.length < cands[ci].length) { cands[ci] = list; changed = true; }
      if (list.length === 1) { fix(ci, list[0]); changed = true; }
    }
    // a free cell reachable by exactly one clue pins that clue to rectangles covering it
    const reach = Array.from({ length: N }, () => new Set());
    for (let ci = 0; ci < clues.length; ci++) if (!fixed[ci]) for (const rc of cands[ci]) for (const i of cellsOf(rc)) reach[i].add(ci);
    for (let i = 0; i < N; i++) {
      if (cover[i] >= 0) continue;
      if (reach[i].size === 0) throw 0;
      if (reach[i].size === 1) {
        const ci = [...reach[i]][0];
        const list = cands[ci].filter((rc) => cellsOf(rc).includes(i));
        if (list.length < cands[ci].length) { cands[ci] = list; changed = true; }
      }
    }
    return changed;
  };
  let rounds = 0;
  const propagate = () => { while (direct()) rounds++; };
  const snapshot = () => ({ cands: cands.map((l) => l.slice()), cover: cover.slice(), fixed: fixed.slice() });
  const restore = (s) => { cands = s.cands; cover.set(s.cover); for (let i = 0; i < fixed.length; i++) fixed[i] = s.fixed[i]; };
  const gimmes = cands.filter((l) => l.length === 1).length;
  const ambiguity = cands.reduce((a, l) => a + l.length, 0) / clues.length;
  let level = 1, deep = 0;
  for (let guard = 0; guard < 200; guard++) {
    try { propagate(); } catch { return null; }
    if (fixed.every(Boolean)) return { level, deep, rounds, gimmes, ambiguity };
    let found = false;
    for (let ci = 0; ci < clues.length && !found; ci++) {
      if (fixed[ci]) continue;
      for (const rc of cands[ci]) {
        const snap = snapshot();
        fix(ci, rc);
        let bad = false;
        try { propagate(); } catch { bad = true; }
        restore(snap);
        if (bad) { cands[ci] = cands[ci].filter((x) => x !== rc); found = true; level = Math.max(level, 2); deep++; break; }
      }
    }
    if (!found) return { level: 3, deep, rounds, gimmes, ambiguity };
  }
  return null;
}

const PARAMS = {
  easy: { maxArea: 9, stop: 0.15, small: 2, minRects: 4, maxRects: 8, show: 0.7 },
  medium: { maxArea: 8, stop: 0.3, small: 4, minRects: 8, maxRects: 12, show: 0.15 },
  hard: { maxArea: 8, stop: 0.3, small: 5, minRects: 10, maxRects: 14, show: 0.1 },
};
// Shikaku is solved by spotting forced cells, so difficulty is how many passes of deduction it takes
// and how few clues start with a single placement.
const FITS = {
  easy: (g, k) => g.level === 1 && g.rounds <= 2 && g.gimmes / k >= 0.35,
  medium: (g) => g.level === 1 && g.rounds === 3,
  hard: (g) => (g.level === 1 && g.rounds >= 4) || (g.level === 2 && g.deep <= 2),
};
export { grade as _grade, partition as _partition, countSolutions as _count, shapeOf as _shape };

export function generate(seed, diff = 'medium') {
  const n = SIZE[diff] || SIZE.medium;
  const rng = makeRng(seed);
  let last = null;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const P = PARAMS[diff] || PARAMS.medium;
    const rects = partition(n, rng, P.maxArea, P.stop);
    const singles = rects.filter((x) => x.h * x.w === 1).length;
    const small = rects.filter((x) => x.h * x.w <= 2).length;
    if (singles > 0 || small > P.small || rects.length < P.minRects || rects.length > P.maxRects) continue;
    const showShape = P.show;
    const clues = rects.map((rc) => ({
      r: rc.r + rng.int(rc.h), c: rc.c + rng.int(rc.w), area: rc.h * rc.w,
      shape: rng.chance(showShape) ? shapeOf(rc.h, rc.w) : 'any', truth: shapeOf(rc.h, rc.w),
    }));
    let cnt = countSolutions(n, clues);
    const anyIdx = rng.shuffle(clues.map((c, i) => (c.shape === 'any' ? i : -1)).filter((i) => i >= 0));
    while (cnt !== 1 && anyIdx.length) {
      const i = anyIdx.pop();
      clues[i].shape = clues[i].truth;
      cnt = countSolutions(n, clues);
    }
    if (cnt !== 1) continue;
    const stripped = clues.map(({ r, c, area, shape }) => ({ r, c, area, shape }));
    const g = grade(n, stripped);
    last = { n, diff, clues: stripped, solution: rects, grade: g, tries: attempt + 1 };
    if (g && FITS[diff](g, stripped.length)) return last;
  }
  return last;
}

export function mount(root, puzzle, api, saved) {
  const { n, clues } = puzzle;
  const N = n * n;
  const clueAt = new Array(N).fill(-1);
  clues.forEach((cl, i) => { clueAt[cl.r * n + cl.c] = i; });
  let patches = saved && Array.isArray(saved.patches) ? saved.patches.slice() : [];

  const wrap = document.createElement('div');
  wrap.className = 'wrap patches';
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--n', n);
  for (let i = 0; i < N; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    if (i % n === n - 1) d.classList.add('lc');
    if (i >= N - n) d.classList.add('lr');
    if (clueAt[i] >= 0) {
      const cl = clues[clueAt[i]];
      d.classList.add('cluecell');
      // The tile's own outline is the shape clue: square, tall, wide, or a dashed plus for any shape.
      const t = document.createElement('div');
      t.className = 'ptile ' + cl.shape;
      t.style.setProperty('--pc', PALETTE[clueAt[i] % PALETTE.length]);
      if (cl.shape === 'any') t.innerHTML = '<i class="arm v"></i><i class="arm h"></i><i class="core"></i>';
      const num = document.createElement('span'); num.className = 'clue'; num.textContent = cl.area;
      t.appendChild(num); d.appendChild(t);
    }
    grid.appendChild(d);
  }
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const preview = document.createElement('div');
  preview.className = 'preview'; preview.style.display = 'none';
  wrap.appendChild(grid); wrap.appendChild(overlay); wrap.appendChild(preview); root.appendChild(wrap);

  const place = (el, rc) => {
    el.style.left = (rc.c / n) * 100 + '%'; el.style.top = (rc.r / n) * 100 + '%';
    el.style.width = (rc.w / n) * 100 + '%'; el.style.height = (rc.h / n) * 100 + '%';
  };
  const owner = new Int16Array(N);
  const patchEls = [];
  function render() {
    overlay.innerHTML = '';
    owner.fill(-1); patchEls.length = 0;
    patches.forEach((p, pi) => {
      const el = document.createElement('div');
      el.className = 'patch'; el.style.setProperty('--pc', PALETTE[p.ci % PALETTE.length]);
      // The win glimmer ripples out from the board centre: patches farther out light up later.
      const d = Math.hypot(p.c + p.w / 2 - n / 2, p.r + p.h / 2 - n / 2) / Math.hypot(n / 2, n / 2);
      el.style.setProperty('--sd', (d * 0.32).toFixed(3) + 's');
      place(el, p); overlay.appendChild(el); patchEls.push(el);
      for (let r = p.r; r < p.r + p.h; r++) for (let c = p.c; c < p.c + p.w; c++) owner[r * n + c] = pi;
    });
    let covered = 0;
    for (let i = 0; i < N; i++) if (owner[i] >= 0) covered++;
    return covered === N;
  }
  function validate(rc) {
    let ci = -1;
    for (let r = rc.r; r < rc.r + rc.h; r++) for (let c = rc.c; c < rc.c + rc.w; c++) {
      const i = r * n + c;
      if (owner[i] >= 0) return -1;
      if (clueAt[i] >= 0) { if (ci >= 0) return -1; ci = clueAt[i]; }
    }
    if (ci < 0) return -1;
    const cl = clues[ci];
    if (cl.area !== rc.h * rc.w) return -1;
    if (cl.shape !== 'any' && shapeOf(rc.h, rc.w) !== cl.shape) return -1;
    return ci;
  }
  function cellAt(e) {
    // Measure from the first cell, not the grid rect: the grid border would skew every boundary.
    const b = grid.children[0].getBoundingClientRect();
    const c = Math.min(n - 1, Math.max(0, Math.floor((e.clientX - b.left) / b.width)));
    const r = Math.min(n - 1, Math.max(0, Math.floor((e.clientY - b.top) / b.height)));
    return [r, c];
  }
  const box = (a, b) => ({ r: Math.min(a[0], b[0]), c: Math.min(a[1], b[1]), h: Math.abs(a[0] - b[0]) + 1, w: Math.abs(a[1] - b[1]) + 1 });
  function commit() { const win = render(); api.onChange({ patches }); if (win) api.onWin(); }

  // A gesture runs from one corner to the other: press-drag-release, or tap a corner (it stays
  // armed) and tap the opposite one; tap the armed corner again to cancel. Only the pointer that
  // started the gesture drives it, so a stray second finger never eats a patch or the drag.
  let anchor = null, pid = null, armed = false;
  const cancel = () => { anchor = null; pid = null; armed = false; preview.style.display = 'none'; };
  grid.addEventListener('pointerdown', (e) => {
    if (api.isSolved() || pid !== null) return;
    e.preventDefault();
    grid.setPointerCapture(e.pointerId);
    pid = e.pointerId;
    armed = !!anchor;
    const [r, c] = cellAt(e);
    if (!anchor) {
      const o = owner[r * n + c];
      if (o >= 0) { pid = null; patches.splice(o, 1); commit(); return; }
      anchor = [r, c];
    }
    const rc = box(anchor, [r, c]);
    preview.classList.toggle('bad', rc.h * rc.w > 1 && validate(rc) < 0);
    place(preview, rc); preview.style.display = '';
  });
  grid.addEventListener('pointermove', (e) => {
    if (!anchor || pid === null || e.pointerId !== pid) return;
    const rc = box(anchor, cellAt(e));
    preview.classList.toggle('bad', rc.h * rc.w > 1 && validate(rc) < 0);
    place(preview, rc);
  });
  grid.addEventListener('pointerup', (e) => {
    if (pid === null || e.pointerId !== pid) return;
    pid = null;
    if (!anchor) return;
    const rc = box(anchor, cellAt(e));
    if (rc.h === 1 && rc.w === 1) {
      if (armed) cancel();            // a tap on the armed corner disarms it
      else preview.classList.remove('bad'); // a plain tap arms the corner; the next tap finishes
      return;
    }
    anchor = null; armed = false; preview.style.display = 'none';
    const ci = validate(rc);
    if (ci >= 0) { patches.push({ ...rc, ci }); commit(); }
  });
  grid.addEventListener('pointercancel', (e) => { if (pid === null || e.pointerId === pid) cancel(); });
  api.addAction('Clear', () => { if (api.isSolved()) return; patches = []; cancel(); commit(); });
  const cellEls = [...grid.children];
  api.addAction('Hint', () => {
    if (api.isSolved()) return;
    const sol = puzzle.solution;
    const same = (a, b) => a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w;
    const wrong = patches.findIndex((p) => !sol.some((rc) => same(rc, p)));
    if (wrong >= 0) { api.hint([patchEls[wrong]], 'This patch is wrong. Tap it to remove it.'); return; }
    const placed = new Set(patches.map((p) => p.ci));
    const free = (rc) => { for (let r = rc.r; r < rc.r + rc.h; r++) for (let c = rc.c; c < rc.c + rc.w; c++) if (owner[r * n + c] >= 0) return false; return true; };
    const open = clues.map((cl, ci) => (placed.has(ci) ? null : candidates(n, clues, ci).filter(free)));
    const single = open.findIndex((list) => list && list.length === 1);
    if (single >= 0) { const cl = clues[single]; api.hint([cellEls[cl.r * n + cl.c]], 'This clue has only one possible rectangle.'); return; }
    const reach = Array.from({ length: N }, () => new Set());
    open.forEach((list, ci) => { if (list) for (const rc of list) for (let r = rc.r; r < rc.r + rc.h; r++) for (let c = rc.c; c < rc.c + rc.w; c++) reach[r * n + c].add(ci); });
    for (let i = 0; i < N; i++) {
      if (owner[i] >= 0 || reach[i].size !== 1) continue;
      const ci = [...reach[i]][0], cl = clues[ci];
      api.hint([cellEls[i], cellEls[cl.r * n + cl.c]], 'Only one clue can reach this cell.'); return;
    }
    let best = -1;
    open.forEach((list, ci) => { if (list && (best < 0 || list.length < open[best].length)) best = ci; });
    if (best >= 0) { const cl = clues[best]; api.hint([cellEls[cl.r * n + cl.c]], 'Start with this clue. It has the fewest options.'); }
  });
  render();
}

export function solvedState(puzzle) { return { patches: puzzle.solution.map((rc, i) => ({ ...rc, ci: i })) }; }
