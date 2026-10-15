// Small DOM helpers both apps use: reduced-motion check and label-to-field linking.

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
