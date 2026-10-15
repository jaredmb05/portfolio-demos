// Requirements tab: documents by applicant type and the tax years to ask for.
import { APPLICATION_FEE, GUARANTOR_MULTIPLE, INCOME_MULTIPLE, taxYears } from '../../shared/requirements.js';
import { $ } from './ui.js';

// ---------- Requirements ----------
export function fillSelf() {
  const t = taxYears();
  $('selfList').innerHTML = `
    <li><b>Personal</b> tax returns for ${t.y1} and ${t.y2} — personal returns only, not business returns — all pages of each. If they filed an extension for ${t.y1}: ${t.y2} and ${t.y3} returns plus proof of the ${t.y1} extension. Joint filers: the co-filer submits their own application and completes Vero.</li>
    <li>CPA letter confirming the income on those returns. If self-prepared: IRS tax transcripts for each year (IRS.gov) in place of the CPA letter.</li>
    <li>Most recent checking or savings statement (all pages)</li>
    <li>Landlord reference letter</li>
    <li>Photo ID</li>
    <li>Pet photo (if applicable)</li>`;
}
export function showDoc(k, btn) {
  document.querySelectorAll('.req .doc').forEach(d => d.classList.toggle('on', d.id === 'doc-' + k));
  document.querySelectorAll('.req .pill-btn').forEach(p => { p.classList.toggle('on', p === btn); p.setAttribute('aria-pressed', String(p === btn)); });
}
// The rules every applicant meets, from the shared requirement constants
export function fillRules() {
  $('reqRules').innerHTML = `
      <li>Tenant income: ${INCOME_MULTIPLE}× the monthly rent</li>
      <li>Guarantor income: ${GUARANTOR_MULTIPLE}× the monthly rent</li>
      <li>Application fee: $${APPLICATION_FEE} per person</li>
      <li>Security deposit (one month's rent) and first month's rent are due at lease signing</li>
    `;
}
