// Today's tours on the Tour Planner home.
import { clockTime } from '../../shared/dates.js';
import { escapeHtml as esc, jsArg } from '../../shared/html.js';
import { profileSummary } from '../../shared/unit-options.js';
import { render } from './availability-list.js';
import { bldgTitle } from './format.js';
import { state } from './state.js';
import { saveTourLocal, showTourView } from './tour-planner.js';
import { $, setMsg, toast } from './ui.js';

export function renderQueue() {
  const box = $('tourList'); if (!box) return;
  const rows = state.queueRows.slice();
  const today = new Date().toDateString();
  const isToday = r => new Date(r.createdAtIso).toDateString() === today;
  const isInsp = r => r.kind === 'inspection';
  const todays = rows.filter(isToday);
  // Waiting = sent to the queue, not started (who's standing in the lobby) · Being planned = not sent yet
  const waiting = todays.filter(r => r.queuedAtIso && !r.startedAtIso && !r.finishedAtIso).sort((a,b) => a.queuedAtIso < b.queuedAtIso ? -1 : 1);
  const planning = todays.filter(r => !isInsp(r) && !r.queuedAtIso && !r.startedAtIso && !r.finishedAtIso).sort((a,b) => a.createdAtIso < b.createdAtIso ? -1 : 1);
  const live = todays.filter(r => r.startedAtIso && !r.finishedAtIso).sort((a,b) => (a.startedAtIso||'') < (b.startedAtIso||'') ? 1 : -1);
  const done = todays.filter(r => r.finishedAtIso).sort((a,b) => (a.finishedAtIso||'') < (b.finishedAtIso||'') ? 1 : -1).slice(0, 20);
  if (!waiting.length && !planning.length && !live.length && !done.length) { box.innerHTML = '<div class="tourrow"><span class="t2">No tours or inspections yet today. Tap New tour or New inspection to begin. Earlier days are in the Leasing Desk under History.</span></div>'; return; }
  const sub = r => isInsp(r)
    ? `${esc(bldgTitle((r.stops[0]||{}).building))} #${esc((r.stops[0]||{}).unit || '')}`
    : `${(r.stops||[]).length ? (r.stops||[]).map(s => '#' + esc(String(s.unit))).join(', ') : 'no units yet'}${r.broker ? ' · broker' + (r.brokerLast ? ': ' + esc([r.brokerFirst, r.brokerLast].filter(Boolean).join(' ')) : '') : ''}${r.profile && profileSummary(r.profile) ? ` · ${esc(profileSummary(r.profile))}` : ''}`;
  const mins = iso => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const statusPill = r => r.finishedAtIso ? `<span class="pill is-done">Finished ${esc(clockTime(r.finishedAtIso))}</span>`
    : r.startedAtIso ? `<span class="pill is-live">In progress · since ${esc(clockTime(r.startedAtIso))}</span>`
    : r.queuedAtIso ? `<span class="pill is-wait">Waiting · ${mins(r.queuedAtIso)} min</span>`
    : `<span class="pill is-plan">Planning · ${esc(clockTime(r.createdAtIso))}</span>`;
  const tag = r => isInsp(r) ? `<span class="flag insp" style="margin-right:6px;">Inspection</span>` : '';
  // Delete only for entries that haven't started (a finished tour's follow-up lives on the Desk)
  const row = r => `<div class="tourrow ${state.tour.id === r.id ? 'mine' : ''}" data-id="${esc(r.id)}"><div role="button" tabindex="0" style="flex:1; min-width:0;" onclick='openTour(${jsArg(r.id)})'><div class="t1">${tag(r)}${esc(r.prospect || '(no name)')}${!isInsp(r) || r.assistant ? ' · ' + (r.assistant ? esc(r.assistant) : '<span style="color:var(--amber-ink)">unassigned</span>') : ''}</div><div class="t2">${statusPill(r)} · ${sub(r)}${r.source === 'toolkit' ? ' · from Leasing Desk' : ''}</div></div>${r.startedAtIso && !r.finishedAtIso ? `<button class="btn" onclick='event.stopPropagation(); finishFromList(${jsArg(r.id)})'>Finish</button>` : ''}<button class="btn sec" onclick='openTour(${jsArg(r.id)})'>Open</button>${!r.startedAtIso && !r.finishedAtIso ? `<button class="btn quiet del" onclick='event.stopPropagation(); deleteTour(${jsArg(r.id)})'>Delete</button>` : ''}</div>`;
  const grp = (title, list) => list.length ? `<div class="grp">${title} (${list.length})</div>` + list.map(row).join('') : '';
  box.innerHTML = grp('Waiting for an assistant', waiting) + grp('Being planned', planning) + grp('In progress', live) + grp('Finished today', done);
}
// Delete a tour outright — only used on today's own list, and only for tours that haven't gone anywhere yet
// (deleting after a follow-up email is sent would need a different flow, so this is a hard confirm).
export async function deleteTour(id) {
  const r = state.queueRows.find(x => x.id === id);
  const label = r ? `${r.prospect || '(no name)'}${r.assistant ? ' · ' + r.assistant : ''}` : 'this tour';
  if (!confirm(`Delete ${label}? This can't be undone.`)) return;
  try {
    await firebase.firestore().collection('tours').doc(id).delete();
    if (state.tour.id === id) { state.tour.active = false; saveTourLocal(); showTourView(); }
    state.queueRows = state.queueRows.filter(x => x.id !== id); renderQueue();
  } catch (e) { toast('Not deleted — ' + (e.message || e) + '. Check the connection and try again.', true); }
}
export function openTour(id) {
  const r = state.queueRows.find(x => x.id === id); if (!r) return;
  state.tour = { id: r.id, active: true, editing: false, kind: r.kind === 'inspection' ? 'inspection' : 'tour', assistant: r.assistant || '', prospect: r.prospect, prospectFirst: r.prospectFirst || r.prospect || '', prospectInitial: r.prospectInitial || '', prospectEmail: r.prospectEmail || '', broker: !!r.broker, brokerLast: r.brokerLast || '', brokerFirst: r.brokerFirst || '', stops: r.stops || [], createdAtIso: r.createdAtIso, queuedAtIso: r.queuedAtIso || null, startedAtIso: r.startedAtIso || null, finishedAtIso: r.finishedAtIso || null, profile: r.profile || null };
  state.tour._savedAt = r.updatedAtIso || ''; state.savePending = false;
  saveTourLocal(); showTourView(); render(); window.scrollTo(0, 0);
  setMsg((!r.startedAtIso && r.queuedAtIso) ? (state.tour.stops.length ? `${state.tour.prospect} is waiting — tap your name, then Start.` : `${state.tour.prospect} is waiting — pick the units, tap your name, then Start.`) : '', 'busy');
}
