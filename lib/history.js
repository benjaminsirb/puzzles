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
// Entries recorded before difficulty levels existed carry a board size; map it to a level for stats.
const LEGACY = { queens: { 7: 'easy', 8: 'medium', 9: 'hard' }, zip: { 6: 'medium', 7: 'hard' }, patches: { 5: 'easy', 6: 'medium', 7: 'hard' }, tango: { 0: 'medium' } };
export const levelOf = (e) => e.d || (LEGACY[e.g] && LEGACY[e.g][e.n]) || 'medium';
export function filter(game, diff) {
  return load().filter((e) => e.g === game && (diff == null || levelOf(e) === diff));
}
export function stats(list) {
  if (!list.length) return null;
  const ms = list.map((e) => e.ms);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const last = ms.slice(-5);
  return { count: ms.length, best: Math.min(...ms), avg: sum(ms) / ms.length, last5: sum(last) / last.length };
}
