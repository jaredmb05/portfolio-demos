// Future Move-Ins: which tours become leads, and when to follow up. No contact info is stored (D14).
import { ymd } from '../../../shared/dates.js';
import { profileSummary } from '../../../shared/unit-options.js';

export const FL_MIN_DAYS = 45, FL_LEAD_DAYS = 30;
export const flDate = ymd => new Date(ymd + 'T12:00:00');   // a YYYY-MM-DD date at local noon
// Follow up 30 days before move-in
export function flFollowUpYmd(moveIn) { const d = flDate(moveIn); d.setDate(d.getDate() - FL_LEAD_DAYS); return ymd(d); }
// An open lead whose follow-up date has come
export const leadIsDue = (l, today) => l.status === 'open' && l.followUpDate <= today;

// Started tours (not inspections) whose move-in is more than 45 days after the tour and that aren't leads yet.
// The lead's id is tied to the tour, so each tour is captured once.
export function leadsToCapture(rows, haveIds) {
  const adds = [];
  for (const r of rows) {
    if (r.kind === 'inspection' || !r.startedAtIso || !r.profile || !r.profile.moveIn) continue;
    const id = 'tour-' + r.id; if (haveIds.has(id)) continue;
    const toured = new Date(r.startedAtIso);
    const gap = Math.round((flDate(r.profile.moveIn) - flDate(ymd(toured))) / 864e5);   // calendar days, not hours (B2)
    if (gap <= FL_MIN_DAYS) continue;
    adds.push({ id, source: 'tour', tourId: r.id, name: r.prospect || '(no name)', assistant: r.assistant || '', tourDate: ymd(toured),
      moveIn: r.profile.moveIn, followUpDate: flFollowUpYmd(r.profile.moveIn), criteria: profileSummary(Object.assign({}, r.profile, { moveIn: '' })),
      units: (r.stops || []).map(s => '#' + s.unit).join(', '), status: 'open', createdAtIso: new Date().toISOString(), updatedAtIso: new Date().toISOString() });
  }
  return adds;
}
