import * as queens from './games/queens.js';
import * as tango from './games/tango.js';
import * as zip from './games/zip.js';
import * as patches from './games/patches.js';
import * as solves from './lib/history.js';

// Register the worker first so an update is never blocked by a later error. When a new
// version takes control of an already-open page, reload once so every file matches.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

const GAMES = [queens, tango, zip, patches];
const $ = (s) => document.querySelector(s);
const els = {
  home: $('#home'), gameView: $('#game'), tiles: $('#tiles'), homeBtn: $('#home-btn'), title: $('#title'), statsHome: $('#stats-home'), timer: $('#timer'), size: $('#size'), newBtn: $('#new'),
  board: $('#board'), actions: $('#actions'), rules: $('#rules'), seed: $('#seed'), statsBtn: $('#stats'),
  results: $('#results'), rGames: $('#results-games'), rSizes: $('#results-sizes'), rTiles: $('#results-tiles'), rChart: $('#results-chart'), rTip: $('#results-tip'), rTable: $('#results-table'), rClose: $('#results-close'), rClear: $('#results-clear'), modalResults: $('#modal-results'),
  cover: $('#cover'), coverTitle: $('#cover-title'), coverSub: $('#cover-sub'), coverBtn: $('#cover-btn'),
  modal: $('#modal'), modalTitle: $('#modal-title'), modalSub: $('#modal-sub'), modalClose: $('#modal-close'), modalNew: $('#modal-new'), confetti: $('#confetti'),
};

let current = null;
let tick = null;

const key = (id) => 'puzzles.' + id;
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
function load(id) { try { const s = localStorage.getItem(key(id)); return s ? JSON.parse(s) : null; } catch { return null; } }
function save() {
  if (!current) return;
  try {
    localStorage.setItem(key(current.game.id), JSON.stringify({
      seed: current.seed, size: current.size, state: current.state, elapsed: current.elapsed, solved: current.solved,
    }));
  } catch { /* storage unavailable */ }
}

function fmt(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function renderTimer() {
  if (!current) return;
  els.timer.textContent = fmt(current.elapsed + (current.startedAt ? performance.now() - current.startedAt : 0));
}
function startTimer() {
  if (!current || current.solved || current.startedAt) return;
  current.startedAt = performance.now();
  tick = setInterval(renderTimer, 250);
}
function pauseTimer() {
  if (!current || !current.startedAt) return;
  current.elapsed += performance.now() - current.startedAt;
  current.startedAt = null;
  clearInterval(tick); tick = null;
  save();
}
function cover(label) {
  els.coverTitle.textContent = current.game.name;
  els.coverSub.textContent = current.size ? current.size + '×' + current.size : '';
  els.coverBtn.textContent = label;
  els.cover.hidden = false;
  els.board.classList.add('covered');
}
function uncover() {
  els.cover.hidden = true;
  els.board.classList.remove('covered');
  startTimer();
}
els.coverBtn.onclick = uncover;
// Leaving the tab pauses the clock and hides the board until Resume.
document.addEventListener('visibilitychange', () => {
  if (!current || current.solved) return;
  if (document.hidden) { pauseTimer(); cover('Resume'); }
});

const PRAISE = ['Nice work!', 'Crushed it!', 'Flawless.', 'Good job!', 'Brilliant!', 'Too easy?'];

function celebrate(ms) {
  // Stagger the pop of every solved piece on the board.
  const pieces = els.board.querySelectorAll('.queens .cell svg:not(.x), .tango .cell svg, .zip .num.hit, .patches .patch');
  pieces.forEach((el, i) => { el.style.setProperty('--d', (i * 0.06) + 's'); });
  confetti();
  setTimeout(() => {
    els.modalTitle.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    els.modalSub.textContent = 'Solved in ' + fmt(ms);
    els.modal.hidden = false;
  }, 900);
}

function confetti() {
  const cv = els.confetti, ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  cv.hidden = false;
  const colors = ['#f2b705', '#2563eb', '#ef4444', '#22c55e', '#a855f7', '#f97316'];
  const parts = [];
  const rect = els.board.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  for (let i = 0; i < 110; i++) {
    const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 9;
    parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      c: colors[i % colors.length], r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3 });
  }
  const t0 = performance.now();
  const frame = (t) => {
    const k = (t - t0) / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.98; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - k / 1.8);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (k < 1.8) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); cv.hidden = true; }
  };
  requestAnimationFrame(frame);
}

function newPuzzle(game, seed, size, saved) {
  pauseTimer();
  els.modal.hidden = true;
  const puzzle = game.generate(seed, size);
  current = {
    game, puzzle, seed, size,
    state: saved ? saved.state : null, elapsed: saved ? saved.elapsed || 0 : 0,
    solved: saved ? !!saved.solved : false, startedAt: null,
  };
  els.board.innerHTML = ''; els.actions.innerHTML = '';
  els.board.classList.toggle('solved', current.solved);
  els.rules.textContent = game.rules;
  els.seed.textContent = '#' + seed + (size ? ' · ' + size + '×' + size : '');
  const api = {
    onChange(state) {
      current.state = state;
      save();
    },
    onWin() {
      if (current.solved) return;
      pauseTimer(); current.solved = true; save(); renderTimer();
      solves.add({ g: game.id, n: size || 0, seed, ms: Math.round(current.elapsed), at: Date.now() });
      els.board.classList.add('solved');
      celebrate(current.elapsed);
    },
    isSolved: () => current.solved,
    addAction(label, fn) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.textContent = label; b.onclick = fn;
      els.actions.appendChild(b); return b;
    },
  };
  game.mount(els.board, puzzle, api, current.state);
  renderTimer();
  save();
  if (current.solved) { els.cover.hidden = true; els.board.classList.remove('covered'); }
  else cover(current.elapsed > 0 ? 'Resume' : 'Start game');
}

// Size preference per game: 'random' (default) or a fixed size.
const sizeKey = (id) => key(id) + '.sizeMode';
const sizeMode = (game) => { const v = localStorage.getItem(sizeKey(game.id)); return v && (v === 'random' || game.sizes.includes(+v)) ? v : 'random'; };
const resolveSize = (game) => {
  if (!game.sizes) return null;
  const mode = sizeMode(game);
  return mode === 'random' ? game.sizes[Math.floor(Math.random() * game.sizes.length)] : +mode;
};

const GLYPHS = {
  queens: { bg: '#f8f1a0', svg: '<svg viewBox="0 0 24 24" fill="#1b1f2a"><path d="M4 18h16l1.2-9-4.6 3.2L12 5l-4.6 7.2L2.8 9z"/><rect x="4" y="19" width="16" height="2.5" rx="1"/></svg>' },
  tango: { bg: '#fde7c2', svg: '<svg viewBox="0 0 48 24"><circle cx="13" cy="12" r="6" fill="#f59e0b"/><g stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><path d="M13 1.5v3M13 19.5v3M2.5 12h3M20.5 12h3M5.6 4.6l2.1 2.1M18.3 17.3l2.1 2.1M5.6 19.4l2.1-2.1M18.3 6.7l2.1-2.1"/></g><path d="M37.5 3a9 9 0 1 0 6.5 15.3A8 8 0 0 1 37.5 3z" fill="#60a5fa"/></svg>' },
  zip: { bg: '#dbe7ff', svg: '<svg viewBox="0 0 40 24" fill="none"><path d="M6 6h14v12h14" stroke="#2563eb" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="6" r="4.5" fill="#1b1f2a"/><circle cx="34" cy="18" r="4.5" fill="#1b1f2a"/></svg>' },
  patches: { bg: '#e6f4e1', svg: '<svg viewBox="0 0 40 24"><rect x="1" y="1" width="16" height="22" rx="2" fill="#f7b8b8"/><rect x="19" y="1" width="20" height="10" rx="2" fill="#c3c6f5"/><rect x="19" y="13" width="9" height="10" rx="2" fill="#bfe8b5"/><rect x="30" y="13" width="9" height="10" rx="2" fill="#fbd59f"/></svg>' },
};
const TAGLINES = { queens: 'One queen per row, column and region.', tango: 'Suns and moons, three of each.', zip: 'One path through every cell.', patches: 'Tile the grid with rectangles.' };

function showHome() {
  pauseTimer();
  els.gameView.hidden = true; els.home.hidden = false;
  els.homeBtn.hidden = true; els.statsHome.hidden = false;
  els.title.textContent = 'Puzzles';
  els.modal.hidden = true;
  if (location.hash) history.replaceState(null, '', location.pathname);
  els.tiles.innerHTML = '';
  for (const g of GAMES) {
    const st = solves.stats(solves.filter(g.id, null));
    const b = document.createElement('button');
    b.className = 'tile-game';
    b.innerHTML = `<div class="glyph" style="background:${GLYPHS[g.id].bg}">${GLYPHS[g.id].svg}</div><div class="name">${g.name}</div><div class="tag">${TAGLINES[g.id]}</div><div class="meta">${st ? `Best <b>${fmt(st.best)}</b> · ${st.count} solved` : 'Not played yet'}</div>`;
    b.onclick = () => { location.hash = g.id; };
    els.tiles.appendChild(b);
  }
}

function selectGame(id) {
  const game = GAMES.find((g) => g.id === id);
  if (!game) { showHome(); return; }
  els.home.hidden = true; els.gameView.hidden = false;
  els.homeBtn.hidden = false; els.statsHome.hidden = true;
  els.title.textContent = game.name;
  localStorage.setItem('puzzles.current', game.id);
  if (location.hash !== '#' + game.id) history.replaceState(null, '', '#' + game.id);
  if (game.sizes) {
    els.size.hidden = false;
    els.size.innerHTML = '<option value="random">Random</option>' + game.sizes.map((s) => `<option value="${s}">${s}×${s}</option>`).join('');
    els.size.value = sizeMode(game);
  } else els.size.hidden = true;
  const saved = load(game.id);
  if (saved && saved.seed != null && (!game.sizes || game.sizes.includes(saved.size))) newPuzzle(game, saved.seed, saved.size, saved);
  else newPuzzle(game, randomSeed(), resolveSize(game), null);
}

function route() {
  const id = location.hash.slice(1);
  if (id && GAMES.some((g) => g.id === id)) { if (!current || current.game.id !== id || els.gameView.hidden) selectGame(id); }
  else showHome();
}
els.homeBtn.onclick = () => { location.hash = ''; };
els.statsHome.onclick = () => openResults(localStorage.getItem('puzzles.current') || 'queens');

els.newBtn.onclick = () => newPuzzle(current.game, randomSeed(), resolveSize(current.game), null);
els.modalNew.onclick = els.newBtn.onclick;
els.modalClose.onclick = () => { els.modal.hidden = true; };
els.modalResults.onclick = () => { els.modal.hidden = true; openResults(current.game.id); };
els.statsBtn.onclick = () => openResults(current.game.id);
els.rClose.onclick = () => { els.results.hidden = true; };
els.results.addEventListener('click', (e) => { if (e.target === els.results) els.results.hidden = true; });
els.rClear.onclick = () => { if (confirm('Delete all recorded solve times?')) { solves.clear(); renderResults(); } };
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.hidden = true; });
els.size.onchange = () => { localStorage.setItem(sizeKey(current.game.id), els.size.value); newPuzzle(current.game, randomSeed(), resolveSize(current.game), null); };
window.addEventListener('hashchange', route);

// ---- Results view ----
let rSel = { game: 'queens', size: null };
function openResults(gameId) {
  rSel = { game: gameId, size: 'all' };
  els.results.hidden = false;
  renderResults();
}
function pill(label, active, fn) {
  const b = document.createElement('button');
  b.textContent = label; b.classList.toggle('active', active); b.onclick = fn; return b;
}
function renderResults() {
  const game = GAMES.find((g) => g.id === rSel.game);
  els.rGames.innerHTML = '';
  for (const g of GAMES) els.rGames.appendChild(pill(g.name, g.id === rSel.game, () => { rSel = { game: g.id, size: 'all' }; renderResults(); }));
  els.rSizes.innerHTML = '';
  if (game.sizes) {
    if (rSel.size !== 'all' && !game.sizes.includes(rSel.size)) rSel.size = 'all';
    els.rSizes.appendChild(pill('All sizes', rSel.size === 'all', () => { rSel.size = 'all'; renderResults(); }));
    for (const n of game.sizes) els.rSizes.appendChild(pill(n + '×' + n, n === rSel.size, () => { rSel.size = n; renderResults(); }));
  } else rSel.size = null;
  const allSizes = !game.sizes || rSel.size === 'all';
  const list = solves.filter(rSel.game, game.sizes ? (allSizes ? null : rSel.size) : 0);
  const st = solves.stats(list);
  els.rTiles.innerHTML = '';
  for (const [k, v] of [['Solved', st ? st.count : 0], ['Best', st ? fmt(st.best) : '–'], ['Average', st ? fmt(st.avg) : '–'], ['Last 5', st ? fmt(st.last5) : '–']]) {
    const t = document.createElement('div'); t.className = 'tile';
    t.innerHTML = `<div class="v">${v}</div><div class="k">${k}</div>`;
    els.rTiles.appendChild(t);
  }
  drawChart(list, st);
  els.rTable.innerHTML = '';
  for (const e of list.slice().reverse().slice(0, 50)) {
    const tr = document.createElement('tr');
    const d = new Date(e.at);
    const sizeCol = game.sizes && allSizes ? `<td class="muted">${e.n}×${e.n}</td>` : '';
    tr.innerHTML = `<td class="muted">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</td>${sizeCol}<td>${fmt(e.ms)}</td>`;
    els.rTable.appendChild(tr);
  }
}
function niceStep(range) {
  const raw = range / 4;
  for (const s of [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]) if (s >= raw) return s;
  return 3600;
}
function drawChart(list, st) {
  const svg = els.rChart;
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  svg.innerHTML = ''; els.rTip.hidden = true;
  const W = 360, H = 200, padL = 40, padR = 12, padT = 14, padB = 24;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (!list.length) { svg.appendChild(el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'empty' }, 'No solves yet. Finish a puzzle to start the chart.')); return; }
  const secs = list.map((e) => e.ms / 1000);
  const step = niceStep(Math.max(...secs));
  const yMax = Math.max(step, Math.ceil(Math.max(...secs) / step) * step);
  const x = (i) => list.length === 1 ? (padL + W - padR) / 2 : padL + (i / (list.length - 1)) * (W - padL - padR);
  const y = (s) => padT + (1 - s / yMax) * (H - padT - padB);
  for (let v = 0; v <= yMax; v += step) {
    svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'grid-line' }));
    svg.appendChild(el('text', { x: padL - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'axis-label' }, fmt(v * 1000)));
  }
  svg.appendChild(el('text', { x: padL, y: H - 6, class: 'axis-label' }, 'first'));
  svg.appendChild(el('text', { x: W - padR, y: H - 6, 'text-anchor': 'end', class: 'axis-label' }, 'latest'));
  svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y(st.avg / 1000), y2: y(st.avg / 1000), class: 'avg' }));
  svg.appendChild(el('text', { x: W - padR, y: y(st.avg / 1000) - 4, 'text-anchor': 'end', class: 'axis-label' }, 'avg ' + fmt(st.avg)));
  if (list.length > 1) svg.appendChild(el('path', { d: secs.map((s, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(s).toFixed(1)).join(' '), class: 'series' }));
  const bestIdx = secs.indexOf(Math.min(...secs));
  const pts = secs.map((s, i) => { const c = el('circle', { cx: x(i), cy: y(s), r: 4, class: 'pt' + (i === bestIdx ? ' best' : '') }); svg.appendChild(c); return c; });
  const cross = el('line', { x1: 0, x2: 0, y1: padT, y2: H - padB, class: 'cross' }); cross.style.display = 'none'; svg.appendChild(cross);
  let hot = -1;
  const show = (i) => {
    if (i === hot) return;
    if (hot >= 0) pts[hot].classList.remove('hot');
    hot = i; pts[i].classList.add('hot');
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
    const r = svg.getBoundingClientRect();
    const d = new Date(list[i].at);
    els.rTip.textContent = fmt(list[i].ms) + (list[i].n ? ' · ' + list[i].n + '×' + list[i].n : '') + ' · ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    els.rTip.style.left = (x(i) / W) * r.width + 'px';
    els.rTip.style.top = (y(secs[i]) / H) * r.height + 'px';
    els.rTip.hidden = false;
  };
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < list.length; i++) { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } }
    show(best);
  };
  svg.onpointermove = onMove; svg.onpointerdown = onMove;
  svg.onpointerleave = () => { if (hot >= 0) pts[hot].classList.remove('hot'); hot = -1; cross.style.display = 'none'; els.rTip.hidden = true; };
}

route();

