// UI plumbing: element lookup, messages, missing-field hints and the home-screen note.
import { prefersReducedMotion } from '../../shared/dom.js';
import { toggleGuest } from './tour-planner.js';

export const $ = id => document.getElementById(id);
// A short message above the tab bar, for problems outside a tour
var toastTimer = null;
export function toast(msg, isError) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.setAttribute('role', isError ? 'alert' : 'status');
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast' + (isError ? ' error' : ''); }, isError ? 6000 : 3500);
}
// The tour's message line: kind '' = saved / done (green) · 'busy' = saving or a hint (grey) · 'err' = a problem (red)
export function setMsg(text, kind) { const m = $('tSaveMsg'); if (!m) return; m.textContent = (kind === 'err' && text ? '⚠ ' : '') + text; m.className = 'savemsg' + (kind ? ' ' + kind : ''); }
// A missing field: say so under the field too, open the details card if it's folded, and take the cursor there
export function needField(id, text) {
  setMsg(text, 'err');
  const el = $(id); if (!el) return false;
  if (el.closest('#guestCard') && $('guestCard').style.display === 'none') toggleGuest(true, true);
  const box = el.closest('.f') || el.parentElement; let note = box.querySelector('.field-err');
  if (!note) { note = document.createElement('div'); note.className = 'field-err'; box.appendChild(note); el.addEventListener('input', () => { note.remove(); }, { once: true }); el.addEventListener('change', () => { note.remove(); }, { once: true }); }
  note.textContent = text;
  el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  return false;
}
// Confirmation on the Tour Planner home (Send to queue, Finish, finished at the Desk); the row flashes briefly
var homeNoteTimer = null;
export function homeNote(text, rowId) {
  const n = $('homeNote'); if (!n) return;
  n.textContent = text; n.classList.add('show');
  clearTimeout(homeNoteTimer); homeNoteTimer = setTimeout(() => n.classList.remove('show'), 5000);
  if (rowId) setTimeout(() => { const r = document.querySelector(`.tourrow[data-id="${CSS.escape(rowId)}"]`); if (r) { r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); } }, 60);
}

document.addEventListener('keydown', e => {
  const t = e.target; if (!t || !t.matches || (e.key !== 'Enter' && e.key !== ' ')) return;
  if (t.matches('[role="button"], [role="checkbox"]') && t.tagName !== 'BUTTON') { e.preventDefault(); t.click(); }
});
