// Saving tours to Firestore (always merge, D6) and following changes made elsewhere.
import { clockTime } from '../../shared/dates.js';
import { savedQuoteFields } from '../../shared/pricing.js';
import { state } from './state.js';
import { renderQueue } from './todays-tours.js';
import { closeTour, renderTimes, saveTourLocal, showTourView } from './tour-planner.js';
import { $, homeNote, setMsg } from './ui.js';

// ---------- Save / load tours (Firestore: tours/{id}) ----------
function tourDoc() {
  return JSON.parse(JSON.stringify({
    id: state.tour.id, kind: state.tour.kind === 'inspection' ? 'inspection' : 'tour', assistant: state.tour.assistant, prospect: state.tour.prospect, prospectFirst: state.tour.prospectFirst || '', prospectInitial: state.tour.prospectInitial || '', prospectEmail: state.tour.prospectEmail || '', broker: !!state.tour.broker,
    brokerLast: state.tour.broker ? (state.tour.brokerLast || '') : '', brokerFirst: state.tour.broker ? (state.tour.brokerFirst || '') : '',
    stops: state.tour.stops.map(st => { const c = Object.assign({}, st, savedQuoteFields(st)); delete c.isNew; return c; }), source: 'ipad',
    queuedAtIso: state.tour.queuedAtIso || undefined, startedAtIso: state.tour.startedAtIso || undefined, finishedAtIso: state.tour.finishedAtIso || undefined, profile: state.tour.profile || null,
    createdAtIso: state.tour.createdAtIso || new Date().toISOString(), updatedAtIso: new Date().toISOString()
  }));   // undefined → dropped by JSON, so a save never erases a start/finish time set elsewhere
}
export async function saveTour() {
  if (!state.tour.active || !state.tour.prospectFirst) return false;
  try {
    const db = firebase.firestore();
    if (!state.tour.id) state.tour.id = `${state.tour.prospect}-${Date.now().toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '_');
    if (!state.tour.createdAtIso) state.tour.createdAtIso = new Date().toISOString();
    const doc = tourDoc(); doc.id = state.tour.id;
    await db.collection('tours').doc(state.tour.id).set(doc, { merge: true });   // merge: keep the Desk's fields (follow-up sent, check-in, heads-up…)
    state.tour._savedAt = doc.updatedAtIso; state.savePending = false;
    saveTourLocal();
    setMsg(`Saved ${clockTime(doc.updatedAtIso)}`);
    return true;
  } catch (e) { console.error(e); setMsg('Not saved — ' + (navigator.onLine === false ? 'no connection. It stays on this iPad; keep going and it will try again.' : (e.message || e)), 'err'); return false; }
}
// Today's tours (live): started tours first by most recent, then unstarted ones in creation order.
// If someone else changed the tour this iPad has open (Desk finished it, assigned it, reset its start, saved units…),
// take their version — unless this iPad has unsaved typing in flight.
const SYNC_FIELDS = ['assistant','prospect','prospectFirst','prospectInitial','prospectEmail','broker','brokerLast','brokerFirst','stops','profile','createdAtIso','queuedAtIso','startedAtIso','finishedAtIso'];
function syncOpenTour() {
  if (!state.tour.active || !state.tour.id || state.savePending) return;
  const r = state.queueRows.find(x => x.id === state.tour.id); if (!r) return;
  if ((r.updatedAtIso || '') <= (state.tour._savedAt || '')) return;
  const wasFinished = !!state.tour.finishedAtIso;
  SYNC_FIELDS.forEach(k => { if (r[k] !== undefined) state.tour[k] = r[k]; });
  state.tour._savedAt = r.updatedAtIso; saveTourLocal();
  if (r.finishedAtIso && !wasFinished) { closeTour(); homeNote(`${r.prospect} was finished at the Leasing Desk.`, r.id); return; }
  showTourView();
}
export function watchQueue() {
  try {
    // the iPad needs today's tours plus 7 days for the rotation grid; 10 days / up to 400 covers a busy week
    const cutoff = new Date(Date.now() - 10 * 864e5).toISOString();
    firebase.firestore().collection('tours').where('updatedAtIso', '>=', cutoff).orderBy('updatedAtIso', 'desc').limit(400)
      .onSnapshot(snap => { state.toursDown = false; state.queueRows = []; snap.forEach(d => state.queueRows.push(d.data())); syncOpenTour(); renderQueue(); }, err => { console.error(err); state.toursDown = true; $('tourList').innerHTML = `<div class="tourrow"><span class="t2">Couldn’t load today’s tours. Check the Wi-Fi, then close and reopen the app.</span></div>`; });
  } catch (e) { console.error(e); }
  setInterval(() => { renderQueue(); renderTimes(); }, 30000);
}
