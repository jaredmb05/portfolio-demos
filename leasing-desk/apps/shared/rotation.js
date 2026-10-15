// Rotation: fewest tours started today goes next; ties go to whoever started longest ago; anyone on a tour is skipped.
import { outToday } from './availability.js';
import { ymd } from './dates.js';
import { estimateMinutes, WAIT_CFG } from './wait-estimate.js';

// Who is on a tour or inspection right now (started today, not finished) and about when they'll be back: the same
// rule estimateWait uses. "Next up" skips them: the first person in rotation order who is in today and free right now.
export function busyNow(rows, exceptId) {
  const now = Date.now(), todayStart = new Date(new Date().toDateString()).getTime(), busy = {};
  rows.filter(r => r.id !== exceptId && r.assistant && r.startedAtIso && !r.finishedAtIso && new Date(r.startedAtIso).getTime() >= todayStart).forEach(r => {
    const back = now + Math.max(WAIT_CFG.minRemaining, estimateMinutes(r) - (now - new Date(r.startedAtIso).getTime()) / 60000) * 60000;
    if (!busy[r.assistant] || back > busy[r.assistant].back) busy[r.assistant] = { back, prospect: r.prospect || '', kind: r.kind === 'inspection' ? 'inspection' : 'tour', startedAtIso: r.startedAtIso };
  });
  return busy;
}
export function suggestNext(rot, busy) { const p = rot.order.find(p => !rot.out.includes(p.name) && !busy[p.name]); return p ? p.name : ''; }
export function busyLabel(b) { return b ? 'back ~' + new Date(b.back).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''; }
export function rotationStats(rows, names, out = outToday()) {
  const dayKey = iso => ymd(new Date(iso));
  const today = dayKey(new Date().toISOString());
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(dayKey(d.toISOString())); }
  const per = {}; names.forEach(n => { per[n] = { name: n, today: { tours: 0, insp: 0 }, lastStart: null, byDay: {} }; days.forEach(k => { per[n].byDay[k] = { tours: 0, insp: 0 }; }); });
  rows.forEach(r => {
    if (!r.startedAtIso || !r.assistant) return;
    const n = r.assistant; if (!per[n]) { per[n] = { name: n, today: { tours: 0, insp: 0 }, lastStart: null, byDay: {} }; days.forEach(k => { per[n].byDay[k] = { tours: 0, insp: 0 }; }); }
    const k = dayKey(r.startedAtIso); const kind = r.kind === 'inspection' ? 'insp' : 'tours';
    if (per[n].byDay[k]) per[n].byDay[k][kind]++;
    if (k === today) { per[n].today[kind]++; if (!per[n].lastStart || r.startedAtIso > per[n].lastStart) per[n].lastStart = r.startedAtIso; }
  });
  const list = Object.values(per);
  const total = p => p.today.tours + p.today.insp;
  // Suggested next: fewest today; tie → longest since their last start (never started today first)
  const order = list.filter(p => !out.includes(p.name)).sort((a, b) => total(a) - total(b) || ((a.lastStart || '') < (b.lastStart || '') ? -1 : 1))
    .concat(list.filter(p => out.includes(p.name)));
  return { list, order, days, today, total, out };
}
