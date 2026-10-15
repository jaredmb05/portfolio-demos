// Wait estimator: tour length from units, buildings and walking time, and a lane simulation for who frees up next.
import { todayYmd } from './dates.js';
import { hooks } from './hooks.js';

// ===== Wait estimator: how long until the next assistant is free for a walk-in =====
// Inputs: who's in (schedule/out), in-progress tours (start time + units), waiting tours (arrival order),
// and today's appointments by hour (settings/appointments → { byDate: { 'YYYY-MM-DD': { '14': { tours: 2, insp: 1 } } } }).
export const WAIT_CFG = { richPerUnit: 14, lightPerUnit: 9, inspection: 25, walkBack: 3, defaultUnits: 3, minRemaining: 5, spread: 0.2 };
const RICH = ['2050','2110','2230'];
const WALK = { '2040|2050': 3, '2040|2110': 3, '2040|2120': 2.5, '2040|2230': 5, '2050|2110': 4, '2050|2120': 3, '2050|2230': 6, '2110|2120': 3, '2110|2230': 4, '2120|2230': 5 };
const walkMin = (a, b) => a === b ? 0 : (WALK[[a, b].sort().join('|')] || 4);
export function estimateMinutes(r) {
  if (r.kind === 'inspection') return WAIT_CFG.inspection;
  const stops = (r.stops || []);
  if (!stops.length) return WAIT_CFG.defaultUnits * WAIT_CFG.richPerUnit + 2 * 4 + WAIT_CFG.walkBack;
  let m = 0, prev = '2050';   // office is in 2050
  stops.forEach(st => { const b = String(st.building || '').match(/\d{4}/); const bn = b ? b[0] : '2050'; m += walkMin(prev, bn) + (RICH.includes(bn) ? WAIT_CFG.richPerUnit : WAIT_CFG.lightPerUnit); prev = bn; });
  return Math.round(m + walkMin(prev, '2050'));
}
export let apptByHour = {};   // today's { hour: { tours, insp } }
export function watchAppointments(onChange) {
  try { firebase.firestore().collection('settings').doc('appointments').onSnapshot(snap => { const d = (snap.exists && snap.data().byDate) || {}; apptByHour = d[todayYmd()] || {}; if (onChange) onChange(); }, err => console.warn('appointments', err)); } catch (e) {}
}
// Simulate lanes (assistants in today). Returns { waitMin, waitLo, waitHi, nextFree: {name, at}, lanes }
export function estimateWait(rows, names, outList, targetId, appts = apptByHour) {
  const now = Date.now();
  const lanes = names.filter(n => !outList.includes(n)).map(n => ({ name: n, freeAt: now }));
  if (!lanes.length) return { none: true };
  // in-progress tours occupy their assistant's lane
  const todayStart = new Date(new Date().toDateString()).getTime();
  rows.filter(r => r.startedAtIso && !r.finishedAtIso && new Date(r.startedAtIso).getTime() >= todayStart).forEach(r => {   // tours left open from earlier days don't block anyone
    const lane = lanes.find(l => l.name === r.assistant); const started = new Date(r.startedAtIso).getTime();
    const remaining = Math.max(WAIT_CFG.minRemaining, estimateMinutes(r) - (now - started) / 60000);
    const end = now + remaining * 60000;
    if (lane) lane.freeAt = Math.max(lane.freeAt, end); else lanes.push({ name: r.assistant || '?', freeAt: end, extra: true });
  });
  let targetStart = null, targetLane = '';
  const jobs = [];   // { at, dur, label } — waiting queue (now) and appointments (fixed times)
  rows.filter(r => r.queuedAtIso && !r.startedAtIso && !r.finishedAtIso).sort((a,b) => a.queuedAtIso < b.queuedAtIso ? -1 : 1)
    .forEach(r => jobs.push({ at: now, dur: estimateMinutes(r), label: r.prospect, assignee: r.assistant || '', id: r.id }));
  // keys are hours with .5 for the half hour ('14' = 2:00, '14.5' = 2:30); several in one slot are staggered 10 min apart
  Object.keys(appts).forEach(h => { const c = appts[h]; const hh = parseFloat(h); const base = new Date(); base.setHours(Math.floor(hh), Math.round((hh % 1) * 60), 0, 0);
    for (let i = 0; i < (c.tours || 0); i++) jobs.push({ at: base.getTime() + i * 10 * 60000, dur: WAIT_CFG.defaultUnits * WAIT_CFG.richPerUnit + 8 + WAIT_CFG.walkBack, label: 'appt' });
    for (let i = 0; i < (c.insp || 0); i++) jobs.push({ at: base.getTime() + i * 10 * 60000, dur: WAIT_CFG.inspection, label: 'inspection' }); });
  const live = jobs.filter(j => j.at + j.dur * 60000 > now); jobs.length = 0; live.forEach(x => jobs.push(x));
  // Assign work to lanes in time order. Booked appointments that have arrived by the time a lane frees up get
  // priority over walk-ins who are waiting; otherwise the longest-waiting walk-in goes next.
  const real = lanes.filter(l => !l.extra);
  const W = jobs.filter(j => j.id);                                                 // waiting walk-ins (queue entries), arrival order
  const A = jobs.filter(j => !j.id).sort((a,b) => a.at - b.at);                      // booked appointments by time
  for (let guard = 0; guard < 300 && (W.length || A.length); guard++) {
    const lane = real.reduce((best, l) => l.freeAt < best.freeAt ? l : best, real[0]);
    const t = lane.freeAt; let job = null, start = t, useLane = lane;
    const ai = A.findIndex(a => a.at <= t);
    if (ai >= 0) job = A.splice(ai, 1)[0];
    else if (W.length) {
      const wi = W.findIndex(x => !x.assignee || x.assignee === lane.name);
      if (wi >= 0) job = W.splice(wi, 1)[0];
      else { job = W.shift(); useLane = real.find(l => l.name === job.assignee) || lane; start = useLane.freeAt; }
    } else { job = A.shift(); start = Math.max(t, job.at); }
    if (targetId && job.id === targetId) { targetStart = start; targetLane = useLane.name; }
    useLane.freeAt = start + job.dur * 60000;
  }
  const sorted = real.slice().sort((a,b) => a.freeAt - b.freeAt);
  const next = sorted[0]; const waitMin = Math.max(0, Math.round((next.freeAt - now) / 60000));
  const spread = Math.max(5, Math.round(waitMin * WAIT_CFG.spread));
  return { waitMin, waitLo: Math.max(0, waitMin - spread), waitHi: waitMin + spread, nextFree: { name: next.name, at: next.freeAt }, lanes: sorted, targetStart, targetLane };
}
// Exact answer for one half-hour slot (marks it as answered even when 0)
export async function setApptExact(hour, kind, n) {
  const cur = Object.assign({ tours: 0, insp: 0 }, apptByHour[hour] || {}); cur[kind] = n; cur.asked = true;
  const next = Object.assign({}, apptByHour, { [hour]: cur });
  apptByHour = next; hooks.onAppointmentsChanged();
  try {
    const db = firebase.firestore(); const ref = db.collection('settings').doc('appointments');
    const snap = await ref.get(); const byDate = (snap.exists && snap.data().byDate) || {};
    const keep = {}; Object.keys(byDate).sort().slice(-7).forEach(k => { keep[k] = byDate[k]; }); keep[todayYmd()] = next;
    await ref.set({ byDate: keep, updatedAtIso: new Date().toISOString() });
  } catch (e) { console.error(e); }
}

export function waitText(est) {
  if (!est || est.none) return 'No assistants in today';
  if (est.waitMin <= 2) return `No wait — ${est.nextFree.name} is free`;
  const at = new Date(est.nextFree.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `≈ ${est.waitLo}–${est.waitHi} min · next free: ${est.nextFree.name} ~${at}`;
}
