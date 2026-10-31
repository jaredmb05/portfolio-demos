// Future Move-Ins: which tours become leads, and when to follow up. No contact info is stored (D14).
import { ymd } from '../../../shared/dates.js';
import { escapeHtml } from '../../../shared/html.js';
import { profileSummary } from '../../../shared/unit-options.js';
import { reportSize } from './reports.js';

export const FL_MIN_DAYS = 45, FL_LEAD_DAYS = 30;
export const flDate = ymd => new Date(ymd + 'T12:00:00');   // a YYYY-MM-DD date at local noon
// Follow up 30 days before move-in
export function flFollowUpYmd(moveIn) { const d = flDate(moveIn); d.setDate(d.getDate() - FL_LEAD_DAYS); return ymd(d); }
// An open lead whose follow-up date has come
export const leadIsDue = (l, today) => l.status === 'open' && l.followUpDate <= today;
// "Oct 16", or "Mar 5, 2027" for a date in another year; nothing for no date
export const flShort = (ymd, now = new Date()) => ymd ? flDate(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: flDate(ymd).getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) : '';

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
// The automatic capture (production D46): it only ever creates a lead, never writes over one. Nothing runs until the Desk's
// leads list has loaded (`loaded`): a Desk whose tours arrive first would see no leads and add them all again. Then each new
// lead is read first (db.exists) and created (db.create, the whole lead, no merge) only when the database has no lead with that
// ID, so a lead marked contacted, leased, not interested or deleted, possibly by another Desk, stays as it is. Before v1.34 a
// merge write of status "open" undid Contacted / Leased / Not interested. Returns the IDs it created.
export async function captureLeads(rows, leads, loaded, db) {
  if (!loaded) return [];
  const made = [];
  for (const l of leadsToCapture(rows, new Set(leads.map(x => x.id)))) {
    if (await db.exists(l.id)) continue;   // already there (another Desk's, done or deleted): left alone
    await db.create(l); made.push(l.id);
  }
  return made;
}
// Delete (production D46, and B1 here for tour leads): every lead, from a tour or added by hand, is marked deleted with who and
// when, never erased. It leaves every list and count but stays in the database, so the capture can't add it back.
export const deletedLead = (by, nowIso) => ({ status: 'deleted', statusBy: by || '', statusAtIso: nowIso, updatedAtIso: nowIso });

// Copy follow-up (production Desk v1.31, D39): the email to paste into a reply on the lead's original Outlook thread (no
// email is stored). Built like the check-in: Calibri 11pt <p> blocks. The first name, when they toured (or, added by hand,
// when we spoke), the move-in date and the size from the first part of the criteria ("1 Bed · $4,500–$5,000"); never a
// price or a unit number. Copying it doesn't mark the lead contacted.
const FOLLOW_UP_SIZE = { 'Studio': 'a studio', '1 Bed': 'a 1 bedroom', '2 Bed': 'a 2 bedroom', '3 Bed': 'a 3 bedroom' };
export function futureFollowUpHtml(l) {
  const first = String(l.name || '').trim().split(' ')[0];
  const long = ymd => { const d = flDate(String(ymd || '')); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); };
  const size = FOLLOW_UP_SIZE[reportSize(String(l.criteria || '').split('·')[0])];
  const met = (l.source === 'tour' ? 'When you toured with us' : 'When we spoke') + (long(l.tourDate) ? ` on ${long(l.tourDate)}` : '');
  const p = t => `<p style="margin:0; padding:0;">${t}</p>`;
  return `<div style="font-family:Calibri,Arial,sans-serif; font-size:11pt;">${p(`Hi ${escapeHtml(first)},`)}${p('&nbsp;')}${p(`I hope all is well! ${met}, you mentioned you were planning to move in around ${long(l.moveIn)}.`)}${p('&nbsp;')}${p(`As your move-in date gets closer, I wanted to check in to see if you're still looking${size ? ' for ' + size : ''}. I'd be happy to send over current availability or set up a time for you to come back in.`)}${p('&nbsp;')}${p('Please let me know if I can be of any further assistance.')}</div>`;
}

// Add to Outlook: a calendar file for the follow-up date, 9:30 AM, with a pop-up reminder; '' when the lead has no valid
// follow-up date. Every value that goes into the file is cleaned (production D43), so a line break saved in a lead can't
// add lines of its own: the date checked, the UID only letters, digits, ".", "-" and "_", CR escaped as well as LF.
export function followUpIcs(l, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(l.followUpDate || ''))) return '';
  const d = l.followUpDate.replace(/-/g, ''); const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const uid = String(l.id || '').replace(/[^\w.-]/g, '') || 'lead';
  const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r\n|\r|\n/g, '\\n');
  const short = ymd => flShort(ymd, now);
  const title = `Follow up: ${l.name} (${l.source === 'tour' ? 'toured ' + short(l.tourDate) : 'added ' + short(l.tourDate)}) — move-in ${short(l.moveIn)}`;
  const desc = [`Move-in: ${short(l.moveIn)}`, l.criteria ? `Looking for: ${l.criteria}` : '', l.units ? `Toured: ${l.units}` : '', l.assistant ? `Leasing assistant: ${l.assistant}` : '',
    l.source === 'tour' ? `Find the original email in Outlook: search "${l.name.split(' ')[0]}" around ${short(l.tourDate)}.` : ''].filter(Boolean).join('\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leasing Desk Demo//Future Move-Ins//EN', 'BEGIN:VEVENT', `UID:${uid}@leasing-desk.example`, `DTSTAMP:${stamp}`,
    `DTSTART:${d}T093000`, `DTEND:${d}T094500`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
