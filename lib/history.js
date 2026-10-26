// Solve history in localStorage: one entry per solved puzzle.
const KEY = 'puzzles.history';

export function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function add(entry) {
  const list = load();
  list.push(entry);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-2000))); } catch { /* ignore */ }
}
export function clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function filter(game, size) {
  return load().filter((e) => e.g === game && (size == null || e.n === size));
}
export function stats(list) {
  if (!list.length) return null;
  const ms = list.map((e) => e.ms);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const last = ms.slice(-5);
  return { count: ms.length, best: Math.min(...ms), avg: sum(ms) / ms.length, last5: sum(last) / last.length };
}
