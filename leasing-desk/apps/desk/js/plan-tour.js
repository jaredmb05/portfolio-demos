// Plan a tour or inspection, send it to the queue, and pick its units in the Email Builder.
import { prefersReducedMotion } from '../../shared/dom.js';
import { escapeHtml } from '../../shared/html.js';
import { leaseTerm } from '../../shared/pricing.js';
import { team } from '../../shared/team.js';
import { BED_OPTIONS, profileSummary } from '../../shared/unit-options.js';
import { renderPreview, setMode } from './email-builder.js';
import { fbDb } from './firebase.js';
import { confirmBusyStart, renderTourQueue } from './queue.js';
import { selectionFromStop } from './rules/tour-selection.js';
import { state } from './state.js';
import { clickedButton, toast, withBusy } from './ui.js';
import { activeQuickFilter, renderUnitList, setQuickFilter, syncEmailBrokerUi } from './unit-list.js';
import { bldgNum, normUnit, unitSelectKey } from './units.js';

export function applyTour(id, rows) {
  const r = (rows || []).find(x => x.id === id); if (!r) return;
  if (state.emailMode !== 'tour') setMode('tour');
  state.emailBroker = !!r.broker; syncEmailBrokerUi();
  state.selectedUnits = [];
  (r.stops || []).forEach(st => {
    const live = state.units.find(u => bldgNum(u.building) === bldgNum(st.building) && normUnit(u.unit) === normUnit(st.unit));
    state.selectedUnits.push(selectionFromStop(st, live, { broker: r.broker, floorPlans: state.floorPlans, now: Date.now() }));
  });
  const pn = document.getElementById('prospectName'); if (pn && r.prospectFirst) pn.value = r.prospectFirst;
  state.activeTour = { id: r.id, kind: r.kind || 'tour', stops: r.stops || [], assistant: r.assistant, prospect: r.prospect, prospectFirst: r.prospectFirst || '', prospectInitial: r.prospectInitial || '', prospectEmail: r.prospectEmail || '', broker: !!r.broker, brokerLast: r.brokerLast || '', brokerFirst: r.brokerFirst || '', profile: r.profile || null, status: r.finishedAtIso ? 'finished' : r.startedAtIso ? 'started' : r.queuedAtIso ? 'waiting' : 'planning' };
  renderUnitList(); renderPreview(); renderTourQueue(); renderPlanStrip();
  const bk = r.broker ? ` · broker ${[r.brokerFirst, r.brokerLast].filter(Boolean).join(' ')}`.trimEnd() : '';
  toast(`Opened tour: ${r.assistant || 'unassigned'} / ${r.prospect}${bk} — ${state.selectedUnits.length} unit${state.selectedUnits.length===1?'':'s'}`);
  const strip = document.getElementById('planStrip'); if (strip && strip.scrollIntoView) strip.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
let planKind = 'tour';
export function setPlanKind(k) {
  planKind = k;
  const insp = k === 'inspection';
  document.getElementById('planKindTour').classList.toggle('active', !insp);
  document.getElementById('planKindInsp').classList.toggle('active', insp);
  document.getElementById('planProspectLabel').textContent = insp ? 'Resident first name' : 'Prospect first name';
  document.getElementById('planInspRow').style.display = insp ? '' : 'none';
  document.getElementById('planTourFields').style.display = insp ? 'none' : '';
  document.getElementById('planSubmitPick').style.display = (insp || (state.activeTour && state.activeTour.id)) ? 'none' : '';
  document.getElementById('planStartNow').style.display = (state.activeTour && state.activeTour.id) ? 'none' : '';
  document.getElementById('planStartNow').textContent = insp ? 'Start inspection now' : 'Start tour now';
  document.getElementById('planSubmit').textContent = (state.activeTour && state.activeTour.id) ? 'Save changes' : (insp ? 'Add inspection to queue' : 'Send to queue');
  document.getElementById('planUnitsNote').textContent = insp
    ? 'The resident wants to see their unit. It waits in the queue until an assistant is assigned and starts it.'
    : (state.selectedUnits.length ? `Units: ${state.selectedUnits.map(s => '#' + s.unit).join(', ')} (from the Email Builder selection).` : 'Units are optional here — pick them now, later from this screen, or on the iPad by whoever takes the tour.');
}
export function openPlanTour() {
  const m = document.getElementById('planModal'); m.classList.add('show');
  const a = state.activeTour || {}; const pr = a.profile || {};
  document.getElementById('planTitle').textContent = a.id ? (a.kind === 'inspection' ? 'Update inspection' : 'Update tour') : 'Plan a tour';
  document.getElementById('planKindRow').style.display = a.id ? 'none' : '';
  document.getElementById('planInspBldg').value = (a.stops && a.stops[0] && a.stops[0].building) || '2050 TIDEMARK BLVD';
  document.getElementById('planInspUnit').value = (a.kind === 'inspection' && a.stops && a.stops[0] && a.stops[0].unit) || '';
  setPlanKind(a.id ? (a.kind === 'inspection' ? 'inspection' : 'tour') : 'tour');
  document.getElementById('planProspect').value = a.prospectInitial || '';
  document.getElementById('planFirst').value = a.prospectFirst || '';
  document.getElementById('planEmail').value = a.prospectEmail || '';
  document.getElementById('planAssistant').innerHTML = `<option value="">Unassigned — any assistant can take it</option>` + team.assistants.map(n => `<option value="${escapeHtml(n)}" ${n === a.assistant ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
  document.getElementById('planBroker').checked = !!a.broker; document.getElementById('planBrokerRow').style.display = a.broker ? '' : 'none';
  document.getElementById('planBrokerLast').value = a.brokerLast || ''; document.getElementById('planBrokerFirst').value = a.brokerFirst || '';
  const beds = pr.beds || [];
  document.getElementById('planBeds').innerHTML = BED_OPTIONS.map(b => `<label class="cbx" style="border:1px solid var(--line); padding:6px 10px;"><input type="checkbox" value="${b}" ${beds.includes(b) ? 'checked' : ''}> <span>${b}</span></label>`).join('');
  document.getElementById('planMin').value = pr.priceMin || ''; document.getElementById('planMax').value = pr.priceMax || '';
  document.getElementById('planMoveIn').value = pr.moveIn || ''; document.getElementById('planFlex').checked = !!pr.flexible;
  document.getElementById('planNotes').value = pr.mustHaves || '';
  document.getElementById('planFirst').focus();
}
function readPlanProfile() {
  return {
    beds: [...document.querySelectorAll('#planBeds input:checked')].map(i => i.value),
    priceMin: parseInt(String(document.getElementById('planMin').value).replace(/[^0-9]/g,''), 10) || null,
    priceMax: parseInt(String(document.getElementById('planMax').value).replace(/[^0-9]/g,''), 10) || null,
    moveIn: document.getElementById('planMoveIn').value || '',
    flexible: document.getElementById('planFlex').checked,
    mustHaves: document.getElementById('planNotes').value.trim()
  };
}
function stopsFromSelection() {
  return state.selectedUnits.map(s => {
    const live = s.custom ? null : state.units.find(u => unitSelectKey(u) === s.key);
    const liveRent = live ? String(live.monthly || '') : '';
    return {
      key: `${bldgNum(s.building)}|${normUnit(s.unit)}`, building: s.building, unit: String(s.unit), type: s.type, sqft: s.sqft, view: s.view,
      monthly: live ? live.monthly : s.monthly, netEff: s.netEff, incentive: s.incentive, avail: s.avail, custom: !!s.custom,
      rent: (!live || String(s.monthly || '') !== liveRent) ? String(s.monthly || '') : '',
      free: s.otherConc ? (parseFloat(s.otherFree) || 0) : 0, term: parseInt(s.otherTerm, 10) || leaseTerm(s.incentive),
      op: s.otherConc ? (s.otherOp === 'custom' ? 0 : parseFloat(s.otherOp) || 0) : 0, opMode: s.otherOpMode === 'and' ? 'and' : 'or',
      credit: s.otherConc ? String(s.otherCredit || '') : '', notes: s.notes || ''
    };
  });
}
export async function submitPlanTour(pickNow, startNow) {
  const btn = clickedButton();
  if (btn && btn.disabled) return;
  const db = fbDb(); if (!db) { toast('The database didn’t load — check the connection and reload the page.', true); return; }
  const prospectFirst = document.getElementById('planFirst').value.trim();
  const prospectInitial = document.getElementById('planProspect').value.trim().replace(/\.$/, '').toUpperCase();
  if (!prospectFirst) { toast("First name is required", true); document.getElementById('planFirst').focus(); return; }
  const prospect = prospectInitial ? `${prospectFirst} ${prospectInitial}.` : prospectFirst;   // display name used everywhere
  const prospectEmail = document.getElementById('planEmail').value.trim();
  const assistant = document.getElementById('planAssistant').value || '';
  const broker = document.getElementById('planBroker').checked;
  const brokerLast = broker ? document.getElementById('planBrokerLast').value.trim() : '', brokerFirst = broker ? document.getElementById('planBrokerFirst').value.trim() : '';
  if (broker && !brokerLast) { toast("Broker's last name is required", true); return; }
  const insp = planKind === 'inspection';
  let profile = null, stops;
  if (insp) {
    const bldg = document.getElementById('planInspBldg').value, unit = document.getElementById('planInspUnit').value.trim();
    if (!unit) { toast('Enter the unit number', true); document.getElementById('planInspUnit').focus(); return; }
    stops = [{ key: `${bldgNum(bldg)}|${normUnit(unit)}`, building: bldg, unit, type: 'Inspection', custom: true }];
  } else { profile = readPlanProfile(); stops = stopsFromSelection(); }
  if (startNow && !assistant) { toast('Pick the leasing assistant to start now, or send it to the queue', true); document.getElementById('planAssistant').focus(); return; }
  if (startNow && !insp && !stops.length) { toast('Select the units in the Email Builder first to start a tour now', true); return; }
  if (startNow && !confirmBusyStart(assistant, prospect, state.activeTour && state.activeTour.id)) return;
  const now = new Date().toISOString();
  const existing = state.activeTour && state.activeTour.id;
  const id = existing || `${prospect}-${Date.now().toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '_');
  const doc = existing
    ? (insp ? { id, assistant, prospect, prospectFirst, prospectInitial, prospectEmail, stops, updatedAtIso: now } : { id, assistant, prospect, prospectFirst, prospectInitial, prospectEmail, broker, brokerLast, brokerFirst, profile, stops, updatedAtIso: now })
    : { id, kind: insp ? 'inspection' : 'tour', assistant, prospect, prospectFirst, prospectInitial, prospectEmail, broker: insp ? false : broker, brokerLast: insp ? '' : brokerLast, brokerFirst: insp ? '' : brokerFirst, profile, stops, source: 'toolkit', createdAtIso: now, queuedAtIso: now, updatedAtIso: now, startedAtIso: startNow ? now : null, finishedAtIso: null };
  if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
  try {
    await db.collection('tours').doc(id).set(JSON.parse(JSON.stringify(doc)), { merge: true });
    state.activeTour = Object.assign(state.activeTour || {}, { id, kind: insp ? 'inspection' : 'tour', assistant, prospect, prospectFirst, prospectInitial, broker, brokerLast, brokerFirst, profile, stops, status: (state.activeTour && state.activeTour.status) || 'waiting' });
    document.getElementById('planModal').classList.remove('show');
    toast(existing ? `Updated ${insp ? 'inspection' : 'tour'} for ${prospect}` : startNow ? `${prospect}'s ${insp ? 'inspection' : 'tour'} started · ${assistant}` : `${prospect}'s ${insp ? 'inspection' : 'tour'} is waiting in the Tour Queue${assistant ? ' · ' + assistant : ''}`);
    if (insp) { state.activeTour = null; renderPlanStrip(); const q = document.getElementById('queuePanel'); if (q) { q.classList.add('open'); renderTourQueue(); } }
    else if (!existing && pickNow) {
      if (state.emailMode !== 'tour') setMode('tour');
      state.emailBroker = !!broker; syncEmailBrokerUi();
      renderPlanStrip();
      const strip = document.getElementById('planStrip'); if (strip && strip.scrollIntoView) strip.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(`${prospect} is in the queue — select the units below, then Save units to tour`);
    } else if (!existing) { state.activeTour = null; renderPlanStrip(); }
    else renderPlanStrip();
  } catch (e) { console.error(e); toast('Not saved — ' + (e.message || e) + '. Check the connection and try again.', true); }
  finally { if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); } }
}
export function renderPlanStrip() {
  const el = document.getElementById('planStrip'); if (!el) return;
  const picking = !!(state.activeTour && state.activeTour.id && state.activeTour.kind !== 'inspection' && state.activeTour.status !== 'finished');
  const wasPicking = document.body.classList.contains('picking');
  document.body.classList.toggle('picking', picking);
  const crit = state.activeTour && state.activeTour.profile; const hasCrit = !!(crit && ((crit.beds && crit.beds.length) || crit.priceMin || crit.priceMax));
  const fitsBtn = document.getElementById('qfFits');
  if (fitsBtn) {
    fitsBtn.style.display = hasCrit ? '' : 'none';
    if (picking && !wasPicking && hasCrit) setQuickFilter('fits', fitsBtn);                 // start picking with matches shown
    else if (!hasCrit && activeQuickFilter === 'fits') setQuickFilter('all', document.querySelector('.qf-btn[data-filter="all"]'));
  }
  if (!state.activeTour || !state.activeTour.id) { el.style.display = 'none'; return; }
  el.style.display = '';
  const st = state.activeTour.status || 'planning';
  document.getElementById('planStripTitle').textContent = `${st === 'started' ? 'Tour in progress' : st === 'finished' ? 'Finished tour' : 'Planning tour'} for ${state.activeTour.prospect}${state.activeTour.assistant ? ' · ' + state.activeTour.assistant : ' · unassigned'}`;
  const pr = profileSummary(state.activeTour.profile);
  document.getElementById('planStripSub').textContent = (pr ? pr + ' · ' : '') + (state.selectedUnits.length ? `${state.selectedUnits.length} unit${state.selectedUnits.length===1?'':'s'} selected below` : 'no units selected yet — pick them below, then Save units to tour');
}
export function clearActiveTour() { state.activeTour = null; renderPlanStrip(); renderTourQueue(); }
export async function saveUnitsToTour() {
  const btn = clickedButton();
  if (!state.activeTour || !state.activeTour.id) return;
  if (!state.selectedUnits.length) { toast('Select at least one unit below first', true); return; }
  const db = fbDb(); if (!db) return;
  await withBusy(btn, 'Saving…', async () => { try {
    await db.collection('tours').doc(state.activeTour.id).set({ stops: JSON.parse(JSON.stringify(stopsFromSelection())), updatedAtIso: new Date().toISOString() }, { merge: true });
    const who = state.activeTour.prospect;
    toast(`${who}'s tour is waiting in the Tour Queue`);
    state.activeTour = null; state.selectedUnits = []; renderUnitList(); renderPreview(); renderPlanStrip(); renderTourQueue();
    const q = document.getElementById('queuePanel'); if (q) { q.classList.add('open'); renderTourQueue(); if (q.scrollIntoView) q.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }); }
  } catch (e) { console.error(e); toast('Not saved — ' + (e.message || e) + '. Check the connection and try again.', true); } });
}
