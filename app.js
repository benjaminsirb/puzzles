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

// iOS ignores the viewport zoom flags, so block double-tap and pinch zoom by hand.
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 320) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

const GAMES = [queens, tango, zip, patches];
const $ = (s) => document.querySelector(s);
const els = {
  home: $('#home'), gameView: $('#game'), tiles: $('#tiles'), homeBtn: $('#home-btn'), title: $('#title'), statsHome: $('#stats-home'), timer: $('#timer'), size: $('#size'), newBtn: $('#new'),
  board: $('#board'), actions: $('#actions'), hintmsg: $('#hintmsg'), rules: $('#rules'), seed: $('#seed'), statsBtn: $('#stats'),
  results: $('#results'), rGames: $('#results-games'), rSizes: $('#results-sizes'), rTiles: $('#results-tiles'), rChart: $('#results-chart'), rTip: $('#results-tip'), rTable: $('#results-table'), rClose: $('#results-close'), rClear: $('#results-clear'), modalResults: $('#modal-results'),
  cover: $('#cover'), coverTitle: $('#cover-title'), coverSub: $('#cover-sub'), coverBtn: $('#cover-btn'),
  modal: $('#modal'), modalTitle: $('#modal-title'), modalSub: $('#modal-sub'), modalClose: $('#modal-close'), modalNew: $('#modal-new'), modalShare: $('#modal-share'), shareTop: $('#share-top'), confetti: $('#confetti'),
};

let current = null;
let tick = null;
let hintTimer = null;
let celebrateTimer = null;

const key = (id) => 'puzzles.' + id;
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const LEVELS = ['easy', 'medium', 'hard'];
const label = (d) => d.charAt(0).toUpperCase() + d.slice(1);
function load(id) { try { const s = localStorage.getItem(key(id)); return s ? JSON.parse(s) : null; } catch { return null; } }
function save() {
  if (!current || current.replay) return;
  try {
    localStorage.setItem(key(current.game.id), JSON.stringify({
      seed: current.seed, diff: current.diff, state: current.state, elapsed: current.elapsed, solved: current.solved, shared: current.shared || null,
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
// A puzzle opened from a share link remembers the sharer's time, when they had one.
const sharedNote = () => current.shared ? (current.shared.ms ? ' · shared, solved in ' + fmt(current.shared.ms) : ' · shared with you') : '';
function cover(text) {
  els.coverTitle.textContent = current.game.name;
  els.coverSub.textContent = label(current.diff) + sharedNote();
  els.coverBtn.textContent = text;
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
  // Stagger the pop of every solved piece on the board; the cap keeps the wave ahead of the modal.
  const pieces = els.board.querySelectorAll('.queens .cell svg:not(.x), .tango .cell svg, .zip .num.hit, .patches .patch');
  pieces.forEach((el, i) => { el.style.setProperty('--d', Math.min(i * 0.05, 0.3) + 's'); });
  els.board.classList.add('celebrate');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) confetti();
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => {
    els.modalTitle.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    const theirs = current.shared && current.shared.ms;
    els.modalSub.textContent = 'Solved in ' + fmt(ms) + (theirs ? (ms <= theirs ? ' · faster than ' : ' · they took ') + fmt(theirs) : '');
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

function newPuzzle(game, seed, diff, saved, replay, ready, shared) {
  pauseTimer();
  els.modal.hidden = true;
  els.board.classList.remove('celebrate');
  clearTimeout(celebrateTimer);
  const puzzle = ready || game.generate(seed, diff);
  current = {
    game, puzzle, seed, diff, replay: !!replay, shared: shared || (saved && saved.shared) || null,
    state: replay ? game.solvedState(puzzle) : saved ? saved.state : null,
    elapsed: replay ? replay.ms : saved ? saved.elapsed || 0 : 0,
    solved: replay ? true : saved ? !!saved.solved : false, startedAt: null,
  };
  els.board.innerHTML = ''; els.actions.innerHTML = ''; els.hintmsg.hidden = true;
  els.board.classList.toggle('solved', current.solved);
  els.rules.textContent = game.rules;
  els.seed.textContent = replay
    ? 'Replay · solved in ' + fmt(replay.ms) + ' on ' + new Date(replay.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · #' + seed
    : '#' + seed + ' · ' + label(diff) + sharedNote();
  // The address always names the puzzle on screen, so a reload or a copied link comes back to it.
  if (!replay) history.replaceState(null, '', current.shared ? puzzleHash(current.shared.ms) : '#' + game.id);
  const api = {
    onChange(state) {
      current.state = state;
      save();
    },
    onWin() {
      if (current.solved) return;
      pauseTimer(); current.solved = true; save(); renderTimer();
      solves.add({ g: game.id, d: diff, seed, ms: Math.round(current.elapsed), at: Date.now() });
      els.board.classList.add('solved');
      celebrate(current.elapsed);
    },
    isSolved: () => current.solved,
    // Pulse some elements and show a short message; the game decides what to point at.
    hint(elements, message) {
      if (current.solved) return;
      for (const el of els.board.querySelectorAll('.hint')) el.classList.remove('hint');
      for (const el of elements) { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); }
      els.hintmsg.textContent = message; els.hintmsg.hidden = false;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { els.hintmsg.hidden = true; for (const el of elements) el.classList.remove('hint'); }, 3200);
      startTimer();
    },
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
  if (!replay) prefetch(game);
}

// Difficulty preference per game: 'random' (default) or a fixed level.
const diffKey = (id) => key(id) + '.diffMode';
const diffMode = (game) => { const v = localStorage.getItem(diffKey(game.id)); return v && (v === 'random' || LEVELS.includes(v)) ? v : 'random'; };
const resolveDiff = (game) => { const mode = diffMode(game); return mode === 'random' ? LEVELS[Math.floor(Math.random() * LEVELS.length)] : mode; };
const fillSelect = (game) => {
  els.size.hidden = false;
  els.size.innerHTML = '<option value="random">Random</option>' + LEVELS.map((d) => `<option value="${d}">${label(d)}</option>`).join('');
  els.size.value = diffMode(game);
};

const GLYPHS = {
  queens: { bg: '#f8f1a0', svg: '<svg viewBox="0 0 24 24" fill="#1b1f2a"><path d="M4 18h16l1.2-9-4.6 3.2L12 5l-4.6 7.2L2.8 9z"/><rect x="4" y="19" width="16" height="2.5" rx="1"/></svg>' },
  tango: { bg: '#fde7c2', svg: '<svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8.5" fill="#f5a623"/><path d="M38.8 3.3a8.7 8.7 0 1 0 6 15.4 10.2 10.2 0 0 1-6-15.4z" fill="#5b7cc4"/></svg>' },
  zip: { bg: '#dbe7ff', svg: '<svg viewBox="0 0 40 24" fill="none"><path d="M6 6h14v12h14" stroke="#2563eb" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="6" r="4.5" fill="#1b1f2a"/><circle cx="34" cy="18" r="4.5" fill="#1b1f2a"/></svg>' },
  patches: { bg: '#e6f4e1', svg: '<svg viewBox="0 0 40 24"><rect x="1" y="1" width="16" height="22" rx="2" fill="#f7b8b8"/><rect x="19" y="1" width="20" height="10" rx="2" fill="#c3c6f5"/><rect x="19" y="13" width="9" height="10" rx="2" fill="#bfe8b5"/><rect x="30" y="13" width="9" height="10" rx="2" fill="#fbd59f"/></svg>' },
};
const TAGLINES = { queens: 'One queen per row, column and region.', tango: 'Suns and moons, three of each.', zip: 'One path through every cell.', patches: 'Tile the grid with rectangles.' };

function showHome() {
  pauseTimer();
  els.gameView.hidden = true; els.home.hidden = false;
  els.homeBtn.hidden = true; els.statsHome.hidden = false; els.shareTop.hidden = true;
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

function showGameView(game) {
  els.home.hidden = true; els.gameView.hidden = false;
  els.homeBtn.hidden = false; els.statsHome.hidden = true; els.shareTop.hidden = false;
  els.title.textContent = game.name;
  fillSelect(game);
}
function selectGame(id) {
  const game = GAMES.find((g) => g.id === id);
  if (!game) { showHome(); return; }
  showGameView(game);
  localStorage.setItem('puzzles.current', game.id);
  // Resume only a game that is started and unfinished; otherwise start fresh.
  const saved = load(game.id);
  const inProgress = saved && saved.seed != null && !saved.solved && saved.elapsed > 0 && LEVELS.includes(saved.diff);
  if (inProgress) newPuzzle(game, saved.seed, saved.diff, saved);
  else newPuzzle(game, randomSeed(), resolveDiff(game), null);
}

// ---- Share links: #game/seed/difficulty[/sharer's ms] ----
const puzzleHash = (ms) => '#' + current.game.id + '/' + current.seed + '/' + current.diff + (ms ? '/' + ms : '');
// Your own time goes in the link once you have solved it; otherwise pass on the time you were sent.
const shareHash = () => puzzleHash(current.solved ? Math.round(current.elapsed) : (current.shared && current.shared.ms) || 0);
function parseShare(hash) {
  const [id, seed, diff, ms] = hash.split('/');
  const game = GAMES.find((g) => g.id === id);
  if (!game || !/^\d{1,10}$/.test(seed || '') || !LEVELS.includes(diff)) return null;
  return { game, seed: Number(seed), diff, ms: /^\d{1,9}$/.test(ms || '') ? Number(ms) : 0 };
}
// Open the puzzle a friend sent, fresh unless this device already has that very puzzle going.
function openShared({ game, seed, diff, ms }) {
  showGameView(game);
  els.size.value = diff;
  localStorage.setItem('puzzles.current', game.id);
  const saved = load(game.id);
  const same = saved && saved.seed === seed && saved.diff === diff;
  newPuzzle(game, seed, diff, same ? saved : null, null, null, ms || !(same && saved.shared) ? { ms } : saved.shared);
}
async function share() {
  if (!current) return;
  const url = location.origin + location.pathname + shareHash();
  const name = current.game.name + ' puzzle (' + label(current.diff) + ')';
  const text = current.solved ? 'I solved this ' + name + ' in ' + fmt(current.elapsed) + '. Can you beat it?' : 'Try this ' + name + '.';
  if (navigator.share) {
    try { await navigator.share({ title: current.game.name, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link', url); }
}
function toast(message) {
  els.hintmsg.textContent = message; els.hintmsg.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { els.hintmsg.hidden = true; }, 2200);
}
els.shareTop.onclick = share;
els.modalShare.onclick = share;

// Show a past solve on its board, without touching the in-progress game.
function replaySolve(entry) {
  const game = GAMES.find((g) => g.id === entry.g);
  if (!game || !LEVELS.includes(entry.d)) return;
  els.results.hidden = true;
  showGameView(game);
  if (location.hash !== '#' + game.id) history.replaceState(null, '', '#' + game.id);
  els.size.value = entry.d;
  newPuzzle(game, entry.seed, entry.d, null, { ms: entry.ms, at: entry.at });
}

function route() {
  const hash = location.hash.slice(1);
  const shared = hash.includes('/') ? parseShare(hash) : null;
  if (shared) {
    const already = current && !els.gameView.hidden && current.game === shared.game && current.seed === shared.seed && current.diff === shared.diff;
    if (!already) openShared(shared);
    return;
  }
  if (hash && GAMES.some((g) => g.id === hash)) { if (!current || current.game.id !== hash || els.gameView.hidden) selectGame(hash); }
  else showHome();
}
els.homeBtn.onclick = () => { location.hash = ''; };
els.statsHome.onclick = () => openResults(localStorage.getItem('puzzles.current') || 'queens');

// Generate the next puzzle ahead of time so New never waits on the generator.
const prefetched = {};
function prefetch(game) {
  const diff = resolveDiff(game);
  const seed = randomSeed();
  setTimeout(() => { if (!prefetched[game.id] || prefetched[game.id].diff !== diff) prefetched[game.id] = { seed, diff, puzzle: game.generate(seed, diff) }; }, 60);
}
function takePrefetched(game) {
  const diff = resolveDiff(game);
  const p = prefetched[game.id];
  delete prefetched[game.id];
  return p && p.diff === diff ? p : { seed: randomSeed(), diff, puzzle: null };
}
// New starts at once; the Start card only greets arrivals from the home page.
els.newBtn.onclick = () => { const p = takePrefetched(current.game); newPuzzle(current.game, p.seed, p.diff, null, null, p.puzzle); uncover(); };
els.modalNew.onclick = els.newBtn.onclick;
els.modalClose.onclick = () => { els.modal.hidden = true; };
els.modalResults.onclick = () => { els.modal.hidden = true; openResults(current.game.id); };
els.statsBtn.onclick = () => openResults(current.game.id);
els.rClose.onclick = () => { els.results.hidden = true; };
els.results.addEventListener('click', (e) => { if (e.target === els.results) els.results.hidden = true; });
els.rClear.onclick = () => { if (confirm('Delete all recorded solve times?')) { solves.clear(); renderResults(); } };
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.hidden = true; });
els.size.onchange = () => { localStorage.setItem(diffKey(current.game.id), els.size.value); delete prefetched[current.game.id]; newPuzzle(current.game, randomSeed(), resolveDiff(current.game), null); uncover(); };
window.addEventListener('hashchange', route);

// ---- Results view ----
let rSel = { game: 'queens', diff: 'all' };
function openResults(gameId) {
  rSel = { game: gameId, diff: 'all' };
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
  for (const g of GAMES) els.rGames.appendChild(pill(g.name, g.id === rSel.game, () => { rSel = { game: g.id, diff: 'all' }; renderResults(); }));
  els.rSizes.innerHTML = '';
  els.rSizes.appendChild(pill('All', rSel.diff === 'all', () => { rSel.diff = 'all'; renderResults(); }));
  for (const d of LEVELS) els.rSizes.appendChild(pill(label(d), d === rSel.diff, () => { rSel.diff = d; renderResults(); }));
  const allLevels = rSel.diff === 'all';
  const list = solves.filter(rSel.game, allLevels ? null : rSel.diff);
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
    const levelCol = allLevels ? `<td class="muted">${label(solves.levelOf(e))}</td>` : '';
    const view = e.d ? '<button class="link small">View</button>' : '';
    tr.innerHTML = `<td class="muted">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</td>${levelCol}<td>${fmt(e.ms)}</td><td class="act">${view}</td>`;
    if (e.d) tr.querySelector('button').onclick = () => replaySolve(e);
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
    els.rTip.textContent = fmt(list[i].ms) + ' · ' + label(solves.levelOf(list[i])) + ' · ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

