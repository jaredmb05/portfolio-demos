// Lounge rental (PFA) emails: rental info, and payment due 7 days after signing.
import { todayYmd } from '../../shared/dates.js';
import { formatRent } from '../../shared/format.js';
import { escapeHtml } from '../../shared/html.js';
import { getGreeting, renderPreview } from './email-builder.js';
import { addOutlookSpacers, EMAIL_FONT, SEP } from './email-html.js';
import { DEFAULT_PFA_SIGNED_BODY, DEFAULT_PFA_SIGNED_OPENING, templates } from './email-templates.js';
import { PFA_LOUNGE_RATES, pfaDueDate, pfaFee } from './rules/pfa.js';
import { state } from './state.js';

// ── PFA sub-mode: 'info' (Step 1 rental info) | 'signed' (Step 2 payment due) ──
export let pfaSubMode = localStorage.getItem('ld_pfaSubMode') === 'signed' ? 'signed' : 'info';

export function setPfaSubMode(sub) {
  pfaSubMode = (sub === 'signed') ? 'signed' : 'info';
  localStorage.setItem('ld_pfaSubMode', pfaSubMode);
  document.getElementById('pfaSubInfoBtn').classList.toggle('active', pfaSubMode === 'info');
  document.getElementById('pfaSubSignedBtn').classList.toggle('active', pfaSubMode === 'signed');
  document.getElementById('pfaInfoBlock').style.display = (pfaSubMode === 'info') ? 'block' : 'none';
  document.getElementById('pfaSignedBlock').style.display = (pfaSubMode === 'signed') ? 'block' : 'none';
  if (pfaSubMode === 'signed') {
    const d = document.getElementById('pfaSignedDate');
    if (d && !d.value) d.value = todayYmd();
    onPfaLoungeChange(false);
  }
  renderPreview();
}

export function onPfaLoungeChange(rerender = true) {
  const lounge = document.getElementById('pfaLounge').value;
  const rate = PFA_LOUNGE_RATES[lounge];
  document.getElementById('pfaRateHint').textContent = rate ? `(${lounge} rate: $${rate}/hr)` : '';
  onPfaHoursInput(false);
  if (rerender) renderPreview();
}

export function onPfaHoursInput(rerender = true) {
  const hrs = parseFloat(document.getElementById('pfaHours').value);
  const rate = PFA_LOUNGE_RATES[document.getElementById('pfaLounge').value];
  const rentEl = document.getElementById('pfaRent');
  // Auto-fill the fee from hours × rate unless the user has typed a fee by hand
  const fee = pfaFee(hrs, rate);
  if (!state.pfaRentManual && fee !== null) rentEl.value = fee;
  if (rerender) renderPreview();
}

// Avoid `new Date('YYYY-MM-DD')`: it parses as UTC, which is the previous day in New York.
function parseLocalISO(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
}
function formatLongDate(d) {
  return d ? d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : '';
}

function buildPfaSignedHTML() {
  const name = document.getElementById('prospectName').value.trim() || '[Resident]';
  const greeting = getGreeting();
  const tpl = templates.pfa;

  const loungeNum = document.getElementById('pfaLounge').value;
  const lounge = `${loungeNum} Tidemark Blvd`;
  const depRaw = document.getElementById('pfaDeposit').value.trim();
  const rentRaw = document.getElementById('pfaRent').value.trim();
  const deposit = depRaw !== '' ? formatRent(depRaw) : '[Deposit]';
  const rent = rentRaw !== '' ? formatRent(rentRaw) : '[Rental Fee]';

  const signed = parseLocalISO(document.getElementById('pfaSignedDate').value);
  const due = signed ? pfaDueDate(signed) : null;
  const signedDate = signed ? formatLongDate(signed) : '[Signed Date]';
  const dueDate = due ? formatLongDate(due) : '[Due Date]';
  const dueEl = document.getElementById('pfaDueDateDisplay');
  if (dueEl) dueEl.textContent = due ? dueDate : '—';

  const fill = s => String(s || '')
    .replace(/\{lounge\}/g, escapeHtml(lounge))
    .replace(/\{deposit\}/g, escapeHtml(deposit))
    .replace(/\{rent\}/g, escapeHtml(rent))
    .replace(/\{signedDate\}/g, escapeHtml(signedDate))
    .replace(/\{dueDate\}/g, escapeHtml(dueDate));

  return `<div style="${EMAIL_FONT}">` +
    `<p style="margin:0; padding:0;">${greeting} ${escapeHtml(name)},</p>` + SEP +
    `<p style="margin:0; padding:0;">${fill(tpl.signedOpening || DEFAULT_PFA_SIGNED_OPENING)}</p>` + SEP +
    addOutlookSpacers(fill(tpl.signedBody || DEFAULT_PFA_SIGNED_BODY)) + SEP +
    `<p style="margin:0; padding:0;">${tpl.signature || 'Have a great day!'}</p>` +
    `</div>`;
}

export function buildPfaHTML() {
  if (pfaSubMode === 'signed') return buildPfaSignedHTML();
  const name = document.getElementById('prospectName').value.trim() || '[Resident]';
  const greeting = getGreeting();
  const tpl = templates.pfa;
  return `<div style="${EMAIL_FONT}">` +
    `<p style="margin:0; padding:0;">${greeting} ${escapeHtml(name)},</p>` + SEP +
    `<p style="margin:0; padding:0;">${tpl.opening}</p>` + SEP +
    addOutlookSpacers(tpl.body) + SEP +
    `<p style="margin:0; padding:0;">${tpl.signature || 'Have a great day!'}</p>` +
    `</div>`;
}
