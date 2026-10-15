// Application Confirmation email: units, documents by applicant type, and tax years.
import { formatRent } from '../../shared/format.js';
import { escapeHtml, safeUrl } from '../../shared/html.js';
import { taxYears } from '../../shared/requirements.js';
import { getGreeting, renderPreview } from './email-builder.js';
import { bold, EMAIL_FONT, p, SEP } from './email-html.js';
import { refreshUnitPicker } from './form-unit-picker.js';
import { parseTypedDate } from './rules/date-input.js';
import { state } from './state.js';
import { bldgNum, fpKey } from './units.js';

// ============ Application Confirmation mode ============

// Greeting preset dropdown: show/hide custom field
export function onAppConfGreetingPreset() {
  const preset = document.getElementById('appConfGreetingPreset').value;
  const customEl = document.getElementById('appConfGreetingCustom');
  if (customEl) customEl.style.display = (preset === '__custom__') ? 'block' : 'none';
  renderPreview();
}

// Incentive checkbox: show/hide incentive text field
export function onAppConfIncentiveToggle(checked) {
  const el = document.getElementById('appConfIncentive');
  if (el) el.style.display = checked ? 'block' : 'none';
  renderPreview();
}

// Floor plan checkbox: show/hide link field, auto-fill from floor plan file if unit matches
export function onAppConfFloorPlanToggle(checked) {
  const el = document.getElementById('appConfFloorPlan');
  if (el) {
    el.style.display = checked ? 'block' : 'none';
    if (checked) autoFillAppConfFloorPlan();
  }
  renderPreview();
}

// Floor plan box on the App Confirmation / Approval forms follows the building + unit.
// A link that came from the floor plan list (any unit) is replaced when the unit changes; a link you pasted yourself is kept.
export function syncFormFloorPlan(bId, uId, fpId) {
  const el = document.getElementById(fpId); if (!el) return;
  const building = document.getElementById(bId).value, unit = document.getElementById(uId).value.trim();
  const cur = el.value.trim();
  const fromList = !cur || cur === el.dataset.auto || Object.values(state.floorPlans || {}).includes(cur);
  if (!fromList) return;
  const link = (building && unit && state.floorPlans[fpKey(building, unit)]) || '';
  el.value = link; el.dataset.auto = link;
}
function autoFillAppConfFloorPlan() { syncFormFloorPlan('appConfBuilding', 'appConfUnit', 'appConfFloorPlan'); }

// Manual unit entry: if floor plan is on and the field is empty, try to autofill.
// This makes floor plan lookup work for units typed by hand (e.g. not on the showsheet).
export function onAppConfUnitInput() {
  const fpToggle = document.getElementById('appConfFloorPlanToggle');
  const fpEl = document.getElementById('appConfFloorPlan');
  if (fpToggle && fpToggle.checked && fpEl) autoFillAppConfFloorPlan();
  renderPreview();
}

// Building dropdown changed: refresh unit picker + re-try floor plan autofill
export function onAppConfBuildingChange() {
  refreshUnitPicker('appConf');
  if (document.getElementById('appConfFloorPlanToggle').checked) autoFillAppConfFloorPlan();
  renderPreview();
}

// Unit picker (from showsheet) selected: fill unit + rent + incentive
export function onAppConfUnitPick() {
  const picker = document.getElementById('appConfUnitPicker');
  const val = picker.value;
  if (!val) return;  // "type manually" placeholder
  const building = document.getElementById('appConfBuilding').value;
  const u = state.units.find(x => x.building && bldgNum(x.building) === bldgNum(building) && String(x.unit) === val);
  if (!u) return;
  document.getElementById('appConfUnit').value = u.unit;
  if (u.monthly !== null && u.monthly !== undefined && u.monthly !== '') {
    document.getElementById('appConfRent').value = u.monthly;
  }
  // Incentive: if showsheet has a real incentive, enable + fill; else leave as-is
  const inc = (u.incentive || '').trim();
  if (inc && !/^no incentives?$/i.test(inc)) {
    document.getElementById('appConfIncentiveToggle').checked = true;
    document.getElementById('appConfIncentive').style.display = 'block';
    document.getElementById('appConfIncentive').value = inc;
  }
  if (document.getElementById('appConfFloorPlanToggle').checked) autoFillAppConfFloorPlan();
  renderPreview();
}



// App Confirmation: student / self-employed are mutually exclusive.
export function onAppConfTypeToggle(id) {
  const other = id === 'appConfStudent' ? 'appConfSelfEmployed' : 'appConfStudent';
  if (document.getElementById(id).checked) document.getElementById(other).checked = false;
  renderPreview();
}
export function updateAppConfTaxYearsHint() {
  const el = document.getElementById('appConfTaxYearsHint');
  if (!el) return;
  const t = taxYears();
  el.textContent = `${t.y1} + ${t.y2} (extension: ${t.y2} + ${t.y3})`;
}

// Parse a typed date (01232026, 1/23/2026, 01-23-26, etc.) into "Month D, YYYY".
// Leaves the field untouched if it can't confidently parse — so free-form text still works.
export function formatAppConfMoveIn() {
  const el = document.getElementById('appConfMoveIn');
  if (!el) return;
  const formatted = parseTypedDate(el.value);
  if (formatted) { el.value = formatted; renderPreview(); }
}

function getAppConfGreeting() {
  const preset = document.getElementById('appConfGreetingPreset').value;
  if (preset === '__custom__') {
    return document.getElementById('appConfGreetingCustom').value.trim();
  }
  return preset;  // may be '' for "didn't meet"
}

export function buildAppConfHTML() {
  const name = document.getElementById('prospectName').value.trim() || '[Applicant]';
  const opening = getAppConfGreeting();
  const building = document.getElementById('appConfBuilding').value;
  const unit = document.getElementById('appConfUnit').value.trim() || '[Unit]';
  const rentRaw = document.getElementById('appConfRent').value.trim();
  const rent = rentRaw ? `$${formatRent(rentRaw)}/month` : '[Rent]';
  const moveIn = document.getElementById('appConfMoveIn').value.trim() || '[Move-in date]';
  const leaseTerm = document.getElementById('appConfLeaseTerm').value;
  const deadline = document.getElementById('appConfDeadline').value.trim() || '[deadline]';
  const incOn = document.getElementById('appConfIncentiveToggle').checked;
  const incText = document.getElementById('appConfIncentive').value.trim();
  const fpOn = document.getElementById('appConfFloorPlanToggle').checked;
  const fpLink = document.getElementById('appConfFloorPlan').value.trim();
  const isStudent = document.getElementById('appConfStudent').checked;
  const isSelfEmployed = document.getElementById('appConfSelfEmployed').checked;
  const ty = taxYears();
  updateAppConfTaxYearsHint();


  // Greeting line: optional opening + always the thank-you
  let greetingLine;
  if (opening) {
    greetingLine = p(`${escapeHtml(opening)} Thank you for applying to Larkspur Residential.`);
  } else {
    greetingLine = p(`Thank you for applying to Larkspur Residential.`);
  }

  // Application confirmed block
  let confRows = p(bold('APPLICATION CONFIRMED'));
  confRows += p(`${bold('Building:')} ${escapeHtml(building)}`);
  confRows += p(`${bold('Unit:')} ${escapeHtml(unit)}`);
  confRows += p(`${bold('Rent:')} ${escapeHtml(rent)}`);
  confRows += p(`${bold('Move-in:')} ${escapeHtml(moveIn)}`);
  confRows += p(`${bold('Lease Term:')} ${escapeHtml(leaseTerm)}`);
  if (incOn && incText) confRows += p(`${bold('Incentive:')} ${escapeHtml(incText)}`);
  if (fpOn) {
    const link = safeUrl(fpLink)
      ? `<a href="${escapeHtml(safeUrl(fpLink))}">Click here for Floor Plan</a>`
      : '[paste floor plan link]';
    confRows += p(`${bold('Floor Plan:')} ${link}`);
  }

  // Deadline line
  const deadlineLine = p(bold(`Complete the following steps by ${escapeHtml(deadline)} to continue holding this apartment:`));

  // Step 1 — same for everyone
  const step1 = p(bold('Step 1: Occupant Applications')) +
    p(`Anyone over 18 living in the unit must submit their own application. They go to apply.example.com and click "Start New Application." (Occupant applications have no fee, no credit check—just ID + tenant Vero ID required.)`) +
    p(`If you're using a guarantor, the steps are all the same—the only difference is the application type. When selecting the application type, you can choose tenant, occupant, or guarantor; you'll select guarantor.`);

  // Step 2 — differs for students
  const docDisclaimer = p(`Uploaded documents need to be original PDFs, all pages must be included and unedited, and we do not accept screenshots.`);
  let step2;
  if (isStudent) {
    step2 = p(bold('Step 2: Document Upload')) +
      p(`Log into apply.example.com/login and upload:`) +
      `<ul style="margin:0; padding-left:22px;">` +
        `<li>School schedule with your name and your school's name visible</li>` +
        `<li>Your I-20</li>` +
        `<li>Most recent bank statement</li>` +
        `<li>Landlord reference letter</li>` +
        `<li>Passport</li>` +
        `<li>Pet photo (if applicable)</li>` +
      `</ul>` +
      docDisclaimer;
  } else if (isSelfEmployed) {
    step2 = p(bold('Step 2: Document Upload')) +
      p(`Log into apply.example.com/login and upload:`) +
      `<ul style="margin:0; padding-left:22px;">` +
        `<li>${bold('Personal')} tax returns for ${ty.y1} and ${ty.y2} — personal returns only, not business returns — including all pages of each return. If you filed an extension for ${ty.y1}, upload your ${ty.y2} and ${ty.y3} personal returns plus proof of the ${ty.y1} extension. If you file jointly, your co-filer must also submit their own application and complete Vero.</li>` +
        `<li>A CPA letter confirming the income shown on the returns above. If you prepared your own returns, download the IRS tax transcript for each year from IRS.gov and upload it in place of the CPA letter.</li>` +
        `<li>Most recent checking or savings account statement (all pages)</li>` +
        `<li>Landlord reference letter</li>` +
        `<li>Photo ID</li>` +
        `<li>Pet photo (if applicable)</li>` +
      `</ul>` +
      docDisclaimer;
  } else {
    step2 = p(bold('Step 2: Document Upload')) +
      p(`Log into apply.example.com/login and upload:`) +
      `<ul style="margin:0; padding-left:22px;">` +
        `<li>Three most recent paystubs OR offer letter (if starting a new job)</li>` +
        `<li>Most recent bank statement for your payroll account</li>` +
        `<li>Landlord reference letter</li>` +
        `<li>Photo ID</li>` +
        `<li>Pet photo (if applicable)</li>` +
      `</ul>` +
      docDisclaimer +
      p(`${bold('If self-employed:')} Upload your ${ty.y1} and ${ty.y2} personal tax returns only (not business returns; all pages) plus a CPA letter confirming the income shown, or IRS tax transcripts if self-prepared. If you filed an extension for ${ty.y1}, upload ${ty.y2} and ${ty.y3} plus proof of the extension.`);
  }

  // Step 3 — differs for students
  let step3;
  if (isStudent) {
    step3 = p(bold('Step 3: Vero Screening')) +
      p(`After submitting your application, you'll get a Vero link by email. You'll:`) +
      `<ul style="margin:0; padding-left:22px;">` +
        `<li>Accept the application</li>` +
        `<li>Complete ID verification</li>` +
        `<li>If you're a student, skip the employment section.</li>` +
        `<li>Connect your bank account.</li>` +
      `</ul>` +
      p(`If your bank isn't in Plaid's network, you can skip this step and continue.`) +
      p(`${bold('Once Vero is done, click "Submit" - don\'t leave it incomplete.')}`);
  } else if (isSelfEmployed) {
    step3 = p(bold('Step 3: Vero Screening')) +
      p(`After submitting your application, you'll get a Vero link by email. You'll:`) +
      `<ul style="margin:0; padding-left:22px;">` +
        `<li>Accept the application</li>` +
        `<li>Complete ID verification</li>` +
        `<li>Skip the employer link and connect the bank account that receives your business income (via Plaid) so Vero can verify deposits</li>` +
        `<li>Click "Submit" to finish</li>` +
      `</ul>` +
      p(`If your bank isn't in Plaid's network, you can skip the connection and continue.`) +
      p(`${bold('Once Vero is done, click "Submit" - don\'t leave it incomplete.')}`);
  } else {
    step3 = p(bold('Step 3: Vero Screening')) +
      p(`After submitting your application, you'll get a Vero link by email. You'll:`) +
      `<ul style="margin:0; padding-left:22px;">` +
        `<li>Accept the application</li>` +
        `<li>Complete ID verification</li>` +
        `<li>Connect your employer and bank account (via Plaid) so Vero can verify income</li>` +
      `</ul>` +
      p(`If self-employed or your employer can't be linked, connect the bank account that receives income. If your bank isn't in Plaid's network, you can skip the connection and continue.`) +
      p(`${bold('Once Vero is done, click "Submit" - don\'t leave it incomplete.')}`);
  }

  const closing = p(`Let me know if you have questions.`);

  return `<div style="${EMAIL_FONT}">` +
    p(`${getGreeting()} ${escapeHtml(name)},`) + SEP +
    greetingLine + SEP +
    confRows + SEP +
    deadlineLine + SEP +
    step1 + SEP +
    step2 + SEP +
    step3 + SEP +
    closing +
    `</div>`;
}
