// Picking units for a tour: the picker list, each unit's quote editor, Undo, and units not on the showsheet.
import { escapeHtml as esc, jsArg } from '../../shared/html.js';
import { FREE_OPTS, money, OP_OPTS, parseIncentive } from '../../shared/pricing.js';
import { typeSelectHtml, viewSelectHtml } from '../../shared/unit-options.js';
import { FILTERS, passes, render } from './availability-list.js';
import { BUILDING_ORDER } from './buildings.js';
import { bldgTitle, bnum, normUnit, stopKey } from './format.js';
import { data } from './showsheet-feed.js';
import { state } from './state.js';
import { newTour, renderTour, saveTourLocal, scheduleSave, toggleGuest } from './tour-planner.js';
import { quoteHtml, renderTourExtras } from './tour-summary.js';
import { $ } from './ui.js';

export function toggleStop(key) {
  if (!state.tour.active) newTour();
  if (state.tour.guestOpen !== false && state.tour.kind !== 'inspection' && !state.tour.stops.length && state.tour.prospect) { state.tour.guestOpen = false; setTimeout(() => toggleGuest(false), 0); }
  const i = state.tour.stops.findIndex(s => s.key === key);
  if (i >= 0) offerUndo(state.tour.stops.splice(i, 1)[0], i);
  else {
    const u = (data && data.units || []).find(x => stopKey(x) === key);
    if (!u) return;
    state.tour.stops.push({ key, building: u.building, unit: u.unit, type: u.type, sqft: u.sqft, view: u.view, direction: u.direction,
      monthly: u.monthly, netEff: u.netEff, incentive: u.incentive, avail: u.avail, hasApp: !!u.hasApp,
      rent: '', free: 0, term: 12, op: 0, opMode: 'or', credit: '', notes: '', collapsed: false, isNew: true });
  }
  saveTourLocal(); render(); renderTour(); renderPicker(); scheduleSave();
}
var lastRemoved = null, undoTimer = null;
function offerUndo(stop, index) {
  lastRemoved = { stop: JSON.parse(JSON.stringify(stop)), index, tourId: state.tour.id };
  const bar = $('undoBar'); if (!bar) return;
  bar.innerHTML = `<span class="t">#${esc(stop.unit)} removed from this tour.</span><button class="btn sec" onclick="undoRemoveStop()">Undo</button>`;
  bar.style.display = '';
  clearTimeout(undoTimer); undoTimer = setTimeout(hideUndo, 6000);
}
export function hideUndo() { lastRemoved = null; const bar = $('undoBar'); if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; } }
export function undoRemoveStop() {
  const r = lastRemoved; if (!r || r.tourId !== state.tour.id || state.tour.stops.some(x => x.key === r.stop.key)) { hideUndo(); return; }
  state.tour.stops.splice(Math.min(r.index, state.tour.stops.length), 0, Object.assign(r.stop, { collapsed: false, isNew: true }));
  hideUndo(); saveTourLocal(); render(); renderTour(); renderPicker(); scheduleSave();
}
export function toggleStopCollapse(key) {
  const s = state.tour.stops.find(x => x.key === key); if (!s) return;
  s.collapsed = !s.collapsed; saveTourLocal();
  const ed = document.querySelector(`.pick-editor[data-stopkey="${CSS.escape(key)}"]`);
  const chev = document.querySelector(`.pick-added[data-key="${CSS.escape(key)}"] .pick-chevron`);
  if (ed) ed.classList.toggle('open', !s.collapsed);
  if (chev) chev.classList.toggle('open', !s.collapsed);
  const row = document.querySelector(`.pick-added[data-key="${CSS.escape(key)}"] .pick`); if (row) row.setAttribute('aria-expanded', String(!s.collapsed));
}
export function updStop(key, field, val) {
  const s = state.tour.stops.find(x => x.key === key); if (!s) return;
  if (field === 'rent') { const n = parseFloat(String(val).replace(/[^0-9.]/g,'')) || 0; val = (n && s.monthly && Math.round(n) === Math.round(Number(s.monthly))) ? '' : val; }
  s[field] = val; saveTourLocal();
  const q = document.querySelector(`.pick-editor[data-stopkey="${CSS.escape(key)}"] .stop-quote`);
  if (q) q.innerHTML = quoteHtml(s);
  const price = document.querySelector(`.pick-added[data-key="${CSS.escape(key)}"] .pp`);
  if (price && field === 'rent') { const chev = price.querySelector('.pick-chevron'); price.innerHTML = money(val || s.monthly) + (chev ? chev.outerHTML : ''); }
  scheduleSave();
}
// One picked unit: the row (tap to expand/collapse) plus its inline quote + edit fields.
function stopCardHtml(s) {
  const k = esc(s.key);
  const open = !s.collapsed && !s.isNew;   // new ones render closed, then slide open (see renderPicker)
  const rentVal = s.rent || (s.monthly ? String(Math.round(Number(s.monthly))) : '');
  return `<div class="pick-added" data-key="${k}">
    <div class="pick in ${s.hasApp?'app':''}" role="button" tabindex="0" aria-expanded="${open||!!s.isNew}" aria-label="#${esc(s.unit)} — show or hide the quote" onclick="toggleStopCollapse(${jsArg(s.key)})">
      <div class="cb" role="checkbox" aria-checked="true" tabindex="0" aria-label="Remove #${esc(s.unit)} from the tour" onclick="event.stopPropagation(); toggleStop(${jsArg(s.key)})" title="Remove from tour"><span>✓</span></div>
      <div class="pu">#${esc(s.unit)}</div>
      <div><div class="pt">${esc(s.type)}${s.sqft ? ` · ${esc(s.sqft)} sf` : ''}${s.custom ? ' <span class="tag" style="vertical-align:middle;">Not on showsheet</span>' : ''}</div><div class="pv">${esc([s.view, s.incentive && !/^no incentives?$/i.test(s.incentive) ? s.incentive : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="pp">${money(s.rent || s.monthly)}<span class="pick-chevron ${open||s.isNew?'open':''}">&#9662;</span></div>
    </div>
    <div class="pick-editor ${open?'open':''}" data-stopkey="${k}"><div>
      <div class="stop-quote">${quoteHtml(s)}</div>
      <div class="stop-edit${state.tour.broker ? ' has-op' : ''}">
        <div class="f"><label>Rent <span style="font-weight:400; text-transform:none;">(showsheet ${esc(money(s.monthly))})</span></label><input type="text" inputmode="decimal" value="${esc(rentVal)}" oninput="updStop(${jsArg(s.key)},'rent',this.value)"></div>
        <div class="f"><label>Concession to prospect</label><select onchange="updStop(${jsArg(s.key)},'free',this.value)">${FREE_OPTS.map(([v,l]) => `<option value="${v}" ${Number(s.free)===v?'selected':''}>${v===0 ? (parseIncentive(s.incentive).conc ? 'Showsheet: ' + esc(parseIncentive(s.incentive).conc) : 'Showsheet: none') : l}</option>`).join('')}</select></div>
        ${state.tour.broker ? `<div class="f"><label>OP to broker</label><select onchange="updStop(${jsArg(s.key)},'op',this.value)">${OP_OPTS.map(([v,l]) => `<option value="${v}" ${Number(s.op)===v?'selected':''}>${v===0 ? (parseIncentive(s.incentive).opText ? 'Showsheet: ' + esc(parseIncentive(s.incentive).opText) : 'Showsheet: none') : l}</option>`).join('')}</select></div>` : ''}
        <div class="f"><label>Credit ($)</label><input type="text" inputmode="decimal" value="${esc(s.credit)}" placeholder="0" oninput="updStop(${jsArg(s.key)},'credit',this.value)"></div>
        <div class="f" style="grid-column:1 / -1;"><label>Notes for the follow-up</label><input type="text" value="${esc(s.notes)}" placeholder="e.g., loved the view" oninput="updStop(${jsArg(s.key)},'notes',this.value)"></div>
      </div>
      <button class="stop-remove" onclick="toggleStop(${jsArg(s.key)})">Remove from tour</button>
    </div></div>
  </div>`;
}
// ---------- Unit picker inside the Tour Planner ----------
export function renderPickChips() { $('pickChips').innerHTML = FILTERS.filter(([k]) => k !== 'fp').map(([k,l]) => `<button class="chip ${state.pickFilter===k?'on':''}" aria-pressed="${state.pickFilter===k}" onclick="pickFilter='${k}'; renderPickChips(); renderPicker()">${l}</button>`).join(''); }
function pickRowHtml(u) {
  const k = stopKey(u);
  const ne = u.netEff && Number(u.netEff) && Number(u.netEff) !== Number(u.monthly) ? `<small>Net ${money(u.netEff)}</small>` : '';
  return `<div class="pick ${u.hasApp?'app':''}" role="checkbox" aria-checked="false" tabindex="0" aria-label="Add #${esc(u.unit)} to the tour" onclick="toggleStop(${jsArg(k)})">
      <div class="cb"><span></span></div>
      <div class="pu">#${esc(u.unit)}</div>
      <div><div class="pt">${esc(u.type)}${u.sqft ? ` · ${esc(u.sqft)} sf` : ''}</div><div class="pv">${esc([u.view, u.incentive && !/^no incentives?$/i.test(u.incentive) ? u.incentive : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="pp">${money(u.monthly)}${ne}</div>
    </div>`;
}
// One list: checking a unit slides its editor open right under that row; custom units sit at the end.
export function renderPicker() {
  const box = $('pickerList'); if (!box) return;
  if (!data) { box.innerHTML = '<div class="empty">Waiting for the showsheet…</div>'; return; }
  $('pickerCount').textContent = state.tour.stops.length ? `${state.tour.stops.length} selected` : '';
  const q = ($('pickSearch').value || '').toLowerCase().trim();
  const saved = state.filter; state.filter = state.pickFilter;
  const list = (data.units || []).filter(u => passes(u, q));
  state.filter = saved;
  let html = '';
  if (!list.length) html += '<div class="empty">No units match.</div>';
  else {
    const byB = {}; list.forEach(u => { (byB[u.building] = byB[u.building] || []).push(u); });
    const bKeys = Object.keys(byB).sort((a,b) => { const ia = BUILDING_ORDER.indexOf(bnum(a)), ib = BUILDING_ORDER.indexOf(bnum(b)); return (ia<0?99:ia) - (ib<0?99:ib); });
    html += bKeys.map(b => `<div class="pick-b">${esc(bldgTitle(b))}</div>` + byB[b].map(u => {
      const st = state.tour.stops.find(x => x.key === stopKey(u));
      return st ? stopCardHtml(st) : pickRowHtml(u);
    }).join('')).join('');
  }
  const customs = state.tour.stops.filter(st => st.custom);
  if (customs.length) html += `<div class="pick-b">Not on the showsheet</div>` + customs.map(stopCardHtml).join('');
  box.innerHTML = html;
  // Slide newly checked units open
  requestAnimationFrame(() => {
    state.tour.stops.forEach(st => {
      if (st.isNew) {
        const ed = document.querySelector(`.pick-editor[data-stopkey="${CSS.escape(st.key)}"]`);
        if (ed) ed.classList.add('open');
        st.isNew = false;
      }
    });
  });
  renderTourExtras();
}
export function toggleCustomForm() {
  const sel = $('cuView'); if (sel && !sel.options.length) sel.outerHTML = viewSelectHtml('', '', esc, 'cuView');
  const ts = $('cuType'); if (ts && !ts.options.length) ts.outerHTML = typeSelectHtml('', '', esc, 'cuType');
  const f = $('customForm'); const open = f.style.display === 'none';
  f.style.display = open ? '' : 'none'; $('cuMsg').textContent = ''; $('cuMsg').className = 'savemsg';
  if (open) $('cuUnit').focus();
}
export function addCustomStop() {
  const building = $('cuBldg').value, unit = $('cuUnit').value.trim(), type = $('cuType').value.trim();
  const rent = parseFloat(($('cuRent').value || '').replace(/[^0-9.]/g,'')) || 0;
  if (!unit) { $('cuMsg').textContent = '⚠ ' + 'Enter the unit number.'; $('cuMsg').className = 'savemsg err'; $('cuUnit').focus(); return; }
  if (!type) { $('cuMsg').textContent = '⚠ ' + 'Enter the unit type.'; $('cuMsg').className = 'savemsg err'; $('cuType').focus(); return; }
  if (!rent) { $('cuMsg').textContent = '⚠ ' + 'Enter the monthly rent.'; $('cuMsg').className = 'savemsg err'; $('cuRent').focus(); return; }
  const key = `${bnum(building)}|${normUnit(unit)}`;
  if (state.tour.stops.some(st => st.key === key)) { $('cuMsg').textContent = '⚠ ' + `#${unit} is already on this tour.`; $('cuMsg').className = 'savemsg err'; return; }
  state.tour.stops.push({ key, custom: true, building, unit, type, sqft: $('cuSqft').value.trim(), view: $('cuView').value.trim(), direction: '',
    monthly: Math.round(rent), netEff: '', incentive: $('cuInc').value.trim(), avail: 'Immediately',
    rent: '', free: 0, term: 12, op: 0, opMode: 'or', credit: '', notes: '', collapsed: false, isNew: true });
  saveTourLocal(); render(); renderTour(); renderPicker(); scheduleSave();
  ['cuUnit','cuType','cuRent','cuSqft','cuView','cuInc'].forEach(id => { $(id).value = ''; });
  $('customForm').style.display = 'none';
}
