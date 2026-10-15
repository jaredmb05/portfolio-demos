// The unit list in the Email Builder: filters, selection, and the inline editor for each selected unit.
import { linkFieldLabels } from '../../shared/dom.js';
import { formatRent } from '../../shared/format.js';
import { escapeHtml, jsArg } from '../../shared/html.js';
import { isAndStyleConcession, leaseTerm, opOnlyOffer, OTHER_FREE_OPTIONS, OTHER_OP_OPTIONS, resolveConcession, resolveOp } from '../../shared/pricing.js';
import { fitsNeeds, typeSelectHtml, viewSelectHtml } from '../../shared/unit-options.js';
import { renderPreview } from './email-builder.js';
import { renderPlanStrip } from './plan-tour.js';
import { brokerDefaults } from './rules/tour-selection.js';
import { state } from './state.js';
import { bldgTitle, fpKey, unitSelectKey } from './units.js';

export let activeQuickFilter = 'all';

export function setQuickFilter(filter, btn) {
  activeQuickFilter = filter;
  document.querySelectorAll('.qf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderUnitList();
}

function matchesQuickFilter(u) {
  const bg = (u.bedroomGroup || '').toUpperCase();
  switch (activeQuickFilter) {
    case 'all':      return true;
    case 'studio':   return bg.includes('STUDIO') || bg.includes('CONVERTIBLE');
    case '1br':      return bg.includes('1 BEDROOM') || bg.includes('JR 1');
    case '2br':      return bg.includes('2 BEDROOM');
    case '3br':      return bg.includes('3 BEDROOM') || bg.includes('PENTHOUSE');
    case 'priority': return !!u.priority;
    case 'hasfp':    return !!state.floorPlans[fpKey(u.building, u.unit)];
    case 'fits':     return fitsNeeds(u, state.activeTour && state.activeTour.profile);
    default:         return true;
  }
}

function inlineEditorHtml(s) {
  // Rendered closed when the unit was just selected (then animated open), open otherwise; collapsed stays shut.
  const openCls = (s.isNew || s.collapsed) ? '' : ' open';
  return `<div class="inline-editor${openCls}" data-sel-key="${escapeHtml(s.key)}"><div>${selectedCardHtml(s)}</div></div>`;
}
function chevronHtml(s) {
  return `<button type="button" class="unit-chevron${s.collapsed ? '' : ' open'}" title="${s.collapsed ? 'Expand' : 'Collapse'} details" aria-label="${s.collapsed ? 'Show' : 'Hide'} details for #${escapeHtml(s.unit || '')}" aria-expanded="${!s.collapsed}" onclick="event.stopPropagation(); toggleCollapse(${jsArg(s.key)})">&#9662;</button>`;
}
// "Selected: #1812 · #2305" above the list, so you can see the email's units without scrolling
function renderSelSummary() {
  const el = document.getElementById('selSummary'); if (!el) return;
  el.innerHTML = state.selectedUnits.length ? `Selected for this email: ${state.selectedUnits.map(x => `<b>#${escapeHtml(x.unit || '?')}</b>`).join(' · ')}` : '';
}
export function toggleCollapse(key) {
  const s = state.selectedUnits.find(x => x.key === key);
  if (!s) return;
  s.collapsed = !s.collapsed;
  const ed = document.querySelector(`.inline-editor[data-sel-key="${CSS.escape(key)}"]`);
  const ch = document.querySelector(`.unit-row[data-key="${CSS.escape(key)}"] .unit-chevron`);
  if (ed) ed.classList.toggle('open', !s.collapsed);
  if (ch) { ch.classList.toggle('open', !s.collapsed); ch.title = (s.collapsed ? 'Expand' : 'Collapse') + ' details'; ch.setAttribute('aria-expanded', String(!s.collapsed)); }
}
export function renderUnitList() {
  const container = document.getElementById('unitListContainer');
  const customUnits = state.selectedUnits.filter(s => s.custom);
  renderSelSummary();
  if (!state.units.length && !customUnits.length) {
    container.innerHTML = `<div class="empty">No showsheet loaded yet.<div class="empty-actions"><button class="tiny" onclick="document.querySelector('#ssCard input[type=file]').click()">Upload .xlsx</button><button class="tiny ghost" onclick="openDbxSettings()">Set up Dropbox sync</button></div></div>`;
    return;
  }
  const search = (document.getElementById('unitSearch').value || '').toLowerCase().trim();
  const filtered = state.units.filter(u => {
    const matchesSearch = !search || (u.building + ' ' + u.unit + ' ' + u.type + ' ' + u.bedroomGroup + ' ' + u.view).toLowerCase().includes(search);
    return matchesSearch && matchesQuickFilter(u);
  });
  const byBuilding = {};
  filtered.forEach(u => {
    if (!byBuilding[u.building]) byBuilding[u.building] = {};
    if (!byBuilding[u.building][u.bedroomGroup]) byBuilding[u.building][u.bedroomGroup] = [];
    byBuilding[u.building][u.bedroomGroup].push(u);
  });
  const fpLoaded = Object.keys(state.floorPlans).length > 0;
  let html = '';
  // Result count bar
  const isFiltered = activeQuickFilter !== 'all' || !!document.getElementById('unitSearch').value.trim();
  if (isFiltered) {
    const total = state.units.length;
    html += `<div style="font-size:var(--fs-sm); color:var(--ink-soft); padding:2px 2px 8px; display:flex; align-items:center; gap:8px;">
      Showing ${filtered.length} of ${total} units
      <button class="tiny ghost" onclick="document.getElementById('unitSearch').value=''; setQuickFilter('all', document.querySelector('.qf-btn[data-filter=all]'));">Clear filter</button>
    </div>`;
  }
  if (!filtered.length && state.units.length) {
    html += `<div class="empty">No units match this filter.</div>`;
  }
  for (const [building, groups] of Object.entries(byBuilding)) {
    const totalCount = Object.values(groups).reduce((s, arr) => s + arr.length, 0);
    const matchedCount = Object.values(groups).flat().filter(u => state.floorPlans[fpKey(u.building, u.unit)]).length;
    const fpStatus = fpLoaded
      ? `<span class="building-count">${matchedCount}/${totalCount} with floor plans</span>`
      : `<span class="building-count">${totalCount} units</span>`;
    html += `<div class="building"><div class="building-header">${escapeHtml(building)}${fpStatus}</div>`;
    for (const [bg, list] of Object.entries(groups)) {
      html += `<div class="bedroom-group"><div class="bedroom-label">${escapeHtml(bg)}</div>`;
      for (const u of list) {
        const ukey = unitSelectKey(u);
        const isSel = state.selectedUnits.some(s => s.key === ukey);
        const hasFp = !!state.floorPlans[fpKey(u.building, u.unit)];
        // Only show "no floor plan" badge — presence is implied when FP loads
        const fpBadge = fpLoaded && !hasFp ? '<span class="flag nofp" title="No floor plan loaded for this unit">No floor plan</span>' : '';
        const appBadge = u.hasApp ? '<span class="flag pending" title="Application pending on this unit">App pending</span>' : '';
        const hasIncentive = u.incentive && !/^no incentives?$/i.test(String(u.incentive).trim()) && u.incentive !== '';
        const incentivePill = hasIncentive ? `<span class="flag inc" title="${escapeHtml(u.incentive)}">${escapeHtml(u.incentive)}</span>` : '';
        const badgeLine = [appBadge, incentivePill, fpBadge].filter(Boolean).join('');
        html += `
          <div class="unit-row ${isSel?'selected':''} ${u.hasApp?'has-app':''}" data-key="${escapeHtml(ukey)}" onclick="toggleUnit(${jsArg(ukey)})">
            <input type="checkbox" ${isSel?'checked':''} aria-label="Unit ${escapeHtml(u.unit)}, ${escapeHtml(bldgTitle(u.building))}" onclick="event.stopPropagation(); toggleUnit(${jsArg(ukey)})">
            <div class="unit-info">
              <div class="unit-num">${u.priority?'<span class="priority-dot" title="Priority" aria-label="Priority"></span>':''}#${escapeHtml(u.unit)}</div>
              <div class="unit-desc">${escapeHtml(u.type)} · ${escapeHtml(u.sqft||'?')} sqft · ${escapeHtml(u.view||'')}${badgeLine ? '<div class="unit-flags">' + badgeLine + '</div>' : ''}</div>
              <div class="unit-rent">$${formatRent(u.monthly)}</div>
            </div>
            ${isSel ? chevronHtml(state.selectedUnits.find(s => s.key === ukey)) : ''}
          </div>`;
        if (isSel) html += inlineEditorHtml(state.selectedUnits.find(s => s.key === ukey));
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  // Custom (hand-entered) units live at the bottom of the list, unaffected by filters
  if (customUnits.length) {
    html += `<div class="building"><div class="building-header">Custom Units<span class="building-count">${customUnits.length} added manually</span></div>`;
    customUnits.forEach(s => {
      html += `
          <div class="unit-row selected custom-row" data-key="${escapeHtml(s.key)}" onclick="toggleCollapse(${jsArg(s.key)})">
            <span style="width:16px; text-align:center; color:var(--accent);" aria-hidden="true">&#9998;</span>
            <div class="unit-info">
              <div class="unit-num">#${escapeHtml(s.unit || '?')}</div>
              <div class="unit-desc">${escapeHtml(bldgTitle(s.building) || '(building)')} · ${escapeHtml(s.type || '')}</div>
              <div class="unit-rent">${s.monthly ? '$' + formatRent(s.monthly) : ''}</div>
            </div>
            ${chevronHtml(s)}
          </div>` + inlineEditorHtml(s);
    });
    html += `</div>`;
  }
  container.innerHTML = html;
  linkFieldLabels(container);
  // Newly selected units: animate their editor open, then clear the flag
  requestAnimationFrame(() => {
    state.selectedUnits.forEach(s => {
      if (s.isNew) {
        const ed = document.querySelector(`.inline-editor[data-sel-key="${CSS.escape(s.key)}"]`);
        if (ed && !s.collapsed) ed.classList.add('open');
        s.isNew = false;
      }
    });
  });
}

// "Sending to a broker": one switch per email. It sets every selected unit's broker terms; each unit's checkboxes still allow
// an exception. A tour with a broker turns it on, Reset turns it off.
export function setEmailBroker(on) {
  state.emailBroker = !!on;
  state.selectedUnits.forEach(s => Object.assign(s, brokerDefaults(s, state.emailBroker)));
  syncEmailBrokerUi(); renderUnitList(); renderPreview();
}
export function syncEmailBrokerUi() { const c = document.getElementById('emailBrokerChk'); if (c) c.checked = state.emailBroker; }
export function toggleUnit(key) {
  setTimeout(renderPlanStrip, 0);
  const idx = state.selectedUnits.findIndex(s => s.key === key);
  if (idx >= 0) {
    state.selectedUnits.splice(idx, 1);
  } else {
    const u = state.units.find(uu => unitSelectKey(uu) === key);
    if (!u) return;
    const linkLookup = state.floorPlans[fpKey(u.building, u.unit)] || '';
    state.selectedUnits.push({
      key,
      building: u.building, unit: u.unit, type: u.type,
      sqft: u.sqft, view: u.view, monthly: u.monthly, avail: u.avail,
      netEff: u.netEff, incentive: u.incentive,
      ...brokerDefaults(u, state.emailBroker), collapsed: false,   // the switch decides a new unit's broker terms
      addFloorPlan: (state.emailMode === 'tour'),  // ON for tours, OFF for inquiries
      notes: '', floorPlan: linkLookup, autoLinked: !!linkLookup,
      isNew: true  // animation flag — cleared after first render
    });
  }
  renderUnitList();
  // Animate the unit row highlight in the list after re-render
  requestAnimationFrame(() => {
    const row = document.querySelector(`.unit-row[data-key="${CSS.escape(key)}"]`);
    if (row && row.classList.contains('selected')) {
      row.classList.add('just-selected');
      setTimeout(() => row.classList.remove('just-selected'), 600);
    }
  });
  renderPreview();
}

export function clearSelections() {
  state.selectedUnits = [];
  renderUnitList();
  renderPreview();
}

export function addCustomUnit() {
  const key = 'custom-' + Date.now();
  state.selectedUnits.push({
    key, custom: true,
    building: '', unit: '', type: '',
    sqft: '', view: '', monthly: '', avail: 'Immediately',
    netEff: '', incentive: '',
    showNetEff: false, opOnly: false, noBroker: true, collapsed: false,
    addFloorPlan: (state.emailMode === 'tour'),
    notes: '', floorPlan: '',
    isNew: true
  });
  renderUnitList();
  renderPreview();
  requestAnimationFrame(() => {
    const row = document.querySelector(`.unit-row[data-key="${CSS.escape(key)}"]`);
    if (row && row.scrollIntoView) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

export function removeSelected(key) {
  state.selectedUnits = state.selectedUnits.filter(s => s.key !== key);
  renderUnitList();
  renderPreview();
}

export function updateSelected(key, field, value) {
  const s = state.selectedUnits.find(s => s.key === key);
  if (!s) return;
  s[field] = value;
  // Custom unit typed in on the Desk: fill the floor plan from the master as soon as building + unit match one
  if (s.custom && (field === 'unit' || field === 'building') && (!s.floorPlan || s.autoLinked)) {
    const url = state.floorPlans[fpKey(s.building, s.unit)];
    if (url) { s.floorPlan = url; s.autoLinked = true; s.addFloorPlan = true; const inp = document.querySelector(`.fp-input[data-key="${CSS.escape(s.key)}"]`); if (inp) inp.value = url; }
    else if (s.autoLinked) { s.floorPlan = ''; s.autoLinked = false; }
  }
  if (s.custom && ['unit','building','type','monthly'].includes(field)) {   // keep the row header in sync while typing
    const row = document.querySelector(`.custom-row[data-key="${CSS.escape(key)}"]`);
    if (row) {
      row.querySelector('.unit-num').textContent = '#' + (s.unit || '?');
      row.querySelector('.unit-desc').textContent = `${bldgTitle(s.building) || '(building)'} • ${s.type || ''}`;
      row.querySelector('.unit-rent').textContent = s.monthly ? '$' + formatRent(s.monthly) : '';
    }
  }
  if (s.custom && ['unit','building','floorPlan'].includes(field)) updateFpStatus(s);
  if (field === 'unit') renderSelSummary();   // "Selected for this email" keeps up while a unit number is typed
  if (field === 'otherFree' || field === 'otherOp' || field === 'otherOpMode') renderUnitList();  // select change: safe to re-render
  renderPreview();
}
function fpStatusText(s) {
  if (!s.building || !s.unit) return 'Pick the building and unit — the floor plan fills in if it\'s in your floor plan list.';
  const url = state.floorPlans[fpKey(s.building, s.unit)];
  if (url && s.floorPlan === url) return '✓ Found in your floor plan list';
  if (s.floorPlan) return 'Using the link you pasted';
  return 'Not in your floor plan list — paste the Dropbox link above';
}
function updateFpStatus(s) {
  const el = document.querySelector(`.fp-status[data-key="${CSS.escape(s.key)}"]`);
  if (el) { el.textContent = fpStatusText(s); el.style.color = /^✓/.test(el.textContent) ? 'var(--green)' : 'var(--ink-soft)'; }
}

export function toggleSelectedFlag(key, field) {
  const s = state.selectedUnits.find(s => s.key === key);
  if (s) {
    s[field] = !s[field];
    // If user just enabled "OP only" on an OR-style concession, uncheck Net Effective
    // (broker is taking the OP, so the discounted net effective doesn't apply)
    if (field === 'opOnly' && s.opOnly && /\bor\b/i.test(String(s.incentive || ''))) {
      s.showNetEff = false;
    }
    if (field === 'otherConc' && s.otherConc) {
      if (s.otherTerm === undefined || s.otherTerm === '') s.otherTerm = leaseTerm(s.incentive);
      if (s.otherFree === undefined) s.otherFree = 0;
    }
    renderUnitList();
    renderPreview();
  }
}
// With free months and an OP both set in "Other concession", its Either/or / Both selector decides the broker rule (D19)
function selectorMode(s) { return s.otherConc && Number(s.otherFree || 0) > 0 && resolveOp(s).amount > 0 ? (s.otherOpMode === 'and' ? 'and' : 'or') : ''; }
function otherConcessionHtml(s) {
  const k = jsArg(s.key);   // the unit key as a handler argument
  const opts = OTHER_FREE_OPTIONS.map(([v,l]) => `<option value="${v}" ${Number(s.otherFree||0)===v?'selected':''}>${l}</option>`).join('');
  return `
            <div class="checkbox-row" style="margin-top:8px;">
              <label class="cbx"><input type="checkbox" ${s.otherConc?'checked':''} onchange="toggleSelectedFlag(${k},'otherConc')"> <span>Other concession</span></label>
            </div>
            ${s.otherConc ? `
            <div class="field-row" style="margin-top:8px;">
              <div><label>Free Months <span style="font-weight:400; text-transform:none; letter-spacing:normal;">(replaces showsheet)</span></label>
                <select onchange="updateSelected(${k},'otherFree',this.value)">${opts}</select></div>
              <div><label>Lease Term (months)</label>
                <input type="text" value="${escapeHtml(s.otherTerm ?? leaseTerm(s.incentive))}" oninput="updateSelected(${k},'otherTerm',this.value)"></div>
            </div>
            <div class="field-row">
              <div><label>Broker OP</label>
                <select onchange="updateSelected(${k},'otherOp',this.value)">${OTHER_OP_OPTIONS.map(([v,l]) => `<option value="${v}" ${String(s.otherOp||0)===String(v)?'selected':''}>${l}</option>`).join('')}<option value="custom" ${s.otherOp==='custom'?'selected':''}>Other…</option></select>
                ${s.otherOp==='custom' ? `<input type="text" value="${escapeHtml(s.otherOpCustom||'')}" placeholder="e.g., 1.5 (months) or $3000" oninput="updateSelected(${k},'otherOpCustom',this.value)" style="margin-top:6px;">` : ''}</div>
              <div><label>Free Months &amp; OP Offered As</label>
                <select onchange="updateSelected(${k},'otherOpMode',this.value)" ${(Number(s.otherFree||0)>0 && resolveOp(s).amount>0) ? '' : 'disabled'}>
                  <option value="or" ${(s.otherOpMode||'or')==='or'?'selected':''}>Either / or</option>
                  <option value="and" ${s.otherOpMode==='and'?'selected':''}>Both (AND)</option>
                </select></div>
            </div>
            ${selectorMode(s) === 'or' ? `
            <div class="checkbox-row" style="margin-bottom:8px;"><label class="cbx"><input type="checkbox" ${s.opOnly?'checked':''} onchange="toggleSelectedFlag(${k},'opOnly')"> <span>OP only — broker came in with prospect (uncheck if the broker waives it)</span></label></div>
            ` : selectorMode(s) === 'and' ? `
            <div class="checkbox-row" style="margin-bottom:8px;"><label class="cbx"><input type="checkbox" ${s.noBroker?'checked':''} onchange="toggleSelectedFlag(${k},'noBroker')"> <span>No broker — hide the OP part (uncheck if a broker brought them)</span></label></div>
            ` : ''}
            <div class="field-row">
              <div><label>Credit ($) <span style="font-weight:400; text-transform:none; letter-spacing:normal;">(adds on)</span></label>
                <input type="text" value="${escapeHtml(s.otherCredit||'')}" placeholder="e.g., 500" oninput="updateSelected(${k},'otherCredit',this.value)"></div>
              <div><label>Credit Type</label>
                <input type="text" value="${escapeHtml(s.otherCreditLabel||'one-time credit')}" placeholder="e.g., AMEX gift card" oninput="updateSelected(${k},'otherCreditLabel',this.value)"></div>
            </div>
            <div style="font-size:var(--fs-sm); color:var(--ink-soft);">${escapeHtml(otherConcessionSummary(s))}</div>
            ` : ''}`;
}
function otherConcessionSummary(s) {
  const r = resolveConcession(s);
  if (!r.text) return 'Pick free months and/or enter a credit.';
  return `Email: "${r.text}"` + (r.netEff !== null ? ` · Net effective $${formatRent(r.netEff)}` : '');
}
function selectedCardHtml(s) {
    let html = '';
    const fpBadge = s.autoLinked
      ? '<span class="label-hint" style="color:var(--green);">✓ auto-matched</span>'
      : (s.custom ? '' : '<span class="label-hint" style="color:var(--accent);">no match — paste link below</span>');
    const hasIncentive = s.incentive && !/^no incentives?$/i.test(String(s.incentive).trim());
    const hasOrInIncentive = hasIncentive && /\bor\b/i.test(String(s.incentive));
    const hasAndInIncentive = hasIncentive && isAndStyleConcession(s.incentive);
    const hasNetEff = s.netEff !== null && s.netEff !== undefined && s.netEff !== '';
    html += `<div class="selected-card${s.custom ? '' : ' no-header'}" data-sel-key="${escapeHtml(s.key)}">
      ${s.custom ? `<div class="selected-card-header">
        ✎ Custom unit
        <button class="tiny ghost danger" onclick="removeSelected(${jsArg(s.key)})">Remove</button>
      </div>` : ''}
      <div class="selected-card-body">
        ${s.custom ? `
          <div class="field-row">
            <div><label>Building</label><select onchange="updateSelected(${jsArg(s.key)},'building',this.value)">
              <option value="" ${!s.building ? 'selected' : ''}>Select building…</option>
              <option value="2040 TIDEMARK BLVD" ${s.building === '2040 TIDEMARK BLVD' ? 'selected' : ''}>2040 Tidemark Blvd</option>
              <option value="2050 TIDEMARK BLVD" ${s.building === '2050 TIDEMARK BLVD' ? 'selected' : ''}>2050 Tidemark Blvd</option>
              <option value="2110 TIDEMARK BLVD" ${s.building === '2110 TIDEMARK BLVD' ? 'selected' : ''}>2110 Tidemark Blvd</option>
              <option value="2120 TIDEMARK BLVD" ${s.building === '2120 TIDEMARK BLVD' ? 'selected' : ''}>2120 Tidemark Blvd</option>
              <option value="2230 TIDEMARK BLVD" ${s.building === '2230 TIDEMARK BLVD' ? 'selected' : ''}>2230 Tidemark Blvd</option>
            </select></div>
            <div><label>Unit #</label><input type="text" value="${escapeHtml(s.unit)}" oninput="updateSelected(${jsArg(s.key)},'unit',this.value)"></div>
          </div>
          <div class="field-row">
            <div><label>Type</label>${typeSelectHtml(s.type, `updateSelected('${escapeHtml(s.key)}','type',this.value)`, escapeHtml)}</div>
            <div><label>Sq Ft</label><input type="text" value="${escapeHtml(s.sqft)}" oninput="updateSelected(${jsArg(s.key)},'sqft',this.value)"></div>
          </div>
          <div class="field-row">
            <div><label>View</label>${viewSelectHtml(s.view, `updateSelected('${escapeHtml(s.key)}','view',this.value)`, escapeHtml)}</div>
            <div><label>Monthly Rent</label><input type="text" value="${escapeHtml(s.monthly)}" oninput="updateSelected(${jsArg(s.key)},'monthly',this.value)"></div>
          </div>
          <div class="field-row">
            <div><label>Net Effective</label><input type="text" value="${escapeHtml(s.netEff)}" placeholder="e.g., 5765" oninput="updateSelected(${jsArg(s.key)},'netEff',this.value)"></div>
            <div><label>Availability</label><input type="text" value="${escapeHtml(s.avail)}" oninput="updateSelected(${jsArg(s.key)},'avail',this.value)"></div>
          </div>
          <div class="field">
            <label>Incentive / Concession</label>
            <input type="text" value="${escapeHtml(s.incentive)}" placeholder="e.g., 1 month free OR 1 month OP" oninput="updateSelected(${jsArg(s.key)},'incentive',this.value)">
          </div>
          <div class="field" style="background:rgba(90,58,92,0.05); padding:10px; border-left:2px solid var(--accent); margin-bottom:10px;">${otherConcessionHtml(s)}</div>
        ` : `
          <div class="field-row">
            <div><label>Monthly Rent</label><input type="text" value="${escapeHtml(s.monthly)}" oninput="updateSelected(${jsArg(s.key)},'monthly',this.value)"></div>
            <div><label>Availability</label><input type="text" value="${escapeHtml(s.avail)}" oninput="updateSelected(${jsArg(s.key)},'avail',this.value)"></div>
          </div>
          <div class="field" style="background:rgba(90,58,92,0.05); padding:10px; border-left:2px solid var(--accent); margin-bottom:10px;">
            <label style="margin-bottom:4px;">Concession from showsheet</label>
            <div style="font-size:12px; font-weight:600; color:${hasIncentive ? 'var(--accent)' : 'var(--ink-soft)'}; margin-bottom:8px;">${hasIncentive ? escapeHtml(s.incentive) : 'No incentives'}</div>
            ${s.noBroker && opOnlyOffer(s.incentive) ? `<div class="queue-note" style="margin:-4px 0 8px;">Only an OP, and this email isn't to a broker, so the email leaves the concession out. Turn on “Sending to a broker” above to quote it.</div>` : ''}
            ${hasIncentive ? `
            <div class="checkbox-row">
              <label class="cbx"><input type="checkbox" ${s.showNetEff?'checked':''} ${(!hasNetEff || (s.opOnly && hasOrInIncentive))?'disabled':''} onchange="toggleSelectedFlag(${jsArg(s.key)},'showNetEff')"> <span>Show Net Effective Rent${!hasNetEff?' (no NE on showsheet)':(s.opOnly && hasOrInIncentive ? ' (N/A — broker is taking OP instead of free month)' : '')}</span></label>
              ${selectorMode(s) ? '' : hasAndInIncentive ? `
              <label class="cbx"><input type="checkbox" ${s.noBroker?'checked':''} onchange="toggleSelectedFlag(${jsArg(s.key)},'noBroker')"> <span>No broker — hide the OP part (uncheck if a broker brought them)</span></label>
              ` : `
              <label class="cbx"><input type="checkbox" ${s.opOnly && hasOrInIncentive?'checked':''} ${!hasOrInIncentive?'disabled':''} onchange="toggleSelectedFlag(${jsArg(s.key)},'opOnly')"> <span>OP only${!hasOrInIncentive?' (only applies to OR-style concessions)':' — broker came in with prospect'}</span></label>
              `}
            </div>
            ` : ''}
            ${otherConcessionHtml(s)}
          </div>
        `}
        <div class="field">
          <label class="cbx" style="margin-bottom: 8px;"><input type="checkbox" ${s.addFloorPlan?'checked':''} onchange="toggleSelectedFlag(${jsArg(s.key)},'addFloorPlan')"> <span><strong>Add floor plan link</strong></span></label>
          ${s.addFloorPlan ? `
            <label>Floor Plan Link ${fpBadge}</label>
            <input type="text" class="fp-input" data-key="${escapeHtml(s.key)}" value="${escapeHtml(s.floorPlan)}" placeholder="https://..." oninput="updateSelected(${jsArg(s.key)},'floorPlan',this.value)">
            ${s.custom ? `<div class="fp-status" data-key="${escapeHtml(s.key)}" style="font-size:var(--fs-sm); margin-top:4px; color:${/^✓/.test(fpStatusText(s)) ? 'var(--green)' : 'var(--ink-soft)'};">${escapeHtml(fpStatusText(s))}</div>` : ''}
          ` : ''}
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Notes for prospect (optional)</label>
          <textarea placeholder="e.g., You loved the view from this apartment" oninput="updateSelected(${jsArg(s.key)},'notes',this.value)">${escapeHtml(s.notes)}</textarea>
        </div>
        ${s.custom ? '' : `<div class="remove-link"><button class="tiny ghost danger" onclick="removeSelected(${jsArg(s.key)})">Remove from email</button></div>`}
      </div>
    </div>`;
    return html;
}
