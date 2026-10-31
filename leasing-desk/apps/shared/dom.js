// Small DOM helpers both apps use: reduced-motion check, label-to-field linking, price boxes and required-field marks.
import { moneyTyped } from './format.js';

// Asks for a PIN: the browser's prompt, or in the in-browser demo a box that fills in the demo PIN and presses OK by
// itself (demo/pin-box.js), since a visitor doesn't know it. Resolves with the answer, or null for Cancel.
export function askPin(label) { return Promise.resolve(window.demoPin ? window.demoPin(label) : prompt(label)); }
export function prefersReducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
// Link each form label to the field right after it (screen readers name the field; clicking the label focuses it)
var labelSeq = 0;
export function linkFieldLabels(root) {
  (root || document).querySelectorAll('label:not(.cbx):not([for])').forEach(lab => {
    if (lab.querySelector('input, select, textarea')) return;
    let el = lab.nextElementSibling;
    while (el && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const inner = el.querySelector && el.querySelector('input:not([type=checkbox]), select, textarea'); if (inner) { el = inner; break; } el = el.nextElementSibling; }
    if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    if (!el.id) el.id = 'fld-' + (++labelSeq);
    lab.setAttribute('for', el.id);
  });
}
// A price box as it's typed in (oninput, production D45): whole dollars ("$4,500"), the cursor kept after the same digit
export function moneyInput(el) {
  const { value, caret } = moneyTyped(el.value, el.selectionStart == null ? el.value.length : el.selectionStart);
  el.value = value;
  if (document.activeElement === el) el.setSelectionRange(caret, caret);
}
// Required fields left empty (production D45): a red outline and a note under each missing field inside `scope`, and with
// `jump` the cursor on the first (scrolled into view). `ids` maps each missing item's field (shared/tour-required.js) to
// this app's box; items with no box (the iPad's "at least one unit") are only named in the message. An empty list clears
// every mark.
export function markMissing(scope, miss, ids, jump) {
  const root = document.querySelector(scope); if (!root) return;
  root.querySelectorAll('.field-err').forEach(n => n.remove());
  root.querySelectorAll('.is-missing').forEach(e => { e.classList.remove('is-missing'); e.removeAttribute('aria-invalid'); });
  const marked = miss.map(m => [document.getElementById(ids[m.field]), m.note]).filter(([e]) => e);
  marked.forEach(([e, note]) => {
    e.classList.add('is-missing'); e.setAttribute('aria-invalid', 'true');
    const n = document.createElement('div'); n.className = 'field-err'; n.textContent = note;
    (e.closest('.f, .field, .field-row > div') || e.parentElement).appendChild(n);
  });
  if (!jump || !marked.length) return;
  const first = marked[0][0], target = first.matches('input, select, textarea') ? first : first.querySelector('button, input');
  if (target) { target.focus(); if (target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }
}
