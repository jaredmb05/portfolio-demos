// Tour Queue: live tours, the Current Queue / Follow-Ups / Check-In / Rotation tabs, and each row's actions.
import { outToday, schedule, scheduledToday } from '../../shared/availability.js';
import { clockTime } from '../../shared/dates.js';
import { escapeHtml, jsArg } from '../../shared/html.js';
import { busyLabel, busyNow, rotationStats, suggestNext } from '../../shared/rotation.js';
import { team } from '../../shared/team.js';
import { profileSummary } from '../../shared/unit-options.js';
import { estimateWait, waitText } from '../../shared/wait-estimate.js';
import { waitHeadline, waitPanelHtml, waitPanelOpen } from '../../shared/wait-panel.js';
import { copyHtmlToClipboard } from './clipboard.js';
import { deskConn, queueUnknown, renderConn, setConn } from './connection.js';
import { fbDb } from './firebase.js';
import { flCaptureFromTours, flDueCount, futureLeads, renderFutureLeads } from './future-leads.js';
import { renderHistory } from './history.js';
import { applyTour } from './plan-tour.js';
import { checkInDueText, daysSinceFollowUp, queueBuckets, splitCurrentQueue, startedOnEarlierDay, todayTotals, touredWhen } from './rules/queue.js';
import { state } from './state.js';
import { clickedButton, rowLeaving, toast, withBusy } from './ui.js';
import { bldgTitle } from './units.js';

export let queueRows = [];
let queueTab = 'queue';   // 'queue' | 'followup' | 'checkin' | 'rotation' | 'history'
export function checkInHtml(r) {
  const first = (r.prospectFirst || '').trim() || (r.prospect || '').trim();
  const when = touredWhen(new Date(r.startedAtIso || r.createdAtIso));
  const p = t => `<p style="margin:0; padding:0;">${t}</p>`;
  return `<div style="font-family:Calibri,Arial,sans-serif; font-size:11pt;">${p(`Hi ${escapeHtml(first)},`)}${p('&nbsp;')}${p(`I hope all is well and thank you for coming in ${when}.`)}${p('&nbsp;')}${p("I'm following up on your tour - did you have any interest in or questions about the apartments you viewed?")}${p('&nbsp;')}${p('Please let me know if I can be of any further assistance.')}</div>`;
}
export async function copyCheckIn(id) { const r = queueRows.find(x => x.id === id); if (!r) return; await copyHtmlToClipboard(checkInHtml(r)); }
const AGENTS = ['Alex', 'Morgan'];
export function headsUpHtml(r) {
  const first = (r.prospectFirst || '').trim() || (r.prospect || '').trim();
  const p = t => `<p style="margin:0; padding:0;">${t}</p>`;
  return `<div style="font-family:Calibri,Arial,sans-serif; font-size:11pt;">${p(`Hi ${escapeHtml(first)},`)}${p('&nbsp;')}${p("We're about 10 minutes away from your tour — please make your way back to the leasing office at 2050 Tidemark Blvd and we'll get you started.")}${p('&nbsp;')}${p('See you shortly!')}</div>`;
}
export async function copyHeadsUp(id) {
  const r = queueRows.find(x => x.id === id); if (!r) return;
  await copyHtmlToClipboard(headsUpHtml(r));
  // Only the note goes on the clipboard (copying the email right after used to replace the note). The address is its own "Copy email" link.
  toast(r.prospectEmail ? `Heads-up copied. Send it to ${r.prospectEmail} (use Copy email for the address).` : 'Heads-up copied. No email on file — ask for one.', r.prospectEmail ? undefined : 'warn');
  try { await fbDb().collection('tours').doc(id).set({ headsUpSentAtIso: new Date().toISOString(), updatedAtIso: new Date().toISOString() }, { merge: true }); } catch (e) {}
}
export async function copyProspectEmail(id) {
  const r = queueRows.find(x => x.id === id); if (!r || !r.prospectEmail) return;
  try { await navigator.clipboard.writeText(r.prospectEmail); toast(`Copied ${r.prospectEmail}`); }
  catch (e) { toast(`Couldn't copy — the address is ${r.prospectEmail}`, true); }
}
export async function markCheckInSent(id, undo) {
  const btn = clickedButton();
  const db = fbDb(); if (!db) return;
  const r = queueRows.find(x => x.id === id); if (!r) return;
  let by = '';
  if (!undo) { const sel = document.querySelector(`.checkin-agent[data-id="${CSS.escape(id)}"]`); by = (sel && sel.value) || ''; if (!by) { toast('Pick which leasing manager sent it', true); return; } if (!confirm(`Mark ${r.prospect}'s check-in as sent by ${by}?`)) return; try { localStorage.setItem('ld_agent', by); } catch (e) {} }
  if (!undo) await rowLeaving(btn);
  try {
    await db.collection('tours').doc(id).set({ checkInSentAtIso: undo ? null : new Date().toISOString(), checkInSentBy: undo ? '' : by.trim(), updatedAtIso: new Date().toISOString() }, { merge: true });
    toast(undo ? `Reopened check-in for ${r.prospect}` : `Check-in marked sent for ${r.prospect} — it's in History`);
  } catch (e) { console.error(e); toast('Not saved — ' + (e.message || e) + '. Check the connection and try again.', true); renderTourQueue(); }
}
export function setQueueTab(t) { queueTab = t; document.getElementById('queuePanel').classList.add('open'); renderTourQueue(); }
export async function deleteQueueTour(id) {
  const r = queueRows.find(x => x.id === id);
  const label = r ? `${r.prospect || '(no name)'}${r.assistant ? ' · ' + r.assistant : ''}` : 'this tour';
  const btn = clickedButton();
  if (!confirm(`Delete ${label}? This can't be undone.`)) return;
  const db = fbDb(); if (!db) return;
  await rowLeaving(btn);
  try { await db.collection('tours').doc(id).delete(); if (state.activeTour && state.activeTour.id === id) state.activeTour = null; toast(`Deleted ${label}`); }
  catch (e) { console.error(e); toast('Not deleted — ' + (e.message || e), true); renderTourQueue(); }
}
export async function queueAssign(id, assistant) {
  const db = fbDb(); if (!db) return;
  try { await db.collection('tours').doc(id).set({ assistant: assistant || '', updatedAtIso: new Date().toISOString() }, { merge: true }); }
  catch (e) { console.error(e); toast('Assign failed: ' + (e.message || e), true); }
}
// Starting with someone who is still on another tour today: ask first (often that tour just wasn't finished)
export function confirmBusyStart(assistant, prospect, id) {
  const b = busyNow(queueRows, id)[assistant]; if (!b) return true;
  return confirm(`${assistant} is still on ${b.kind === 'inspection' ? 'an inspection' : 'a tour'} with ${b.prospect || 'someone'} (started ${clockTime(b.startedAtIso)}).\n\nStart ${prospect || 'this one'} with ${assistant} anyway? If that one is over, finish it first so the wait estimates stay right.`);
}
export async function queueStart(id) {
  const btn = clickedButton();
  const r = queueRows.find(x => x.id === id); if (!r) return;
  if (!(r.stops || []).length) { toast('Add units before starting: use Pick units here, or pick them on the iPad.', true); return; }
  const sel = document.querySelector(`.queue-assign[data-id="${CSS.escape(id)}"]`);
  const assistant = (sel && sel.value) || r.assistant || '';
  if (!assistant) { toast('Pick a leasing assistant first', true); return; }
  if (!confirmBusyStart(assistant, r.prospect, id)) return;
  const db = fbDb(); if (!db) return;
  await withBusy(btn, 'Starting…', async () => {
    try {
      await db.collection('tours').doc(id).set({ assistant, startedAtIso: new Date().toISOString(), updatedAtIso: new Date().toISOString() }, { merge: true });
      toast(`Started ${r.prospect} · ${assistant}`);
    } catch (e) { console.error(e); toast('Not started — ' + (e.message || e) + '. Check the connection and try again.', true); }
  });
}
export async function queueRestartNow(id) {
  const r = queueRows.find(x => x.id === id); if (!r) return;
  if (!confirm(`Reset ${r.prospect}'s start time to now (${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})? Units and details stay as they are.`)) return;
  const db = fbDb(); if (!db) return;
  const now = new Date().toISOString();
  try { await db.collection('tours').doc(id).set({ createdAtIso: now, queuedAtIso: now, startedAtIso: now, finishedAtIso: null, updatedAtIso: now }, { merge: true }); toast(`${r.prospect} now counts as started today`); }
  catch (e) { console.error(e); toast('Update failed: ' + (e.message || e), true); }
}
export async function queueFinish(id) {
  const r = queueRows.find(x => x.id === id); if (!r) return;
  const insp = r.kind === 'inspection';
  const btn = clickedButton();
  if (!confirm(`Finish ${insp ? 'inspection' : 'tour'} for ${r.prospect}?${insp ? '' : ' It moves to Follow-Ups to Send.'}`)) return;
  const db = fbDb(); if (!db) return;
  await rowLeaving(btn);
  try { await db.collection('tours').doc(id).set({ finishedAtIso: new Date().toISOString(), updatedAtIso: new Date().toISOString() }, { merge: true }); toast(insp ? `Finished ${r.prospect}` : `Finished ${r.prospect} — now in Follow-Ups to Send`); }
  catch (e) { console.error(e); toast('Not finished — ' + (e.message || e) + '. Check the connection and try again.', true); renderTourQueue(); }
}
export async function markFollowUpSent(id, undo) {
  const btn = clickedButton();
  const db = fbDb(); if (!db) return;
  const r = queueRows.find(x => x.id === id); if (!r) return;
  let by = '';
  if (!undo) { by = prompt('Sent by (leasing assistant):', r.assistant || ''); if (by === null) return; }
  if (!undo) await rowLeaving(btn);
  try {
    await db.collection('tours').doc(id).set({ followUpSentAtIso: undo ? null : new Date().toISOString(), followUpSentBy: undo ? '' : by.trim(), updatedAtIso: new Date().toISOString() }, { merge: true });
    toast(undo ? `Reopened ${r.prospect}` : `Marked ${r.prospect} as sent — now in Leasing Manager Check-In`);
  } catch (e) { console.error(e); toast('Not saved — ' + (e.message || e) + '. Check the connection and try again.', true); renderTourQueue(); }
}
export function watchTourQueue() {
  const db = fbDb(); if (!db) return;
  // 30 days / up to 800 tours: at ~125 tours a week this keeps every pending follow-up and check-in in view
  // (the old 80-tour cap dropped anything older than a few days once the office got busy)
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
  db.collection('tours').where('updatedAtIso', '>=', cutoff).orderBy('updatedAtIso', 'desc').limit(800)
    .onSnapshot(snap => { deskConn.queueDown = false; queueRows = []; snap.forEach(d => queueRows.push(d.data())); renderTourQueue(); flCaptureFromTours(); },
                err => { console.warn('queue', err); deskConn.queueDown = true; setConn('off'); renderTourQueue(); });
  setInterval(renderTourQueue, 30000);
}
export function renderWaitBar() {
  const bar = document.getElementById('waitBar'); if (!bar) return;
  bar.style.display = '';
  const rot = rotationStats(queueRows, team.assistants);
  const est = estimateWait(queueRows, rot.order.map(p => p.name), rot.out);   // rotation order breaks ties, so it agrees with "next up"
  // With nothing loaded (offline from the start) there's no estimate to show — never a confident "No wait"
  document.getElementById('waitValue').textContent = queueUnknown() ? '—' : waitText(est);
  renderConn();
}
export function toggleQueuePanel() {
  const p = document.getElementById('queuePanel'); const open = !p.classList.contains('open');
  p.classList.toggle('open', open);
  try { localStorage.setItem('ld_queueOpen', open ? '1' : '0'); } catch (e) {}
  renderTourQueue();
}
var lastTabCounts = null;   // a tab lights up briefly when a row just moved into it
// Managers only (unlocked): today's tours and inspections per assistant, with a team row
function todayTotalsHtml() {
  const { list, team: all } = todayTotals(queueRows, team.assistants, outToday());
  const cells = p => `<td>${p.tours}</td><td>${p.insp}</td><td><strong>${p.tours + p.insp}</strong></td><td>${p.now}</td><td>${p.done}</td>`;
  return `<div class="queue-section" style="margin-top:16px;">Today's totals <span class="count">(managers only)</span></div>
    <div style="overflow-x:auto;"><table class="totals-table"><tr><th>Assistant</th><th>Tours</th><th>Inspections</th><th>Total</th><th>On one now</th><th>Finished</th></tr>
      ${list.map(p => `<tr><th scope="row">${escapeHtml(p.name)}</th>${cells(p)}</tr>`).join('')}
      <tr class="team"><th scope="row">Team</th>${cells(all)}</tr></table></div>`;
}
export function renderTourQueue() {
  renderWaitBar();
  const body = document.getElementById('queueBody'), meta = document.getElementById('queueMeta'), tabs = document.getElementById('queueTabs'); if (!body) return;
  const isOpen = document.getElementById('queuePanel').classList.contains('open');
  const tg = document.getElementById('queueToggle'); if (tg) { tg.textContent = isOpen ? 'Hide' : 'Show'; tg.setAttribute('aria-expanded', String(isOpen)); }
  const today = new Date().toDateString();
  const isToday = r => new Date(r.createdAtIso).toDateString() === today;
  const dayLabel = r => isToday(r) ? '' : ` · ${new Date(r.createdAtIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const isInsp = r => r.kind === 'inspection';
  // Current Queue: not finished yet — waiting for an assistant, or in progress — in arrival order. Planning-only tours stay on the iPad.
  // Follow-ups to send: finished tours, no follow-up sent yet, oldest first.
  // Agent check-in: follow-up sent, second touch not yet; due the day after the follow-up went out
  const { queue, followup, checkin } = queueBuckets(queueRows);
  const daysSinceFU = r => daysSinceFollowUp(r);
  const dueLabel = r => { const d = daysSinceFU(r), t = checkInDueText(d); return d <= 0 ? t : d === 1 ? `<strong style="color:var(--accent);">${t}</strong>` : `<strong style="color:var(--red);">${t}</strong>`; };
  const dueCount = checkin.filter(r => daysSinceFU(r) >= 1).length;
  const waitingN = queue.filter(r => !r.startedAtIso).length;
  if (deskConn.queueDown) { meta.textContent = '— unavailable: no connection to the database'; meta.classList.add('is-down'); }
  else { meta.classList.remove('is-down'); meta.textContent = `— ${queue.length} in queue (${waitingN} waiting) · ${followup.length} follow-up${followup.length===1?'':'s'} to send · ${dueCount} check-in${dueCount===1?'':'s'} due${flDueCount() ? ` · ${flDueCount()} future move-in${flDueCount() === 1 ? '' : 's'} to follow up` : ''}`; }
  const rot = rotationStats(queueRows, team.assistants);
  const busy = busyNow(queueRows);
  const nextUp = queueUnknown() ? '' : suggestNext(rot, busy);
  const futureOpen = futureLeads.filter(l => l.status === 'open').length, flDue = flDueCount();
  const due = n => n ? ` · <span class="due">${n} due</span>` : '';
  tabs.style.display = '';
  tabs.innerHTML = [['queue', `Current Queue (${queue.length})`], ['followup', `Follow-Ups to Send (${followup.length})`], ['checkin', `Leasing Manager Check-In (${checkin.length}${due(dueCount)})`], ['future', `Future Move-Ins (${futureOpen}${due(flDue)})`], ['rotation', `Rotation${nextUp ? ' · next: ' + escapeHtml(nextUp) : ''}`], ['history', 'History']]
    .map(([k, l]) => `<button role="tab" aria-selected="${queueTab === k}" class="${queueTab === k ? 'on' : ''}" data-tab="${k}" onclick="setQueueTab('${k}')">${l}</button>`).join('');
  const counts = { followup: followup.length, checkin: checkin.length, future: futureOpen };
  if (lastTabCounts && Date.now() - state.lastRowMoveAt < 5000) Object.keys(counts).forEach(k => { if (k !== queueTab && counts[k] > lastTabCounts[k]) { const b = tabs.querySelector(`[data-tab="${k}"]`); if (b) b.classList.add('bump'); } });
  lastTabCounts = counts;
  const brokerTxt = r => r.broker ? ` · broker${r.brokerLast ? ': ' + escapeHtml([r.brokerFirst, r.brokerLast].filter(Boolean).join(' ')) : ''}` : '';
  const kindTag = r => `<span class="flag ${isInsp(r) ? 'insp' : 'tour'}">${isInsp(r) ? 'Inspection' : 'Tour'}</span>`;
  const assignSel = r => `<select class="queue-assign row-select" aria-label="Leasing assistant for ${escapeHtml(r.prospect || '')}" data-id="${escapeHtml(r.id)}" onchange='queueAssign(${jsArg(r.id)}, this.value)'><option value="">Pick assistant…</option>${team.assistants.map(a => `<option value="${escapeHtml(a)}" ${a === (r.assistant || nextUp) ? 'selected' : ''}>${escapeHtml(a)}${!r.assistant && a === nextUp ? ' (suggested next)' : busy[a] ? ` (on ${busy[a].kind === 'inspection' ? 'an inspection' : 'a tour'} · ${busyLabel(busy[a])})` : ''}</option>`).join('')}</select>`;
  const who = r => `${kindTag(r)}${escapeHtml(r.prospect || '(no name)')} ${(queueTab === 'queue' && !r.startedAtIso) ? assignSel(r) : `<span style="font-weight:400; color:${r.assistant ? 'var(--ink-soft)' : 'var(--gold-ink)'};">· ${r.assistant ? escapeHtml(r.assistant) : 'unassigned'}</span>`}`;
  const sub = r => isInsp(r)
    ? `${escapeHtml(bldgTitle((r.stops[0]||{}).building))} #${escapeHtml((r.stops[0]||{}).unit || '')}`
    : `${(r.stops||[]).length ? (r.stops||[]).map(s => '#' + escapeHtml(String(s.unit))).join(', ') : 'no units yet'}${brokerTxt(r)}${r.profile && profileSummary(r.profile) ? `<div class="prof-line">${escapeHtml(profileSummary(r.profile))}</div>` : ''}`;
  const mins = iso => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  const firstWaitingId = (queue.find(r => !r.startedAtIso) || {}).id;
  const row = (r, i) => {
    let when, action, late = '';
    const id = jsArg(r.id);
    const openBtn = isInsp(r) ? '' : `<button class="tiny" onclick='queueOpen(${id})'>Open</button>`;
    if (queueTab === 'followup') { when = `finished ${clockTime(r.finishedAtIso)}${dayLabel({createdAtIso: r.finishedAtIso})}`; action = `${openBtn}<button class="tiny primary" onclick='markFollowUpSent(${id})'>✓ Mark sent</button>`; }
    else if (queueTab === 'checkin') { when = `follow-up sent ${clockTime(r.followUpSentAtIso)}${dayLabel({createdAtIso: r.followUpSentAtIso})}${r.followUpSentBy ? ' by ' + escapeHtml(r.followUpSentBy) : ''} · ${dueLabel(r)}`; action = `<button class="tiny" onclick='copyCheckIn(${id})'>Copy check-in</button><select class="checkin-agent row-select" aria-label="Sent by" data-id="${escapeHtml(r.id)}">${AGENTS.map(a => `<option value="${a}" ${a === (localStorage.getItem('ld_agent') || AGENTS[0]) ? 'selected' : ''}>${a}</option>`).join('')}</select><button class="tiny primary" onclick='markCheckInSent(${id})'>✓ Mark sent</button>`; }
    else if (startedOnEarlierDay(r, today)) {
      when = `<span class="pill is-late">Started ${new Date(r.startedAtIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${clockTime(r.startedAtIso)}</span>`;
      late = `<div class="late-line">Still open from an earlier day — Restart timer if it's happening now; otherwise Finish or Delete.</div>`;
      action = `${openBtn}<button class="tiny" onclick='queueRestartNow(${id})' title="Reset the start time to right now, keeping the prospect, units and criteria">Restart timer</button><button class="tiny primary" onclick='queueFinish(${id})'>Finish</button>`;
    }
    else if (r.startedAtIso) { when = `<span class="pill is-live">In progress · since ${clockTime(r.startedAtIso)}</span>`; action = `${openBtn}<button class="tiny primary" onclick='queueFinish(${id})'>Finish</button>`; }
    else {
      when = `<span class="pill is-wait">Waiting · ${mins(r.queuedAtIso)} min</span> queued ${clockTime(r.queuedAtIso)}${r.headsUpSentAtIso ? ' · <span class="sent-tag">heads-up ' + clockTime(r.headsUpSentAtIso) + '</span>' : ''}${dayLabel(r)}`;
      const heads = `<button class="tiny ghost" title="${r.prospectEmail ? 'Copies the note; email: ' + escapeHtml(r.prospectEmail) : 'Copies the note (no email on file — ask for it)'}" onclick='copyHeadsUp(${id})'>Copy 10-min heads-up</button>${r.prospectEmail ? `<button class="tiny ghost" title="${escapeHtml(r.prospectEmail)}" onclick='copyProspectEmail(${id})'>Copy email</button>` : ''}`;
      action = (isInsp(r) || (r.stops || []).length)
        ? `${heads}${openBtn}<button class="tiny primary" onclick='queueStart(${id})'>Start ${isInsp(r) ? 'inspection' : 'tour'}</button>`
        : `${heads}<button class="tiny primary" onclick='queueOpen(${id})' title="No units yet — opens it in the Email Builder to pick them">Pick units</button>`;
    }
    let panel = '', waitToggle = '';
    if (queueTab === 'queue' && !r.startedAtIso) {
      const rotNow = rotationStats(queueRows, team.assistants);
      const html = waitPanelHtml(r, queueRows, rotNow.order.map(p => p.name), rotNow.out, escapeHtml, false);
      const first = r.id === firstWaitingId, open = waitPanelOpen(r.id, first);
      panel = open ? html : '';
      waitToggle = `<div><button class="wp-toggle" aria-expanded="${open}" onclick='toggleWaitPanel(${id}, ${first})'>${open ? '▾ Hide wait estimate' : '▸ Wait estimate: ' + waitHeadline(html)}</button></div>`;
    }
    return `<div class="queue-row ${state.activeTour && state.activeTour.id === r.id ? 'active-tour' : ''}">
      <div class="n">${i + 1}</div>
      <div><div class="who">${who(r)}</div><div class="sub">${sub(r)}</div>${late}${waitToggle}</div>
      <div class="when">${when}</div>
      <div class="acts">${action}<button class="queue-del" onclick='deleteQueueTour(${id})'>Delete</button></div>
    </div>${panel}`;
  };
  if (queueTab === 'future') { body.innerHTML = renderFutureLeads(); return; }
  if (queueTab === 'rotation') {
    if (queueUnknown()) { body.innerHTML = `<div class="empty">Rotation needs today’s tours — ${deskConn.queueDown ? 'reload the page once the connection is back' : 'it fills in when the connection is back'}.</div>`; return; }
    const fmtD = k => { const [y,m,d] = k.split('-'); return new Date(+y, +m-1, +d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }); };
    body.innerHTML = `
      <div class="queue-section">Today</div>
      <div class="queue-note" style="margin-bottom:4px;">Suggested next up: <strong style="color:var(--accent);">${escapeHtml(nextUp || '—')}</strong> — fewest today, then longest since their last start, skipping anyone on a tour right now. Anyone can override.</div>
      ${rot.order.map((p, i) => { const isOut = rot.out.includes(p.name); return `<div class="queue-row ${isOut ? 'sent' : ''}" style="grid-template-columns: 28px minmax(0, 1fr) auto auto;">
        <div class="n">${isOut ? '–' : i + 1}</div>
        <div><div class="who">${escapeHtml(p.name)}${isOut ? ` <span class="flag">${scheduledToday(p.name) ? 'Out today' : 'Not scheduled'}</span>` : (p.name === nextUp ? ' <span class="flag next">Next up</span>' : '')}</div><div class="sub">${busy[p.name] ? `on ${busy[p.name].kind === 'inspection' ? 'an inspection' : 'a tour'} · ${busyLabel(busy[p.name])}` : p.lastStart ? 'last started ' + clockTime(p.lastStart) : 'nothing started today'}</div></div>
        <div class="when"><strong>${rot.total(p)}</strong> · ${p.today.tours} tour${p.today.tours===1?'':'s'} · ${p.today.insp} inspection${p.today.insp===1?'':'s'}</div>
        <div class="acts"><button class="tiny" onclick='toggleOut(${jsArg(p.name)})'>${isOut ? 'Mark back in' : 'Mark out'}</button></div>
      </div>`; }).join('')}
      <div class="queue-section" style="margin-top:16px;">Last 7 days <span class="count">(tours / inspections)</span></div>
      <div style="overflow-x:auto;"><table style="border-collapse:collapse; font-size:12px; width:100%; font-variant-numeric:tabular-nums;">
        <tr><th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--line);">Assistant</th>${rot.days.map(k => `<th style="padding:6px 8px; border-bottom:1px solid var(--line); color:${k === rot.today ? 'var(--accent)' : 'var(--ink-soft)'}; font-weight:${k === rot.today ? 700 : 500};">${fmtD(k)}</th>`).join('')}<th style="padding:6px 8px; border-bottom:1px solid var(--line);">Total</th></tr>
        ${rot.list.slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => { const wk = rot.days.reduce((acc, k) => ({ t: acc.t + p.byDay[k].tours, i: acc.i + p.byDay[k].insp }), { t: 0, i: 0 }); return `<tr><td style="padding:6px 8px; border-bottom:1px solid var(--line-soft); font-weight:600;">${escapeHtml(p.name)}</td>${rot.days.map(k => { const c = p.byDay[k]; return `<td style="text-align:center; padding:6px 8px; border-bottom:1px solid var(--line-soft); color:${c.tours + c.insp ? 'var(--ink)' : 'var(--line)'};">${c.tours + c.insp ? `${c.tours} / ${c.insp}` : '·'}</td>`; }).join('')}<td style="text-align:center; padding:6px 8px; border-bottom:1px solid var(--line-soft); font-weight:600;">${wk.t + wk.i} <span style="font-weight:400; color:var(--ink-soft);">(${wk.t} / ${wk.i})</span></td></tr>`; }).join('')}
      </table></div>
      ${state.trainingUnlocked ? todayTotalsHtml() : ''}
      <div class="queue-section" style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;"><span>Leasing assistants &amp; weekly schedule</span>${state.trainingUnlocked ? `<button class="tiny ghost" onclick="lockManager()">Lock</button>` : `<button class="tiny" onclick="unlockManager()">Unlock with PIN</button>`}</div>
      <div class="queue-note" style="margin-bottom:6px;">Manager only. Unscheduled days count as out automatically; Mark out / Mark back in above still work for anyone.</div>
      ${!state.trainingUnlocked ? `<div class="empty">Locked. Unlock with the manager PIN to change who's on the team or which days they work.</div>` : `<table style="border-collapse:collapse; font-size:12px;">
        <tr><th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--line);">Assistant</th>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<th style="padding:6px 10px; border-bottom:1px solid var(--line); color:${i === new Date().getDay() ? 'var(--accent)' : 'var(--ink-soft)'};">${d}</th>`).join('')}<th style="border-bottom:1px solid var(--line);"></th></tr>
        ${team.assistants.map(n => `<tr><td style="padding:6px 8px; border-bottom:1px solid var(--line-soft); font-weight:600;">${escapeHtml(n)}</td>${[0,1,2,3,4,5,6].map(dd => `<td style="text-align:center; padding:4px 10px; border-bottom:1px solid var(--line-soft);"><input type="checkbox" aria-label="${escapeHtml(n)} works ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dd]}" ${(!schedule[n] || schedule[n].includes(dd)) ? 'checked' : ''} onchange='setScheduleDay(${jsArg(n)}, ${dd}, this.checked)'></td>`).join('')}<td style="padding:4px 8px; border-bottom:1px solid var(--line-soft);"><button class="queue-del" onclick='removeAssistantDesk(${jsArg(n)})'>Remove</button></td></tr>`).join('')}
      </table>
      <div class="row" style="gap:8px; margin-top:10px; align-items:center;"><input type="text" id="newAssistantName" placeholder="Add a leasing assistant" aria-label="New leasing assistant name" style="max-width:260px;" onkeydown="if(event.key==='Enter') addAssistantDesk()"><button class="tiny" onclick="addAssistantDesk()">Add</button></div>`}`;
    return;
  }
  if (queueTab === 'history') { renderHistory(); return; }
  if (queueTab === 'queue') {
    if (!queue.length) {
      body.innerHTML = deskConn.queueDown
        ? '<div class="empty">Can’t load the queue — no connection to the database. Reload the page once the connection is back.</div>'
        : '<div class="empty">Nobody waiting and no tours in progress. Tours and inspections sent to the queue or started on the iPads appear here in arrival order.<div class="empty-actions"><button class="tiny primary" onclick="openPlanTour()">+ Plan tour</button></div></div>';
      return;
    }
    const { waiting, onTour, earlier } = splitCurrentQueue(queue, today);
    const sec = (title, list, cls) => list.length ? `<div class="queue-section ${cls || ''}">${title} <span class="count">(${list.length})</span></div>` + list.map(row).join('') : '';
    body.innerHTML = (waiting.length ? sec('Waiting', waiting) : '<div class="queue-section">Waiting <span class="count">(0)</span></div><div class="queue-note" style="padding:2px 0 8px;">Nobody waiting.</div>')
      + sec('On tour now', onTour) + sec('Started on an earlier day', earlier, 'is-late');
    return;
  }
  const list = queueTab === 'followup' ? followup : checkin;
  const empty = queueTab === 'followup' ? 'All caught up — no follow-ups to send. Finished tours land here until they’re marked sent.' : 'No check-ins pending. Tours land here once their follow-up is marked sent, due the next day.';
  body.innerHTML = list.length ? list.map(row).join('') : `<div class="empty">${empty}</div>`;
}
export function queueOpen(id) { applyTour(id, queueRows); }
