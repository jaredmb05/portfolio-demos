// Email Builder: the template switch, the tour / inquiry / welcome emails, and the live preview.
import { formatRent } from '../../shared/format.js';
import { escapeHtml, safeUrl } from '../../shared/html.js';
import { resolveConcession } from '../../shared/pricing.js';
import { buildAppConfHTML } from './application-email.js';
import { buildApprovalHTML, updateApvLlcDisplay } from './approval-email.js';
import { saveMode, saveWelcomeBuilding } from './browser-storage.js';
import { addOutlookSpacers, EMAIL_FONT, SEP } from './email-html.js';
import { DEFAULT_UNAVAILABLE, DEFAULT_WELCOME, templates } from './email-templates.js';
import { refreshUnitPicker } from './form-unit-picker.js';
import { buildPfaHTML, pfaSubMode, setPfaSubMode } from './pfa-email.js';
import { renderPlanStrip } from './plan-tour.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { renderUnitList, syncEmailBrokerUi } from './unit-list.js';
import { bldgTitle, expandType, unitSelectKey } from './units.js';

let unavailableMode = false;     // toggled inside tour/inquiry

export function getGreeting() {
  const choice = document.getElementById('greeting').value;
  if (choice !== 'auto') return choice;
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// The opening line starts as the template editor's Opening Line for the Tour or Inquiry email (B3). It is refreshed while it
// still shows a template's line (or the page's built-in one); a line someone typed is kept. `was`: the template openings
// from before an edit, which the box may still be showing.
export function syncOpeningLine(was = {}) {
  const el = document.getElementById('openingLine'); if (!el) return;
  const cur = el.value.trim();
  const untouched = [el.defaultValue, templates.tour.opening, templates.inquiry.opening, was.tour, was.inquiry].some(t => t !== undefined && cur === String(t).trim());
  if (!cur || untouched) el.value = templates[state.emailMode === 'inquiry' ? 'inquiry' : 'tour'].opening;
}
export function setMode(mode) {
  state.emailMode = mode;
  saveMode();
  // Toggle mode buttons
  document.getElementById('modeTourBtn').classList.toggle('active', mode === 'tour');
  document.getElementById('modeInquiryBtn').classList.toggle('active', mode === 'inquiry');
  document.getElementById('modeWelcomeBtn').classList.toggle('active', mode === 'welcome');
  document.getElementById('modePfaBtn').classList.toggle('active', mode === 'pfa');
  document.getElementById('modeAppConfBtn').classList.toggle('active', mode === 'appconf');
  document.getElementById('modeApprovalBtn').classList.toggle('active', mode === 'approval');
  // Body class drives CSS show/hide for mode-specific panels
  document.body.classList.remove('mode-tour','mode-inquiry','mode-welcome','mode-pfa','mode-appconf','mode-approval');
  document.body.classList.add('mode-' + mode);

  // Update name field label: Tour/Inquiry = prospect, Welcome/PFA = resident
  const nameLabel = document.getElementById('nameFieldLabel');
  const nameInput = document.getElementById('prospectName');
  if (nameLabel && nameInput) {
    if (mode === 'welcome' || mode === 'pfa') {
      nameLabel.textContent = 'Resident name';
      nameInput.placeholder = 'e.g., Sarah';
    } else if (mode === 'appconf') {
      nameLabel.textContent = 'Applicant name';
      nameInput.placeholder = 'e.g., Medina';
    } else if (mode === 'approval') {
      nameLabel.textContent = 'Applicant name';
      nameInput.placeholder = 'e.g., Medina';
    } else {
      nameLabel.textContent = 'Prospect first name';
      nameInput.placeholder = 'e.g., Medina';
    }
  }

  // PFA: restore sub-mode (info vs signed) and its button state
  if (mode === 'pfa') {
    setPfaSubMode(pfaSubMode);
  }

  // App Confirmation: refresh the showsheet unit picker for the current building
  if (mode === 'appconf') {
    refreshUnitPicker('appConf');
  }

  // Lease Approval: refresh unit picker + LLC display
  if (mode === 'approval') {
    refreshUnitPicker('apv');
    updateApvLlcDisplay();
  }

  // Tour/inquiry: sync opening line + floor plan default
  if (mode === 'tour' || mode === 'inquiry') {
    syncOpeningLine();
    // Floor plan default per mode
    state.selectedUnits.forEach(s => { s.addFloorPlan = (mode === 'tour'); });
  }

  // Welcome mode: sync building dropdown + COI banner + subject line
  if (mode === 'welcome') {
    const sel = document.getElementById('welcomeBuilding');
    if (sel) sel.value = state.welcomeBuilding;
    updateWelcomeUi();
  }

  renderPreview();
}

export function updateWelcomeUi() {
  const sel = document.getElementById('welcomeBuilding');
  if (sel) {
    state.welcomeBuilding = sel.value;
    saveWelcomeBuilding();
  }
  const tpl = templates.welcome[state.welcomeBuilding] || DEFAULT_WELCOME[state.welcomeBuilding];
  if (!tpl) return;
  const subjectEl = document.getElementById('welcomeSubject');
  if (subjectEl) subjectEl.textContent = tpl.subject;
  const coiEl = document.getElementById('coiFilename');
  if (coiEl) coiEl.textContent = tpl.coi;
}

export function toggleUnavailable(checked) {
  unavailableMode = checked;
  const fields = document.getElementById('unavailableFields');
  if (fields) fields.classList.toggle('show', checked);
  const note = document.getElementById('openingNote'); if (note) note.style.display = checked ? '' : 'none';
  if (checked) refreshUnavailablePicker();
  renderPreview();
}

// Build the "which unit did they want?" dropdown from the loaded showsheet, plus a manual-entry option.
export function refreshUnavailablePicker() {
  const sel = document.getElementById('unavailablePick');
  if (!sel) return;
  const prev = sel.value;
  let html = `<option value="">Select the unit from the showsheet…</option>`;
  const byB = {};
  state.units.forEach(u => { (byB[u.building] = byB[u.building] || []).push(u); });
  for (const [b, list] of Object.entries(byB)) {
    html += `<optgroup label="${escapeHtml(bldgTitle(b))}">`;
    list.forEach(u => { html += `<option value="${escapeHtml(unitSelectKey(u))}">#${escapeHtml(u.unit)} — ${escapeHtml(u.type)}</option>`; });
    html += `</optgroup>`;
  }
  sel.innerHTML = html;
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev; else sel.value = '';
}
export function onUnavailablePick(val) {
  const b = document.getElementById('unavailableBuilding');
  const u = document.getElementById('unavailableUnit');
  if (!val) { b.value = ''; u.value = ''; }
  else {
    const unit = state.units.find(x => unitSelectKey(x) === val);
    if (unit) { b.value = bldgTitle(unit.building); u.value = String(unit.unit); }
  }
  renderPreview();
}
export function onUnavailableManualToggle(manual) {
  const pick = document.getElementById('unavailablePick');
  document.getElementById('unavailManualBldg').style.display = manual ? '' : 'none';
  document.getElementById('unavailManualUnit').style.display = manual ? '' : 'none';
  pick.disabled = manual;
  const b = document.getElementById('unavailableBuilding');
  const u = document.getElementById('unavailableUnit');
  if (manual) { pick.value = ''; b.value = ''; u.value = ''; b.focus(); }
  else { onUnavailablePick(pick.value); return; }
  renderPreview();
}

export function copySubjectLine() {
  const tpl = templates.welcome[state.welcomeBuilding] || DEFAULT_WELCOME[state.welcomeBuilding];
  if (!tpl) return;
  const subj = tpl.subject;
  // execCommand path
  try {
    const el = document.createElement('textarea');
    el.value = subj;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok) { toast(`Subject copied: "${subj}"`); return; }
  } catch(e) {}
  // Clipboard API fallback
  navigator.clipboard.writeText(subj)
    .then(() => toast(`Subject copied: "${subj}"`))
    .catch(() => toast('Subject copy failed', true));
}


export function buildEmailHTML() {
  if (state.emailMode === 'welcome') return buildWelcomeHTML();
  if (state.emailMode === 'pfa')     return buildPfaHTML();
  if (state.emailMode === 'appconf') return buildAppConfHTML();
  if (state.emailMode === 'approval') return buildApprovalHTML();
  return buildUnitsEmailHTML();  // tour or inquiry
}

function buildWelcomeHTML() {
  const name = document.getElementById('prospectName').value.trim() || '[Resident]';
  const greeting = getGreeting();
  const tpl = templates.welcome[state.welcomeBuilding] || DEFAULT_WELCOME[state.welcomeBuilding];
  if (!tpl) return '<p>No welcome template found for this building.</p>';
  const sig = templates.welcomeSignature || 'Best,';
  return `<div style="${EMAIL_FONT}">` +
    `<p style="margin:0; padding:0;">${greeting} ${escapeHtml(name)},</p>` + SEP +
    addOutlookSpacers(tpl.body) + SEP +
    `<p style="margin:0; padding:0;">${sig}</p>` +
    `</div>`;
}

function buildUnitsEmailHTML() {
  const name = document.getElementById('prospectName').value.trim() || '[Prospect]';
  const greeting = getGreeting();
  const opening = document.getElementById('openingLine').value.trim();
  const tpl = templates[state.emailMode];
  const isInquiry = state.emailMode === 'inquiry';
  const isTour = state.emailMode === 'tour';

  // Determine primary building (for inquiry mode closing line)
  const primaryBuilding = state.selectedUnits.length > 0 ? state.selectedUnits[0].building : '[Building]';

  // Unavailable opening overrides standard opening when toggle is on
  let openingHtml = '';
  if (unavailableMode) {
    const ub = (document.getElementById('unavailableBuilding')?.value || '[building]').trim() || '[building]';
    const uu = (document.getElementById('unavailableUnit')?.value || '[unit]').trim() || '[unit]';
    openingHtml = (templates.unavailable || DEFAULT_UNAVAILABLE)
      .replace(/\{unit\}/g, escapeHtml(uu))
      .replace(/\{building\}/g, escapeHtml(ub));
  } else {
    openingHtml = escapeHtml(opening);
  }

  let unitsIntro = '';
  let unitsHtml = '';
  if (state.selectedUnits.length === 0) {
    unitsIntro = '';
    unitsHtml = unavailableMode
      ? '<p style="color:#888; font-style:italic; margin:0; padding:0;">[Select alternative units below]</p>'
      : '<p style="color:#888; font-style:italic; margin:0; padding:0;">No units selected yet.</p>';
  } else {
    if (unavailableMode) {
      // In "unavailable" mode the units are alternatives — opening already sets context
      unitsIntro = '';
    } else if (state.selectedUnits.length === 1) {
      const u = state.selectedUnits[0];
      if (isTour) {
        unitsIntro = `Here are further details regarding <u>Unit #${escapeHtml(u.unit)} at ${escapeHtml(u.building)}</u>, please see below:`;
      } else {
        unitsIntro = `I have provided further information regarding <u>Unit #${escapeHtml(u.unit)} at ${escapeHtml(u.building)}</u>, please see below:`;
      }
    } else {
      unitsIntro = isTour
        ? `Here are further details regarding the units we toured today, please see below:`
        : `I have provided further information regarding the units below:`;
    }
    state.selectedUnits.forEach((s, idx) => {
      const expandedType = expandType(s.type);
      const resolved = resolveConcession(s);
      const concessionText = resolved.text;
      const concessionLine = concessionText
        ? `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><strong style="font-weight:bold;">Concession:</strong> ${escapeHtml(concessionText)}</p>`
        : '';
      // 2110-specific footnote
      const isLastMonthBldg = /^2110\b/i.test(String(s.building || ''));
      // Note applies to any renter-facing incentive (not a pure broker OP)
      const isPureOp = concessionText && /\bOP\b/i.test(concessionText) && !/\b(free|credit|off)\b/i.test(concessionText);
      const lastMonthNote = (isLastMonthBldg && concessionText && !isPureOp)
        ? `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><em>*Incentive is applied to the last month of the lease</em></p>`
        : '';
      let netEffLine = '';
      if (resolved.netEff !== null && resolved.netEff !== undefined) {
        netEffLine = `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><em>Net Effective: $${formatRent(resolved.netEff)}</em></p>`;
      }
      let fpLine = '';
      if (s.addFloorPlan) {
        const fpLink = safeUrl(s.floorPlan)
          ? `<a href="${escapeHtml(safeUrl(s.floorPlan))}">Click here for Floor Plan</a>`
          : `<em style="color:#888;">[Floor plan link missing]</em>`;
        fpLine = `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;">` + fpLink + `</p>`;
      }
      const notesBlock = s.notes ? `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><em>${escapeHtml(s.notes)}</em></p>` : '';
      const isAmenityFeeBldg = /^2050\b/i.test(String(s.building || ''));
      const amenityLine = isAmenityFeeBldg ? `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><em>*$40/month per person amenity fee applies</em></p>` : '';
      // Unit lines stack tight (no SEP between lines within a unit), but each unit block
      // is followed by SEP so consecutive units don't run together.
      unitsHtml += `<p style="margin:0 0 2px 0; padding:0;"><strong style="font-weight:bold; text-decoration:underline;">${escapeHtml(s.building)} #${escapeHtml(s.unit)}</strong></p>` +
`<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;">${escapeHtml(expandedType)}</p>` +
`${s.view ? `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;">View: ${escapeHtml(s.view)}</p>` : ''}` +
`${s.sqft ? `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;">Approx. ${escapeHtml(String(s.sqft))} sq. ft.</p>` : ''}` +
`<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;">$${formatRent(s.monthly)}/mo*</p>` +
`${concessionLine}` +
`${lastMonthNote}` +
`${netEffLine}` +
`${amenityLine}` +
`${notesBlock}` +
`<p style="margin:0; padding:0;"><strong style="font-weight:bold; text-decoration:none;">Available ${escapeHtml(s.avail)}</strong></p>` +
`${s.addFloorPlan ? fpLine : ''}` +
SEP;
    });
  }
  const parkingBlock = state.includeParking ? `<p style="margin:0; padding:0;">${templates.parking}</p>` + SEP : '';
  const shuttleBlock = state.includeShuttle ? `<p style="margin:0; padding:0;">${templates.shuttle}</p>` + SEP : '';

  // Application requirements / apply link (tour only by default)
  const requirementsBlock = tpl.showRequirements
    ? `<p style="margin:0; padding:0;">Additionally, please see below for further information regarding the application process:</p>` + SEP + addOutlookSpacers(tpl.requirements) + SEP
    : '';
  const applyBlock = tpl.showApplyLink
    ? `<p style="margin:0; padding:0;"><a href="${escapeHtml(tpl.applyUrl)}">${escapeHtml(tpl.applyText)}</a></p>` + SEP
    : '';

  // Closing — for inquiry, substitute {primaryBuilding}
  let closingHtml = tpl.closing.replace(/\{primaryBuilding\}/g, escapeHtml(primaryBuilding));
  if (isTour) closingHtml = escapeHtml(closingHtml);

  return `<div style="${EMAIL_FONT}">` +
`<p style="margin:0; padding:0;">${greeting} ${escapeHtml(name)},</p>` + SEP +
`<p style="margin:0; padding:0;">${openingHtml}</p>` + SEP +
`${unitsIntro ? `<p style="margin:0; padding:0;">${unitsIntro}</p>` + SEP : ''}` +
`${unitsHtml}` +
`${state.selectedUnits.length > 0 ? `<p style="margin:0; padding:0;"><em>*Price subject to change.</em></p>` + SEP : ''}` +
`${requirementsBlock}` +
`${applyBlock}` +
`${parkingBlock}` +
`${shuttleBlock}` +
`<p style="margin:0; padding:0;">${closingHtml}</p>` +
`${tpl.signature ? SEP + `<p style="margin:0; padding:0;">${tpl.signature}</p>` : ''}` +
`</div>`;
}

export function renderPreview() {
  document.getElementById('preview').innerHTML = buildEmailHTML();
}

export function resetEmail() {
  state.activeTour = null; renderPlanStrip();
  state.emailBroker = false; syncEmailBrokerUi();
  document.getElementById('prospectName').value = '';
  // Reset opening line to mode default (only relevant in tour/inquiry)
  const openingEl = document.getElementById('openingLine');
  if (openingEl) openingEl.value = templates[state.emailMode === 'inquiry' ? 'inquiry' : 'tour'].opening;
  document.getElementById('incParking').checked = false;
  document.getElementById('incShuttle').checked = false;
  state.includeParking = false;
  state.includeShuttle = false;
  // Reset unavailable toggle
  const unavailEl = document.getElementById('unavailableToggle');
  if (unavailEl) unavailEl.checked = false;
  unavailableMode = false;
  const openingNote = document.getElementById('openingNote'); if (openingNote) openingNote.style.display = 'none';
  document.getElementById('unavailableFields')?.classList.remove('show');
  const unavailBldg = document.getElementById('unavailableBuilding');
  const unavailUnit = document.getElementById('unavailableUnit');
  if (unavailBldg) unavailBldg.value = '';
  if (unavailUnit) unavailUnit.value = '';
  const unavailManual = document.getElementById('unavailableManual');
  if (unavailManual) { unavailManual.checked = false; onUnavailableManualToggle(false); }
  const unavailPick = document.getElementById('unavailablePick');
  if (unavailPick) { unavailPick.value = ''; onUnavailablePick(''); }
  state.selectedUnits = [];
  renderUnitList();
  renderPreview();
}
