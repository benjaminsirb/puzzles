import { makeRng } from '../lib/rng.js';

export const id = 'patches';
export const name = 'Patches';
export const sizes = [5, 6, 7];
export const defaultSize = 6;
export const rules = 'Divide the grid into rectangles so every rectangle holds exactly one clue. The number is the area. The icon is the shape: square, tall, wide, or dashed for any rectangle. Drag from one corner to the opposite corner to draw a patch. Tap a patch to remove it.';

const PALETTE = ['#f7b8b8', '#fbd59f', '#f8f1a0', '#bfe8b5', '#aee0ee', '#c3c6f5', '#e8bdee', '#dccfbd', '#b2e8d6', '#f5c3df', '#ffd6a5', '#caffbf'];
const ICONS = {
  square: '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="1.5" fill="currentColor"/></svg>',
  tall: '<svg viewBox="0 0 20 20"><rect x="6" y="2" width="8" height="16" rx="1.5" fill="currentColor"/></svg>',
  wide: '<svg viewBox="0 0 20 20"><rect x="2" y="6" width="16" height="8" rx="1.5" fill="currentColor"/></svg>',
  any: '<svg viewBox="0 0 20 20"><rect x="3" y="5" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.5 2"/></svg>',
};

function partition(n, rng) {
  const taken = new Uint8Array(n * n);
  const rects = [];
  const maxArea = n <= 5 ? 9 : n === 6 ? 12 : 14;
  for (const i of rng.shuffle([...Array(n * n).keys()])) {
    if (taken[i]) continue;
    const r0 = Math.floor(i / n), c0 = i % n;
    let w = 1, h = 1;
    for (let s = 0; s < 10; s++) {
      if (s > 1 && rng.chance(0.15)) break;
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

export function generate(seed, size) {
  const n = size || defaultSize;
  const rng = makeRng(seed);
  let last = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const rects = partition(n, rng);
    const singles = rects.filter((x) => x.h * x.w === 1).length;
    const small = rects.filter((x) => x.h * x.w <= 2).length;
    if (singles > 1 || small > 2 || rects.length < n - 1 || rects.length > n + 3) continue;
    const clues = rects.map((rc) => ({
      r: rc.r + rng.int(rc.h), c: rc.c + rng.int(rc.w), area: rc.h * rc.w,
      shape: rng.chance(0.45) ? shapeOf(rc.h, rc.w) : 'any', truth: shapeOf(rc.h, rc.w),
    }));
    let cnt = countSolutions(n, clues);
    const anyIdx = rng.shuffle(clues.map((c, i) => (c.shape === 'any' ? i : -1)).filter((i) => i >= 0));
    while (cnt !== 1 && anyIdx.length) {
      const i = anyIdx.pop();
      clues[i].shape = clues[i].truth;
      cnt = countSolutions(n, clues);
    }
    last = { n, clues: clues.map(({ r, c, area, shape }) => ({ r, c, area, shape })), solution: rects };
    if (cnt === 1) return last;
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
    if (clueAt[i] >= 0) {
      const cl = clues[clueAt[i]];
      const num = document.createElement('div'); num.className = 'clue'; num.textContent = cl.area;
      const ic = document.createElement('div'); ic.className = 'icon'; ic.innerHTML = ICONS[cl.shape];
      d.appendChild(num); d.appendChild(ic);
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
  function render() {
    overlay.innerHTML = '';
    owner.fill(-1);
    patches.forEach((p, pi) => {
      const el = document.createElement('div');
      el.className = 'patch'; el.style.background = PALETTE[p.ci % PALETTE.length];
      place(el, p); overlay.appendChild(el);
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
    const b = grid.getBoundingClientRect();
    const c = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - b.left) / b.width) * n)));
    const r = Math.min(n - 1, Math.max(0, Math.floor(((e.clientY - b.top) / b.height) * n)));
    return [r, c];
  }
  const box = (a, b) => ({ r: Math.min(a[0], b[0]), c: Math.min(a[1], b[1]), h: Math.abs(a[0] - b[0]) + 1, w: Math.abs(a[1] - b[1]) + 1 });
  function commit() { const win = render(); api.onChange({ patches }); if (win) api.onWin(); }

  let anchor = null;
  grid.addEventListener('pointerdown', (e) => {
    if (api.isSolved()) return;
    e.preventDefault();
    grid.setPointerCapture(e.pointerId);
    const [r, c] = cellAt(e);
    const o = owner[r * n + c];
    if (o >= 0) { patches.splice(o, 1); commit(); return; }
    anchor = [r, c];
    const rc = box(anchor, anchor);
    preview.classList.toggle('bad', validate(rc) < 0);
    place(preview, rc); preview.style.display = '';
  });
  grid.addEventListener('pointermove', (e) => {
    if (!anchor) return;
    const rc = box(anchor, cellAt(e));
    preview.classList.toggle('bad', validate(rc) < 0);
    place(preview, rc);
  });
  const finish = (e) => {
    if (!anchor) return;
    const rc = box(anchor, cellAt(e));
    anchor = null; preview.style.display = 'none';
    const ci = validate(rc);
    if (ci >= 0) { patches.push({ ...rc, ci }); commit(); }
  };
  grid.addEventListener('pointerup', finish);
  grid.addEventListener('pointercancel', () => { anchor = null; preview.style.display = 'none'; });
  api.addAction('Clear', () => { if (api.isSolved()) return; patches = []; commit(); });
  render();
}
