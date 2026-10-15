// Shared UI plumbing: messages, busy buttons, row exit animation, dialogs and the Help dialog.
import { prefersReducedMotion } from '../../shared/dom.js';
import { tourActive } from './guided-tour.js';
import { state } from './state.js';

// Feedback helpers for row actions (Chrome/Edge expose the click as window.event inside inline onclick handlers)
export function clickedButton() { const e = window.event; return e && e.target && e.target.closest ? e.target.closest('button') : null; }
export async function withBusy(btn, label, fn) {
  if (!btn) return fn();
  const txt = btn.textContent; btn.disabled = true; btn.classList.add('is-busy'); btn.textContent = label;
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.classList.remove('is-busy'); btn.textContent = txt; } }
}
// Fade a row out before it moves to another tab, so the change is visible
export function rowLeaving(btn) {
  state.lastRowMoveAt = Date.now();
  const row = btn && btn.closest ? btn.closest('.queue-row') : null;
  if (!row || prefersReducedMotion()) return Promise.resolve();
  row.classList.add('leaving'); return new Promise(res => setTimeout(res, 180));
}

// kind: falsy = done (3 s) · true = problem (6 s, click to dismiss) · 'warn' = heads-up (6 s)
var toastTimer = null;
// Click a message to dismiss it early
(function () { const t = document.getElementById('toast'); if (t) t.addEventListener('click', () => { clearTimeout(toastTimer); t.classList.remove('show'); }); })();
export function toast(msg, kind) {
  const t = document.getElementById('toast');
  const level = kind === 'warn' ? 'warn' : kind ? 'error' : '';
  t.setAttribute('role', level === 'error' ? 'alert' : 'status');   // set before the text so it is announced
  t.textContent = msg;
  t.className = 'toast show' + (level ? ' ' + level : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast' + (level ? ' ' + level : ''); }, level ? 6000 : 3000);
}

export function openHelp() { document.getElementById('helpModal').classList.add('show'); }

// Dialogs: only the read-only ones (Help, Saved tours) close on an outside click — forms keep what you typed.
// Esc closes the top dialog; focus goes back to the button that opened it.
var READ_ONLY_DIALOGS = ['helpModal'];
document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m && READ_ONLY_DIALOGS.includes(m.id)) m.classList.remove('show'); });
  const box = m.querySelector('.modal'), h = m.querySelector('.panel-header h2');
  if (box) { box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); if (h) { if (!h.id) h.id = m.id + 'Title'; box.setAttribute('aria-labelledby', h.id); } }
  let opener = null;
  new MutationObserver(() => {
    const shown = m.classList.contains('show');
    if (shown && !opener) {
      opener = document.activeElement;
      setTimeout(() => { if (!m.contains(document.activeElement)) { const f = m.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea, button'); if (f) f.focus(); } }, 0);
    } else if (!shown && opener) { const o = opener; opener = null; if (o && o.isConnected && o.focus) o.focus(); }
  }).observe(m, { attributes: true, attributeFilter: ['class'] });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || (typeof tourActive !== 'undefined' && tourActive)) return;
  const open = [...document.querySelectorAll('.modal-backdrop.show')]; if (!open.length) return;
  open[open.length - 1].classList.remove('show'); e.preventDefault();
});
