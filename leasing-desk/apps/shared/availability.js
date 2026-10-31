// Who is in today: the weekly schedule plus per-day Mark out / Mark back in (settings/schedule, settings/availability).
import { todayYmd } from './dates.js';
import { hooks } from './hooks.js';
import { team } from './team.js';

// ===== Availability: weekly schedule (settings/schedule) + per-day overrides (settings/availability) =====
// Out today = not scheduled for today's weekday, or manually marked out; a manual "Back in" overrides the schedule.
export let outByDate = {}, inByDate = {}, schedule = {};   // schedule: { name: [0..6 weekday numbers they work] }
export const scheduledToday = name => !schedule[name] || schedule[name].includes(new Date().getDay());   // no schedule set = always in
// Who is out: marked out for the day, or not on the weekly schedule (no schedule = always in) unless marked back in
export function outOn({ names, schedule, marked, back, weekday }) {
  const all = names.slice();
  Object.keys(schedule).forEach(n => { if (!all.includes(n)) all.push(n); });
  const scheduled = n => !schedule[n] || schedule[n].includes(weekday);
  return all.filter(n => marked.includes(n) || (!scheduled(n) && !back.includes(n)));
}
export function outToday() {
  const k = todayYmd();
  return outOn({ names: team.assistants, schedule, marked: outByDate[k] || [], back: inByDate[k] || [], weekday: new Date().getDay() });
}
// Mark out / Mark back in for one day. Overrides older than 14 days are dropped.
export function toggledAvailability({ outByDate, inByDate, name, day, isOut, scheduled }) {
  const out = (outByDate[day] || []).filter(n => n !== name), fin = (inByDate[day] || []).filter(n => n !== name);
  if (isOut) { if (!scheduled) fin.push(name); }      // bring back in: clear manual out; force in if unscheduled
  else out.push(name);                                // mark out for today
  const trim = obj => { const keep = {}; Object.keys(obj).sort().slice(-14).forEach(d => { keep[d] = obj[d]; }); return keep; };
  return { byDate: trim(Object.assign({}, outByDate, { [day]: out })), inByDate: trim(Object.assign({}, inByDate, { [day]: fin })) };
}
export function watchAvailability(onChange) {
  try {
    const db = firebase.firestore();
    db.collection('settings').doc('availability').onSnapshot(snap => { const d = (snap.exists && snap.data()) || {}; outByDate = d.byDate || {}; inByDate = d.inByDate || {}; if (onChange) onChange(); }, err => console.warn('availability', err));
    db.collection('settings').doc('schedule').onSnapshot(snap => { schedule = (snap.exists && snap.data().byName) || {}; if (onChange) onChange(); }, err => console.warn('schedule', err));
  } catch (e) {}
}
export async function toggleOut(name) {
  const k = todayYmd(); const isOut = outToday().includes(name);
  const { byDate, inByDate: inBy } = toggledAvailability({ outByDate, inByDate, name, day: k, isOut, scheduled: scheduledToday(name) });
  try { await firebase.firestore().collection('settings').doc('availability').set({ byDate, inByDate: inBy, updatedAtIso: new Date().toISOString() }); }
  catch (e) { console.error(e); hooks.toast('Could not update availability: ' + (e.message || e), true); }
}
