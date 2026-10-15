// Lease Approval email, including the pro-rata rent rider (next month's rent, concession and credit months).
import { MONTHS } from '../../shared/dates.js';
import { formatRent } from '../../shared/format.js';
import { escapeHtml, safeUrl } from '../../shared/html.js';
import { syncFormFloorPlan } from './application-email.js';
import { getGreeting, renderPreview } from './email-builder.js';
import { bold, EMAIL_FONT, p, SEP } from './email-html.js';
import { refreshUnitPicker } from './form-unit-picker.js';
import { parseTypedDate, parseWordDate } from './rules/date-input.js';
import { apvAddMonths, apvLLC, apvMoney, apvMonthKey, apvMonthLabel, defaultConcessionMonthIndex, leaseMonthCount, proRataSchedule, securityDeposit } from './rules/lease-approval.js';
import { state } from './state.js';
import { bldgNum } from './units.js';

export function buildApprovalHTML() {
  const name = document.getElementById('prospectName').value.trim() || '[Applicant]';
  const building = document.getElementById('apvBuilding').value;
  const unit = document.getElementById('apvUnit').value.trim() || '[Unit]';
  const rentRaw = document.getElementById('apvRent').value.trim();
  const rent = rentRaw ? `$${formatRent(rentRaw)}` : '$[Rent]';
  const leaseStart = document.getElementById('apvLeaseStart').value.trim() || '[Lease start date]';
  const leaseEnd = document.getElementById('apvLeaseEnd').value.trim() || '[Lease end date]';
  const taxForm = document.getElementById('apvTaxForm').value;  // W-9 or W-8
  const reducedSecurity = document.getElementById('apvReducedSecurity').checked;
  const initRentRaw = document.getElementById('apvInitialRent').value.trim();
  const initRent = initRentRaw ? `$${formatRent(initRentRaw)}` : '$[Amount]';
  // Security deposit = initial rent, unless reduced-security is approved ($2,000).
  const depRaw = reducedSecurity ? '2000' : initRentRaw;
  const dep = depRaw ? `$${formatRent(depRaw)}` : '$[Amount]';
  const byCheck = document.getElementById('apvCheckToggle').checked;
  const incOn = document.getElementById('apvIncentiveToggle').checked;
  const incText = document.getElementById('apvIncentive').value.trim();
  const isAssignment = document.getElementById('apvAssignmentToggle').checked;
  const isAsIs = document.getElementById('apvAsIsToggle').checked;
  const fpOn = document.getElementById('apvFloorPlanToggle').checked;
  const fpLink = document.getElementById('apvFloorPlan').value.trim();
  const llc = apvLLC(building);

  const uhead = (t) => `<strong style="font-weight:bold; text-decoration:underline;">${t}</strong>`;
  const ital = (t) => `<em style="font-style:italic;">${t}</em>`;

  // Opening paragraph — assignment changes the phrasing
  const approvedFor = isAssignment
    ? `the assignment of Unit #${escapeHtml(unit)} at ${escapeHtml(building)}`
    : `Unit #${escapeHtml(unit)} at ${escapeHtml(building)}`;
  let openingText = `Congratulations! You have been approved for ${approvedFor}. Your lease begins on ${escapeHtml(leaseStart)} and ends on ${escapeHtml(leaseEnd)} with a monthly rent of ${escapeHtml(rent)}.`;
  if (incOn && incText) {
    openingText += ` This lease includes ${escapeHtml(incText)}.`;
  }
  const opening = p(openingText);

  const docusign = p(`Your lease and ${escapeHtml(taxForm)} have been sent to you electronically via DocuSign. Please complete the following three steps within 24 hours of lease receipt:`);

  // Optional floor plan line (pulled from the floor plan spreadsheet or pasted manually)
  let floorPlanLine = '';
  if (fpOn) {
    const link = safeUrl(fpLink)
      ? `<a href="${escapeHtml(safeUrl(fpLink))}">Click here for the floor plan</a>`
      : '[paste floor plan link]';
    floorPlanLine = p(`${bold('Floor Plan:')} ${link}`);
  }

  // STEP 1 — header sits tight above its first line; blank line between the two paragraphs.
  let step1 = p(uhead('STEP 1: REVIEW LEASE DETAILS AND SIGN')) +
    p(`Please carefully review all lease details, including your lease dates, monthly rent, and any applicable incentive.`) +
    SEP +
    p(`Once reviewed, please sign the lease and any applicable rider(s), including the guarantor rider if applicable.`);
  if (isAssignment && isAsIs) {
    step1 += p(ital('Please note this unit is delivered as is.'));
  }

  // STEP 2 — blank lines between paragraphs; the two amount lines stay tight together.
  let step2 = p(uhead('STEP 2: MAKE REQUIRED PAYMENTS'));
  if (byCheck) {
    step2 += p(`Immediately after signing the lease, you will need to submit payment for your first month of rent and security deposit by certified check.`);
  } else {
    step2 += p(`Immediately after signing the lease, you will be prompted to submit payment for your first month of rent and security deposit via ClickPay.`) +
      SEP +
      p(`You have the option of paying via a direct payment transfer from your bank account for no additional fee. Paying by credit card is also an option, but this carries a service charge determined by ClickPay and based on the amount of the transaction.`);
  }
  step2 += SEP + p(`Your rent and security deposit will be due at lease signing in the amounts listed below:`) + SEP;
  const nextRentLine = buildApvNextRentLine(p, ital);
  if (byCheck) {
    step2 += p(`${bold('Initial Rent Payment:')} ${initRent} — certified check payable to ${escapeHtml(llc)}`);
    step2 += nextRentLine;
    step2 += p(`${bold('Security Deposit:')} ${dep} — certified check payable to Harborline Bank`);
  } else {
    step2 += p(`${bold('Initial Rent Payment:')} ${initRent}`);
    step2 += nextRentLine;
    step2 += p(`${bold('Security Deposit:')} ${dep}`);
  }

  // STEP 3 — renter's insurance; Interested Party = building LLC.
  const step3 = p(uhead("STEP 3: SEND US YOUR RENTER'S INSURANCE")) +
    p(`Please provide a copy of your renter's insurance policy at lease signing.`) +
    SEP +
    p(`To quickly and easily purchase a renters insurance policy, <a href="https://www.example.com/renters-insurance">please visit TheGuarantors here</a>.`) +
    SEP +
    p(`Please note all leaseholders must be listed on the policy and ${escapeHtml(llc)} must be listed as an Interested Party.`) +
    p(`The building recommends at least $100,000 liability coverage and minimum personal content coverage of $10,000 per occurrence for property damage.`);

  const closing = p(`Please do not hesitate to reach out should you have any other questions.`);

  return `<div style="${EMAIL_FONT}">` +
    p(`${getGreeting()} ${escapeHtml(name)},`) + SEP +
    opening +
    (floorPlanLine ? SEP + floorPlanLine : '') + SEP +
    docusign + SEP +
    step1 + SEP +
    step2 + SEP +
    step3 + SEP +
    closing +
    `</div>`;
}

// Format a date field in place by id (used by lease start/end)
export function formatApvDate(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const formatted = parseTypedDate(el.value);
  if (formatted) el.value = formatted;
  refreshApvConcMonthOptions();
  renderPreview();
}

// ===== Lease Approval helpers =====

// Building → owning LLC used on the rent check and as insurance Interested Party.
// Rule: "#### Tidemark LLC", except 2120 = "2120 Tidemark Owner LLC".

export function updateApvLlcDisplay() {
  const building = document.getElementById('apvBuilding').value;
  const el = document.getElementById('apvLlcDisplay');
  if (el) el.value = apvLLC(building);
}

export function onApvBuildingChange() {
  refreshUnitPicker('apv');
  updateApvLlcDisplay();
  refreshApvConcMonthOptions();
  if (document.getElementById('apvFloorPlanToggle').checked) autoFillApvFloorPlan();
  renderPreview();
}

// Monthly rent drives the initial rent payment; security deposit then mirrors it.
export function onApvRentInput() {
  const rent = document.getElementById('apvRent').value.trim();
  const initEl = document.getElementById('apvInitialRent');
  if (initEl) initEl.value = rent;  // initial rent payment auto-fills from monthly rent
  recomputeApvSecurity();
  renderPreview();
}

// If the initial rent payment is manually adjusted, keep the deposit in sync.
export function onApvInitialRentInput() {
  recomputeApvSecurity();
  renderPreview();
}

// Security deposit = initial rent payment, unless "reduced security" is on ($2,000).
export function onApvReducedSecurityToggle() {
  recomputeApvSecurity();
  renderPreview();
}

function recomputeApvSecurity() {
  const reduced = document.getElementById('apvReducedSecurity').checked;
  const initRaw = document.getElementById('apvInitialRent').value.trim();
  const depEl = document.getElementById('apvSecurityDeposit');
  if (!depEl) return;
  depEl.value = securityDeposit(initRaw, reduced);
}

export function onApvIncentiveToggle(checked) {
  const el = document.getElementById('apvIncentive');
  if (el) el.style.display = checked ? 'block' : 'none';
  renderPreview();
}

// ===== Next month's rent (pro-rata rent rider) =====
// Rider math: daily rate = monthly rent ÷ days in the start month; pro-rata = daily rate × days from
// lease start through month-end (inclusive). Tenant pays a full month up front; the overpayment is a
// credit against the following month. Concession (fraction of a month) lands on a chosen month; an
// optional dollar credit lands on month 2. Any month that goes negative rolls its leftover forward.

export function onApvConcFracChange() {
  const other = document.getElementById('apvConcFrac').value === 'other';
  const el = document.getElementById('apvConcOther');
  if (el) el.style.display = other ? 'block' : 'none';
  renderPreview();
}


export function onApvNextRentToggle(checked) {
  const el = document.getElementById('apvNextRentFields');
  if (el) el.style.display = checked ? 'block' : 'none';
  if (checked) refreshApvConcMonthOptions();
  renderPreview();
}

// Populate "Applied To" with each month of the lease term (falls back to 24 months from start).
// Default: 2nd month of the lease; for 2110, the last month of the lease (concessions go at the end there).
function refreshApvConcMonthOptions() {
  const start = parseWordDate(document.getElementById('apvLeaseStart').value);
  const end = parseWordDate(document.getElementById('apvLeaseEnd').value);
  const count = leaseMonthCount(start, end);
  const isLastMonthBldg = bldgNum(document.getElementById('apvBuilding').value) === '2110';
  const fill = (id, defIdx, touched) => {
    const sel = document.getElementById(id);
    if (!sel) return false;
    const prev = sel.value;
    sel.innerHTML = '';
    if (!start) { sel.innerHTML = '<option value="">Enter lease start date first</option>'; return false; }
    for (let i = 0; i < count; i++) {
      const mm = apvAddMonths(start.y, start.m, i);
      const opt = document.createElement('option');
      opt.value = apvMonthKey(mm.y, mm.m);
      opt.textContent = apvMonthLabel(mm.y, mm.m);
      sel.appendChild(opt);
    }
    if (touched && [...sel.options].some(o => o.value === prev)) { sel.value = prev; return true; }
    sel.value = sel.options[Math.min(defIdx, count - 1)].value;
    return false;
  };
  state.apvConcMonthTouched = fill('apvConcMonth', defaultConcessionMonthIndex(isLastMonthBldg, count), state.apvConcMonthTouched);
  state.apvCreditMonthTouched = fill('apvCreditMonth', 1, state.apvCreditMonthTouched);
}

// Returns the waterfall of affected months, or null if there's nothing to say.
function computeApvNextRent() {
  const on = document.getElementById('apvNextRentToggle')?.checked;
  if (!on) return null;
  const rent = parseFloat(String(document.getElementById('apvRent').value).replace(/[^0-9.]/g, ''));
  const start = parseWordDate(document.getElementById('apvLeaseStart').value);
  if (!(rent > 0) || !start) return null;
  const fracVal = document.getElementById('apvConcFrac').value;
  const frac = fracVal === 'other' ? 'other' : (parseFloat(fracVal) || 0);
  const concOtherAmount = parseFloat(String(document.getElementById('apvConcOther').value).replace(/[^0-9.]/g, '')) || 0;
  const concKey = document.getElementById('apvConcMonth').value;
  const extra = parseFloat(String(document.getElementById('apvCredit').value).replace(/[^0-9.]/g, '')) || 0;
  return proRataSchedule({ rent, start, frac, concOtherAmount, concKey, extra, creditKey: document.getElementById('apvCreditMonth').value });
}

const APV_FRAC_LABEL = { 0.25: '¼ month free', 0.5: '½ month free', 0.75: '¾ month free', 1: '1 month free', 1.5: '1½ months free', 2: '2 months free' };

function buildApvNextRentLine(p, ital) {
  const r = computeApvNextRent();
  const calcEl = document.getElementById('apvNextRentCalc');
  if (!r) { if (calcEl) calcEl.value = ''; return ''; }
  const mon = MONTHS[r.start.m];
  const startLabel = `${mon} ${r.start.d}, ${r.start.y}`;
  const rentWhole = '$' + formatRent(Math.round(r.rent));
  const parts = [];
  if (r.credit > 0) {
    parts.push(`Because your lease begins on ${startLabel}, your first month's rent of ${rentWhole} covers ${mon} ${r.start.d} through ${mon} ${r.daysInMonth} (${apvMoney(r.proRata)}, prorated). The remaining ${apvMoney(r.credit)} will be credited toward your next month's rent.`);
  }
  r.months.forEach((mo) => {
    const label = apvMonthLabel(mo.y, mo.m);
    const applied = mo.credits.filter(c => c.label !== 'pro-rata credit').map(c =>
      c.label === 'concession'
        ? (r.frac === 'other' ? `your ${apvMoney(c.amt)} free rent concession` : `your ${APV_FRAC_LABEL[r.frac]} (${apvMoney(c.amt)})`)
        : `a ${apvMoney(c.amt)} credit`);
    if (mo.carriedIn > 0) applied.push(`the ${apvMoney(mo.carriedIn)} carried over`);
    let sentence = applied.length ? `With ${applied.join(' and ')} applied to ${label}, your` : 'Your';
    sentence += ` rent for ${label}, due ${MONTHS[mo.m]} 1, ${mo.y}, will be ${apvMoney(mo.due)}.`;
    if (mo.carried > 0) sentence += ` The remaining ${apvMoney(mo.carried)} credit will roll to the following month.`;
    parts.push(sentence);
  });
  if (calcEl) {
    calcEl.value = (r.credit > 0 ? `${r.days}/${r.daysInMonth} days · pro-rata ${apvMoney(r.proRata)} · credit ${apvMoney(r.credit)} · ` : '') +
      r.months.map(mo => `${MONTHS[mo.m].slice(0,3)} ${apvMoney(mo.due)}`).join(' · ');
  }
  return p(ital(escapeHtml(parts.join(' '))));
}

// Floor plan toggle: show/hide the link field; auto-fill from the floor plan
// spreadsheet (independent of the showsheet) when turned on.
export function onApvFloorPlanToggle(checked) {
  const el = document.getElementById('apvFloorPlan');
  if (el) {
    el.style.display = checked ? 'block' : 'none';
    if (checked) autoFillApvFloorPlan();
  }
  renderPreview();
}

// Pull the floor plan link from the floor plan spreadsheet by building + unit.
// Works for any unit in that file, whether or not it's on the showsheet.
function autoFillApvFloorPlan() { syncFormFloorPlan('apvBuilding', 'apvUnit', 'apvFloorPlan'); }

// Manual unit entry in approval mode: re-attempt floor plan autofill if it's on and empty.
export function onApvUnitInput() {
  const fpToggle = document.getElementById('apvFloorPlanToggle');
  const fpEl = document.getElementById('apvFloorPlan');
  if (fpToggle && fpToggle.checked && fpEl) autoFillApvFloorPlan();
  renderPreview();
}

export function onApvAssignmentToggle(checked) {
  const row = document.getElementById('apvAsIsRow');
  const hint = document.getElementById('apvAsIsHint');
  if (row) row.style.display = checked ? 'flex' : 'none';
  if (hint) hint.style.display = checked ? 'block' : 'none';
  if (!checked) {
    const asIs = document.getElementById('apvAsIsToggle');
    if (asIs) asIs.checked = false;
  }
  renderPreview();
}

export function onApvUnitPick() {
  const picker = document.getElementById('apvUnitPicker');
  const val = picker.value;
  if (!val) return;
  const building = document.getElementById('apvBuilding').value;
  const u = state.units.find(x => x.building && bldgNum(x.building) === bldgNum(building) && String(x.unit) === val);
  if (!u) return;
  document.getElementById('apvUnit').value = u.unit;
  if (u.monthly !== null && u.monthly !== undefined && u.monthly !== '') {
    document.getElementById('apvRent').value = u.monthly;
    document.getElementById('apvInitialRent').value = u.monthly;
    recomputeApvSecurity();
  }
  const inc = (u.incentive || '').trim();
  if (inc && !/^no incentives?$/i.test(inc)) {
    document.getElementById('apvIncentiveToggle').checked = true;
    document.getElementById('apvIncentive').style.display = 'block';
    document.getElementById('apvIncentive').value = inc;
  }
  if (document.getElementById('apvFloorPlanToggle').checked) autoFillApvFloorPlan();
  renderPreview();
}

