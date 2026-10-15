// Future Move-Ins: prospects whose move-in is more than 45 days after the tour; follow up 30 days before move-in.
import { ymd } from '../../shared/dates.js';
import { escapeHtml, jsArg } from '../../shared/html.js';
import { fbDb } from './firebase.js';
import { queueRows, renderTourQueue } from './queue.js';
import { flDate, flFollowUpYmd, leadIsDue, leadsToCapture } from './rules/future-move-ins.js';
import { state } from './state.js';
import { clickedButton, rowLeaving, toast } from './ui.js';

// ===== Future Move-Ins: prospects who came in too early. Follow up 30 days before their move-in. =====
// No contact info is stored — the lead shows first name + tour date so the original email can be found in Outlook.
export var futureLeads = []; 
var flShort = ymd => ymd ? flDate(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: flDate(ymd).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : '';
function flIsDue(l) { return leadIsDue(l, ymd(new Date())); }
export function flDueCount() { return futureLeads.filter(flIsDue).length; }
export function watchFutureLeads() {
  const db = fbDb(); if (!db) return;
  db.collection('future_leads').onSnapshot(snap => { futureLeads = []; snap.forEach(d => futureLeads.push(d.data())); flCaptureFromTours(); renderTourQueue(); }, err => console.warn('future_leads', err));
}
var flCapturing = false;
export async function flCaptureFromTours() {
  const db = fbDb(); if (!db || flCapturing || !Array.isArray(queueRows)) return;
  const adds = leadsToCapture(queueRows, new Set(futureLeads.map(l => l.id)));
  if (!adds.length) return;
  flCapturing = true;
  try { for (const l of adds) await db.collection('future_leads').doc(l.id).set(l, { merge: true }); }
  catch (e) { console.warn('future lead capture', e); } finally { flCapturing = false; }
}
export async function flSetStatus(id, status) {
  const btn = clickedButton();
  const l = futureLeads.find(x => x.id === id); if (!l) return;
  const label = { contacted: 'contacted', leased: 'leased', lost: 'not interested', open: 'back to open' }[status];
  if (status !== 'open' && !confirm(`Mark ${l.name} as ${label}?`)) return;
  const by = localStorage.getItem('ld_agent') || '';
  if (status !== 'open') await rowLeaving(btn);
  try { await fbDb().collection('future_leads').doc(id).set({ status, statusBy: by, statusAtIso: new Date().toISOString(), updatedAtIso: new Date().toISOString() }, { merge: true }); toast(`${l.name}: ${label}`); }
  catch (e) { toast('Update failed: ' + (e.message || e), true); }
}
export async function flDelete(id) {
  const l = futureLeads.find(x => x.id === id); if (!l || !confirm(`Delete ${l.name} from Future Move-Ins?`)) return;
  // A lead captured from a tour stays as "deleted", so the next capture doesn't add the same tour back (B1)
  const ref = fbDb().collection('future_leads').doc(id), now = new Date().toISOString();
  try { await (l.source === 'tour' ? ref.set({ status: 'deleted', statusBy: localStorage.getItem('ld_agent') || '', statusAtIso: now, updatedAtIso: now }, { merge: true }) : ref.delete()); }
  catch (e) { toast('Delete failed: ' + (e.message || e), true); }
}
export async function flAddManual() {
  const v = id => (document.getElementById(id).value || '').trim();
  const first = v('flFirst'), init = v('flInit').replace(/\.$/, '').slice(0, 1).toUpperCase(), moveIn = v('flMoveIn');
  if (!first || !moveIn) { toast('Enter a first name and move-in date', true); return; }
  if (moveIn <= ymd(new Date())) { toast('Move-in date should be in the future', true); return; }
  const name = first.charAt(0).toUpperCase() + first.slice(1) + (init ? ` ${init}.` : '');
  const criteria = [v('flBeds'), v('flBudget') ? `up to $${Number(v('flBudget').replace(/[^\d]/g, '')).toLocaleString()}` : '', v('flNotes')].filter(Boolean).join(' · ');
  const id = 'm-' + Date.now().toString(36);
  try {
    await fbDb().collection('future_leads').doc(id).set({ id, source: 'manual', name, assistant: '', tourDate: ymd(new Date()), moveIn, followUpDate: flFollowUpYmd(moveIn), criteria, units: '', status: 'open', createdAtIso: new Date().toISOString(), updatedAtIso: new Date().toISOString() });
    state.flFormOpen = false; toast(`${name} added — follow up ${flShort(flFollowUpYmd(moveIn))}`);
  } catch (e) { toast('Could not add: ' + (e.message || e), true); }
}
// Outlook reminder: a calendar file for the follow-up date, 9:30 AM, with a pop-up reminder
export function flIcs(id) {
  const l = futureLeads.find(x => x.id === id); if (!l) return;
  const d = l.followUpDate.replace(/-/g, ''); const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const title = `Follow up: ${l.name} (${l.source === 'tour' ? 'toured ' + flShort(l.tourDate) : 'added ' + flShort(l.tourDate)}) — move-in ${flShort(l.moveIn)}`;
  const desc = [`Move-in: ${flShort(l.moveIn)}`, l.criteria ? `Looking for: ${l.criteria}` : '', l.units ? `Toured: ${l.units}` : '', l.assistant ? `Leasing assistant: ${l.assistant}` : '',
    l.source === 'tour' ? `Find the original email in Outlook: search "${l.name.split(' ')[0]}" around ${flShort(l.tourDate)}.` : ''].filter(Boolean).join('\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leasing Desk Demo//Future Move-Ins//EN', 'BEGIN:VEVENT', `UID:${l.id}@leasing-desk.example`, `DTSTAMP:${stamp}`,
    `DTSTART:${d}T093000`, `DTEND:${d}T094500`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `Follow up ${l.name.replace(/[^\w ]/g, '')} ${l.followUpDate}.ics`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Calendar file downloaded — open it to add the reminder to Outlook');
}
export function renderFutureLeads() {
  const today = ymd(new Date());
  const open = futureLeads.filter(l => l.status === 'open').sort((a, b) => a.followUpDate < b.followUpDate ? -1 : 1);
  const due = open.filter(flIsDue), upcoming = open.filter(l => !flIsDue(l));
  const done = futureLeads.filter(l => l.status !== 'open' && l.status !== 'deleted').sort((a, b) => (b.statusAtIso || '') < (a.statusAtIso || '') ? -1 : 1).slice(0, 30);
  const row = (l, i) => {
    const late = l.status === 'open' && l.followUpDate < today;
    const when = l.status !== 'open' ? `<span class="sent-tag">${{ contacted: 'contacted', leased: 'leased', lost: 'not interested' }[l.status]}${l.statusBy ? ' · ' + escapeHtml(l.statusBy) : ''}${l.statusAtIso ? ' · ' + new Date(l.statusAtIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>`
      : `follow up <strong>${flShort(l.followUpDate)}</strong>${late ? ' · <strong style="color:var(--red);">overdue</strong>' : flIsDue(l) ? ' · <strong style="color:var(--gold-ink);">due today</strong>' : ''}`;
    const acts = l.status === 'open'
      ? `<button class="tiny ghost" onclick='flIcs(${jsArg(l.id)})' title="Download a calendar reminder for the follow-up date">Add to Outlook</button><button class="tiny ghost" onclick='flSetStatus(${jsArg(l.id)},"leased")'>Leased</button><button class="tiny ghost" onclick='flSetStatus(${jsArg(l.id)},"lost")'>Not interested</button><button class="tiny primary" onclick='flSetStatus(${jsArg(l.id)},"contacted")'>✓ Contacted</button><button class="queue-del" onclick='flDelete(${jsArg(l.id)})'>Delete</button>`
      : `<button class="tiny ghost" onclick='flSetStatus(${jsArg(l.id)},"open")'>↩ Reopen</button>`;
    return `<div class="queue-row ${l.status !== 'open' ? 'sent' : ''}" style="grid-template-columns: 28px minmax(0, 1fr) auto auto;">
      <div class="n">${i + 1}</div>
      <div><div class="who">${escapeHtml(l.name)}${l.assistant ? ` <span style="font-weight:400; color:var(--ink-soft);">· ${escapeHtml(l.assistant)}</span>` : ''}</div>
        <div class="units sub">move-in <strong>${flShort(l.moveIn)}</strong> · ${l.source === 'tour' ? 'toured ' + flShort(l.tourDate) : 'added ' + flShort(l.tourDate)}${l.units ? ' · ' + escapeHtml(l.units) : ''}</div>
        ${l.criteria ? `<div class="prof">${escapeHtml(l.criteria)}</div>` : ''}
        ${l.source === 'tour' && l.status === 'open' ? `<div class="prof" style="color:var(--ink-soft);">Outlook: search "${escapeHtml(l.name.split(' ')[0])}" around ${flShort(l.tourDate)}</div>` : ''}</div>
      <div class="when">${when}</div>
      <div class="acts">${acts}</div>
    </div>`;
  };
  const form = state.flFormOpen ? `<div class="fl-form">
      <div class="row" style="gap:8px; flex-wrap:wrap;">
        <input type="text" id="flFirst" placeholder="First name" aria-label="First name" style="max-width:150px;">
        <input type="text" id="flInit" placeholder="Last initial" aria-label="Last initial" maxlength="2" style="max-width:90px;">
        <label style="display:flex; align-items:center; gap:6px; margin:0;">Move-in <input type="date" id="flMoveIn" style="max-width:160px;"></label>
        <select id="flBeds" aria-label="Looking for" style="max-width:150px;"><option value="">Looking for…</option>${['Studio','1 Bed','2 Bed','3 Bed'].map(b => `<option>${b}</option>`).join('')}</select>
        <input type="text" id="flBudget" placeholder="Budget up to $" aria-label="Budget up to" style="max-width:130px;">
        <input type="text" id="flNotes" placeholder="Notes (e.g., W/D, high floor)" aria-label="Notes" style="flex:1; min-width:180px;">
      </div>
      <div class="row" style="gap:8px; margin-top:8px;"><button class="tiny primary" onclick="flAddManual()">Add lead</button><button class="tiny ghost" onclick="flFormOpen=false; renderTourQueue();">Cancel</button>
        <span class="queue-note">No email or phone is stored — the follow-up date is set 30 days before move-in.</span></div>
    </div>` : '';
  return `<div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin:10px 0 2px;"><span class="queue-note">Prospects who came in early — follow up 30 days before move-in. Tours with a move-in more than 45 days out are added automatically.</span>
      ${state.flFormOpen ? '' : `<button class="tiny" onclick="flFormOpen=true; renderTourQueue(); setTimeout(()=>document.getElementById('flFirst').focus(),0);">+ Add future lead</button>`}</div>
    ${form}
    <div class="queue-section" style="margin-top:12px;">Reach out now (${due.length})</div>
    ${due.length ? due.map(row).join('') : '<div class="empty">Nobody is due yet.</div>'}
    <div class="queue-section" style="margin-top:16px;">Coming up (${upcoming.length})</div>
    ${upcoming.length ? upcoming.map(row).join('') : '<div class="empty">No future move-ins on the list.</div>'}
    ${done.length ? `<details style="margin-top:16px;"><summary class="queue-section" style="cursor:pointer;">Done (${done.length})</summary>${done.map(row).join('')}</details>` : ''}`;
}
