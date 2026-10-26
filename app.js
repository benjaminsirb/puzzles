import * as queens from './games/queens.js';
import * as tango from './games/tango.js';
import * as zip from './games/zip.js';
import * as patches from './games/patches.js';

const GAMES = [queens, tango, zip, patches];
const $ = (s) => document.querySelector(s);
const els = {
  tabs: $('#tabs'), timer: $('#timer'), size: $('#size'), newBtn: $('#new'),
  board: $('#board'), actions: $('#actions'), rules: $('#rules'), seed: $('#seed'), toast: $('#toast'),
};

let current = null;
let tick = null;
let toastTimer = null;

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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseTimer();
  else if (current && current.touched && !current.solved) startTimer();
});

function toast(msg) {
  els.toast.textContent = msg; els.toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { els.toast.hidden = true; }, 4000);
}

function newPuzzle(game, seed, size, saved) {
  pauseTimer();
  const puzzle = game.generate(seed, size);
  current = {
    game, puzzle, seed, size,
    state: saved ? saved.state : null, elapsed: saved ? saved.elapsed || 0 : 0,
    solved: saved ? !!saved.solved : false, startedAt: null, touched: !!saved,
  };
  els.board.innerHTML = ''; els.actions.innerHTML = '';
  els.board.classList.toggle('solved', current.solved);
  els.rules.textContent = game.rules;
  els.seed.textContent = '#' + seed + (size ? ' · ' + size + '×' + size : '');
  const api = {
    onChange(state) {
      current.state = state;
      if (!current.solved) { current.touched = true; startTimer(); }
      save();
    },
    onWin() {
      if (current.solved) return;
      pauseTimer(); current.solved = true; save(); renderTimer();
      els.board.classList.add('solved');
      toast('Solved in ' + fmt(current.elapsed));
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
}

function selectGame(id) {
  const game = GAMES.find((g) => g.id === id) || GAMES[0];
  localStorage.setItem('puzzles.current', game.id);
  if (location.hash !== '#' + game.id) history.replaceState(null, '', '#' + game.id);
  for (const b of els.tabs.children) b.classList.toggle('active', b.dataset.id === game.id);
  if (game.sizes) {
    els.size.hidden = false;
    els.size.innerHTML = game.sizes.map((s) => `<option value="${s}">${s}×${s}</option>`).join('');
  } else els.size.hidden = true;
  const saved = load(game.id);
  const size = game.sizes ? (saved && game.sizes.includes(saved.size) ? saved.size : game.defaultSize) : null;
  if (game.sizes) els.size.value = size;
  if (saved && saved.seed != null && (!game.sizes || saved.size === size)) newPuzzle(game, saved.seed, size, saved);
  else newPuzzle(game, randomSeed(), size, null);
}

for (const g of GAMES) {
  const b = document.createElement('button');
  b.textContent = g.name; b.dataset.id = g.id;
  b.onclick = () => selectGame(g.id);
  els.tabs.appendChild(b);
}
els.newBtn.onclick = () => newPuzzle(current.game, randomSeed(), current.size, null);
els.size.onchange = () => newPuzzle(current.game, randomSeed(), +els.size.value, null);
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== current.game.id) selectGame(id); });

selectGame(location.hash.slice(1) || localStorage.getItem('puzzles.current') || 'queens');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
