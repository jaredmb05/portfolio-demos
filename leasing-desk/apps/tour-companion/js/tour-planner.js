// Tour Planner: the open tour or inspection, its details card and status (planning → waiting → started → finished).
import { clockTime, isTodayIso } from '../../shared/dates.js';
import { escapeHtml as esc, jsArg } from '../../shared/html.js';
import { BROKER_NOTE } from '../../shared/pricing.js';
import { team } from '../../shared/team.js';
import { BED_OPTIONS, profileSummary } from '../../shared/unit-options.js';
import { render } from './availability-list.js';
import { bnum, normUnit, stopKey } from './format.js';
import { renderAssistantSelect } from './staff.js';
import { state } from './state.js';
import { renderQueue } from './todays-tours.js';
import { renderSummary, renderTourExtras } from './tour-summary.js';
import { saveTour } from './tour-sync.js';
import { $, homeNote, needField, setMsg, toast } from './ui.js';
import { hideUndo, renderPicker } from './unit-picker.js';

// ---------- Tour state ----------
let saveTimer = null;
export const inTour = u => state.tour.stops.some(s => s.key === stopKey(u));

export function saveTourLocal() { try { localStorage.setItem('tour_current', JSON.stringify(state.tour)); } catch (e) {} }
export function loadTourLocal() {
  try { const t = JSON.parse(localStorage.getItem('tour_current') || 'null'); if (t && t.stops) state.tour = t; } catch (e) {}
  if (state.tour.active && state.tour.createdAtIso && !isTodayIso(state.tour.createdAtIso)) { state.tour.active = false; saveTourLocal(); }   // a new day starts on the Tour Planner home
  showTourView();
}
export function showTourView() {
  $('tourHome').style.display = state.tour.active ? 'none' : '';
  $('tourActive').style.display = state.tour.active ? '' : 'none';
  if (state.tour.active) {
    const isInsp = state.tour.kind === 'inspection';
    renderAssistantSelect(); $('tProspect').value = state.tour.prospectInitial || ''; $('tFirst').value = state.tour.prospectFirst || ''; $('tEmail').value = state.tour.prospectEmail || '';
    $('prospectLabel').textContent = isInsp ? 'Resident first name' : 'Prospect first name';
    $('guestTitle').textContent = isInsp ? (state.tour.startedAtIso ? 'Inspection details' : 'New inspection') : (state.tour.queuedAtIso || state.tour.startedAtIso ? 'Tour details' : 'New tour');
    $('insFields').style.display = isInsp ? '' : 'none';
    if (isInsp) { $('insBldg').value = (state.tour.stops[0] && state.tour.stops[0].building) || '2050 TIDEMARK BLVD'; $('insUnit').value = (state.tour.stops[0] && state.tour.stops[0].unit) || ''; }
    $('brokerToggleRow').style.display = isInsp ? 'none' : '';
    $('needsBlock').style.display = isInsp ? 'none' : ''; if (!isInsp) fillNeeds();
    $('tBroker').checked = !!state.tour.broker; $('tBrokerLast').value = state.tour.brokerLast || ''; $('tBrokerFirst').value = state.tour.brokerFirst || '';
    if (isInsp) $('brokerFields').style.display = 'none';
    const status = tourStatus(state.tour);
    const summaryMode = !isInsp && status !== 'planning' && !state.tour.editing && state.tour.stops.length > 0;   // a queued tour with no units yet opens straight into the picker
    $('tourWorkArea').style.display = (isInsp || summaryMode) ? 'none' : '';
    $('tourSummary').style.display = summaryMode ? '' : 'none';
    $('tourExtras').style.display = isInsp ? 'none' : '';
    $('tEdit').style.display = (summaryMode && status !== 'finished') ? '' : 'none';
    // Start: shown while planning/waiting (or editing); blocked until an assistant is picked. Send to queue: planning only. Finish: started.
    const showStart = state.tour.editing || status === 'planning' || status === 'waiting';
    $('tStart').style.display = showStart ? '' : 'none';
    $('tStart').disabled = !state.tour.editing && !state.tour.assistant;
    $('tStart').textContent = state.tour.editing ? 'Done editing' : (isInsp ? 'Start inspection' : 'Start tour');
    $('tQueue').style.display = (status === 'planning' && !state.tour.editing) ? '' : 'none';
    $('tFinish').style.display = (status === 'started' && !state.tour.editing) ? '' : 'none';
    $('tFinish').textContent = isInsp ? 'Finish inspection' : 'Finish tour';
    renderTour(); renderPicker(); if (summaryMode) renderSummary();
    // Guest card: open for new entries and inspections and summary mode; collapsed once units are being picked
    // Started tours show the summary with the details folded into one line; tap the bar to edit.
    const inspStarted = isInsp && !!state.tour.startedAtIso && !state.tour.editing;
    const open = inspStarted ? state.tour.guestOpen === true : (isInsp || (summaryMode ? state.tour.guestOpen === true : state.tour.guestOpen !== false));
    $('emailField').style.display = isInsp ? 'none' : '';
    $('guestCard').style.display = open ? '' : 'none'; $('guestBar').style.display = open ? 'none' : '';
    $('guestDoneRow').style.display = (isInsp && !inspStarted) ? 'none' : '';
    $('guestDoneBtn').textContent = summaryMode ? 'Done' : 'Done — pick units ↓';
    if (!open) toggleGuest(false, true);
    renderTakeRow();
  }
  renderQueue();
}
// "Who's taking Karen?" — while a tour or inspection has no assistant, name buttons sit in the action bar next to Start
// (people in today, suggested next first). Tapping one is the same as choosing them in the details card.
export function renderTakeRow() {
  const row = $('takeRow'); if (!row) return;
  const st = tourStatus(state.tour);
  const show = state.tour.active && !state.tour.assistant && !state.tour.editing && (st === 'planning' || st === 'waiting');
  row.style.display = show ? '' : 'none'; if (!show) { row.innerHTML = ''; return; }
  const names = team.assistants.slice().sort((a, b) => a.localeCompare(b));   // the whole team A to Z; who's in or busy is the Desk's job (D20)
  row.innerHTML = `<span class="t">Who's taking ${esc(state.tour.prospectFirst || (state.tour.kind === 'inspection' ? 'this inspection' : 'this tour'))}?</span>` +
    names.map(n => `<button class="chip" onclick='takeTour(${jsArg(n)})'>${esc(n)}</button>`).join('');
}
export function takeTour(name) {
  const sel = $('tAssistant'); if (!sel) return;
  if (![...sel.options].some(o => o.value === name)) renderAssistantSelect();
  sel.value = name; tourChanged(); renderTakeRow();
  setMsg(`${name} is taking it — tap Start ${state.tour.kind === 'inspection' ? 'inspection' : 'tour'} when you begin.`, 'busy');
}
export function editTour() {
  if (state.tour.createdAtIso && !isTodayIso(state.tour.createdAtIso)) { setMsg(`This tour is from ${new Date(state.tour.createdAtIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Go back to tours and tap New tour for today's prospect.`, 'err'); return; }
  state.tour.editing = true; saveTourLocal(); showTourView();
}
export function renderTimes() {
  const el = $('tTimes'); if (!el) return;
  const parts = [`<b>${statusLabel(state.tour)}</b>`];
  if (state.tour.createdAtIso) parts.push(`created <b>${clockTime(state.tour.createdAtIso)}</b>`);
  if (state.tour.queuedAtIso && !state.tour.startedAtIso) parts.push(`queued <b>${clockTime(state.tour.queuedAtIso)}</b>`);
  if (state.tour.startedAtIso) parts.push(`started <b>${clockTime(state.tour.startedAtIso)}</b>${state.tour.assistant ? ` by <b>${esc(state.tour.assistant)}</b>` : ''}`);
  if (state.tour.finishedAtIso) parts.push(`finished <b>${clockTime(state.tour.finishedAtIso)}</b>`);
  el.innerHTML = parts.join(' · ');
  const st = $('tStart'); if (st && !state.tour.editing) { st.disabled = !state.tour.assistant; st.title = state.tour.assistant ? '' : 'Pick who is taking it first'; }
  renderTakeRow();
}
function renderNeedChips() {
  const beds = (state.tour.profile && state.tour.profile.beds) || [];
  $('needBeds').innerHTML = BED_OPTIONS.map(b => `<button class="chip ${beds.includes(b) ? 'on' : ''}" aria-pressed="${beds.includes(b)}" onclick="toggleNeedBed('${b}')">${b}</button>`).join('');
}
export function toggleNeedBed(b) {
  state.tour.profile = state.tour.profile || {}; const beds = state.tour.profile.beds || [];
  state.tour.profile.beds = beds.includes(b) ? beds.filter(x => x !== b) : beds.concat(b);
  renderNeedChips(); saveTourLocal(); scheduleSave(); renderPicker();
}
function readNeeds() {
  const pr = state.tour.profile || {};
  return { beds: pr.beds || [],
    priceMin: parseInt(String($('needMin').value).replace(/[^0-9]/g,''), 10) || null,
    priceMax: parseInt(String($('needMax').value).replace(/[^0-9]/g,''), 10) || null,
    moveIn: $('needMoveIn').value || '', flexible: $('needFlex').checked, mustHaves: ($('needNotes').value || '').trim() };
}
function fillNeeds() {
  const pr = state.tour.profile || {};
  $('needMin').value = pr.priceMin || ''; $('needMax').value = pr.priceMax || ''; $('needMoveIn').value = pr.moveIn || ''; $('needFlex').checked = !!pr.flexible; $('needNotes').value = pr.mustHaves || '';
  renderNeedChips();
}
// Tour status: 'planning' (not yet queued/started) → 'waiting' (sent to queue, no one on it yet) → 'started' → 'finished'.
function tourStatus(t) { return t.finishedAtIso ? 'finished' : t.startedAtIso ? 'started' : t.queuedAtIso ? 'waiting' : 'planning'; }
function statusLabel(t) { return { planning: 'Planning', waiting: 'Waiting for an assistant', started: 'In progress', finished: 'Finished' }[tourStatus(t)]; }
function validateEntry() {
  tourChanged();
  if (state.tour.kind === 'inspection') {
    if (!state.tour.prospectFirst) return needField('tFirst', "Enter the resident's first name.");
    const bldg = $('insBldg').value, unit = ($('insUnit').value || '').trim();
    if (!unit) return needField('insUnit', 'Enter the unit number.');
    state.tour.stops = [{ key: `${bnum(bldg)}|${normUnit(unit)}`, building: bldg, unit, type: 'Inspection', custom: true }];
    return true;
  }
  if (!state.tour.prospectFirst) return needField('tFirst', "Enter the prospect's first name.");
  if (state.tour.broker && !state.tour.brokerLast) return needField('tBrokerLast', "Enter the broker's last name.");
  if (!state.tour.stops.length) { setMsg('Pick at least one unit.', 'err'); return false; }
  return true;
}
// Send to queue: no assistant yet; the queue person (toolkit) or an assistant on any iPad assigns and starts it.
export async function sendToQueue() {
  if (!validateEntry()) return;
  if (state.tour.createdAtIso && !isTodayIso(state.tour.createdAtIso)) {   // never overwrite an earlier day's record — save as a new tour with today's times
    state.tour.id = null; state.tour.createdAtIso = new Date().toISOString(); state.tour.queuedAtIso = null; state.tour.startedAtIso = null; state.tour.finishedAtIso = null;
    state.tour.followUpSentAtIso = null; state.tour.checkInSentAtIso = null; state.tour.editing = false;
  }

  if (!state.tour.queuedAtIso) state.tour.queuedAtIso = new Date().toISOString();
  state.tour.editing = false;
  const ok = await saveTour();
  if (ok) { const who = state.tour.prospect, a = state.tour.assistant, id = state.tour.id; setMsg(`${who} is in the queue.`); closeTour(); homeNote(`✓ ${who} is in the queue${a ? ' with ' + a : ' — waiting for an assistant'}.`, id); }
}
export async function finishFromList(id) {
  const r = state.queueRows.find(x => x.id === id); if (!r) return;
  if (!confirm(`Finish ${r.kind === 'inspection' ? 'inspection' : 'tour'} for ${r.prospect}?`)) return;
  try { const now = new Date().toISOString(); await firebase.firestore().collection('tours').doc(id).set({ finishedAtIso: now, updatedAtIso: now }, { merge: true }); if (state.tour.id === id) { state.tour.finishedAtIso = now; closeTour(); } homeNote(`✓ Finished ${r.prospect} at ${clockTime(now)}${r.kind === 'inspection' ? '' : ' — it moves to Follow-Ups to Send on the Desk'}.`, id); }
  catch (e) { toast('Not finished — ' + (e.message || e) + '. Check the connection and try again.', true); }
}
export async function finishTour() {
  if (!confirm(`Finish ${state.tour.kind === 'inspection' ? 'inspection' : 'tour'} for ${state.tour.prospect}? It leaves the Current Queue${state.tour.kind === 'inspection' ? '' : ' and moves to Follow Ups to be Sent'}.`)) return;
  state.tour.finishedAtIso = new Date().toISOString(); state.tour.editing = false;
  const ok = await saveTour();
  if (ok) { const who = state.tour.prospect, id = state.tour.id, insp = state.tour.kind === 'inspection'; setMsg(`Finished ${clockTime(state.tour.finishedAtIso)}.`); closeTour(); homeNote(`✓ Finished ${who} at ${clockTime(state.tour.finishedAtIso)}${insp ? '' : ' — it moves to Follow-Ups to Send on the Desk'}.`, id); }
}
// New entry: fresh tour or inspection, stamped with the time it was created (the arrival time in the queue).
export function newEntry(kind) {
  state.tour = { id: null, active: true, editing: false, kind: kind === 'inspection' ? 'inspection' : 'tour', assistant: '', prospect: '', broker: false, brokerLast: '', brokerFirst: '', stops: [], createdAtIso: new Date().toISOString(), queuedAtIso: null, startedAtIso: null, finishedAtIso: null, profile: { beds: [], priceMin: null, priceMax: null, moveIn: '', flexible: false, mustHaves: '' } };
  saveTourLocal(); showTourView(); render(); setMsg(''); hideUndo(); window.scrollTo(0, 0);
  $('tFirst').focus();
}
export function newTour() { newEntry('tour'); }   // used when tapping + on a unit with no active tour
// Guest-info card: collapses to a one-line bar once you move on to units; tap the bar to reopen.
export function toggleGuest(open, quiet) {
  state.tour.guestOpen = !!open; saveTourLocal();
  $('guestCard').style.display = open ? '' : 'none';
  $('guestBar').style.display = open ? 'none' : '';
  if (!open) {
    const pr = profileSummary(state.tour.profile);
    const insp = state.tour.kind === 'inspection'; const st = (state.tour.stops || [])[0] || {};
    $('guestBarTitle').textContent = insp
      ? `Inspection · ${state.tour.prospect || '(no name)'} · ${bnum(st.building || '')} #${st.unit || ''}${state.tour.assistant ? ' · ' + state.tour.assistant : ' · unassigned'}${state.tour.startedAtIso ? ' · started ' + clockTime(state.tour.startedAtIso) : ''}`
      : `${state.tour.prospect || '(no name)'}${state.tour.assistant ? ' · ' + state.tour.assistant : ' · unassigned'}${state.tour.broker ? ' · broker ' + ([state.tour.brokerFirst, state.tour.brokerLast].filter(Boolean).join(' ') || 'yes') : ''}`;
    $('guestBarSub').textContent = insp ? 'tap to edit details' : (pr ? pr + ' — ' : '') + 'tap to edit details';
    if (!quiet && $('tourWorkArea').style.display !== 'none' && $('pickerBox') && $('pickerBox').scrollIntoView) $('pickerBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
export function closeTour() {
  state.tour.active = false; state.tour.editing = false; saveTourLocal(); showTourView(); render(); window.scrollTo(0, 0);
}
export function tourChanged(rerender) {
  state.tour.assistant = ($('tAssistant').value || '').trim();
  state.tour.prospectFirst = ($('tFirst').value || '').trim();
  state.tour.prospectInitial = ($('tProspect').value || '').trim().replace(/\.$/, '').toUpperCase();
  state.tour.prospect = state.tour.prospectInitial ? `${state.tour.prospectFirst} ${state.tour.prospectInitial}.` : state.tour.prospectFirst;   // display name
  state.tour.prospectEmail = ($('tEmail').value || '').trim();
  state.tour.broker = $('tBroker').checked;
  state.tour.brokerLast = ($('tBrokerLast').value || '').trim();
  state.tour.brokerFirst = ($('tBrokerFirst').value || '').trim();
  if (state.tour.kind !== 'inspection') state.tour.profile = readNeeds();
  saveTourLocal();
  if (rerender) { renderTour(); renderPicker(); } else renderTimes();
  scheduleSave();
}
// Autosave to the shared list once the tour has both names (debounced).
export function scheduleSave() {
  clearTimeout(saveTimer);
  if (!state.tour.active || !state.tour.prospectFirst) return;
  state.savePending = true;
  setMsg('Saving…', 'busy');
  saveTimer = setTimeout(() => saveTour(), 900);
}
// Start tour: validates, stamps the start time, saves.
export async function startTour() {
  if (!validateEntry()) return;
  if (state.tour.createdAtIso && !isTodayIso(state.tour.createdAtIso)) {   // never overwrite an earlier day's record — save as a new tour with today's times
    state.tour.id = null; state.tour.createdAtIso = new Date().toISOString(); state.tour.queuedAtIso = null; state.tour.startedAtIso = null; state.tour.finishedAtIso = null;
    state.tour.followUpSentAtIso = null; state.tour.checkInSentAtIso = null; state.tour.editing = false;
  }

  if (!state.tour.assistant) { setMsg('Pick who is taking it (the names above Start), or use Send to queue.', 'err'); renderTakeRow(); return; }
  const wasEditing = !!state.tour.editing;
  if (!state.tour.startedAtIso) state.tour.startedAtIso = new Date().toISOString();
  state.tour.editing = false; state.tour.guestOpen = false;
  const ok = await saveTour();
  showTourView(); window.scrollTo(0, 0);
  if (ok) setMsg(wasEditing ? `Updated ${clockTime(new Date().toISOString())}.` : `${state.tour.kind === 'inspection' ? 'Inspection' : 'Tour'} started ${clockTime(state.tour.startedAtIso)} · ${state.tour.assistant}.`);
}

export function renderTour() {
  $('brokerFields').style.display = state.tour.broker ? '' : 'none';
  renderTimes();
  renderTourExtras();
}
// The quoting rule under "Touring with a broker", from the shared pricing rules
export function fillBrokerNote() { $('brokerNote').textContent = BROKER_NOTE; }
