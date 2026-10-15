// History tab: started tours and inspections by day, searchable, with Undo for follow-ups and check-ins.
import { ymd } from '../../shared/dates.js';
import { escapeHtml, jsArg } from '../../shared/html.js';
import { profileSummary } from '../../shared/unit-options.js';
import { fbDb } from './firebase.js';
import { applyTour } from './plan-tour.js';
import { queueRows } from './queue.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { bldgTitle } from './units.js';

// ===== History: what was shown to whom, searchable, last 60 days =====
let historyRows = null, historyDays = 14, historyOpenDays = null;
async function loadHistory() {
  const db = fbDb(); if (!db) return;
  const cutoff = new Date(Date.now() - historyDays * 864e5).toISOString();
  try {
    const snap = await db.collection('tours').where('updatedAtIso', '>=', cutoff).orderBy('updatedAtIso', 'desc').limit(2000).get();
    historyRows = []; snap.forEach(d => historyRows.push(d.data()));
    renderHistory();
  } catch (e) {   // offline or refused: say so instead of "Loading history…" forever (B5); history stays unloaded, so reopening retries
    console.error(e);
    const body = document.getElementById('queueBody');
    if (body && /Loading history/.test(body.textContent)) body.innerHTML = '<div class="empty">Couldn\'t load history — no connection to the database. Click History again to try again.</div>';
  }
}
export function historyMore() { historyDays += 14; historyRows = null; renderHistory(); }
export function toggleHistoryDay(k) { historyOpenDays = historyOpenDays || {}; historyOpenDays[k] = !historyOpenDays[k]; renderHistory(); }
export function renderHistory() {
  const body = document.getElementById('queueBody'); if (!body) return;
  if (historyRows === null) { body.innerHTML = '<div class="empty">Loading history…</div>'; loadHistory(); return; }
  // The search bar is built once and left alone while you type; only the list under it redraws (so the cursor stays put)
  if (!document.getElementById('histList')) {
    const whoOpts = [...new Set(historyRows.map(r => r.assistant).filter(Boolean))].sort();
    body.innerHTML = `<div class="row" id="histBar" style="gap:8px; padding:8px 0 4px; flex-wrap:wrap; align-items:center;">
      <input type="text" id="histSearch" placeholder="Search prospect, broker, or unit #" aria-label="Search history" value="${escapeHtml(state.historyQ)}" oninput="historyQ=this.value; renderHistoryList()" style="max-width:320px;">
      <select aria-label="Assistant" onchange="historyWho=this.value; renderHistoryList()" style="width:auto;"><option value="">All assistants</option>${whoOpts.map(n => `<option value="${escapeHtml(n)}" ${n === state.historyWho ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>
      <select aria-label="Tours or inspections" onchange="historyKind=this.value; renderHistoryList()" style="width:auto;"><option value="">Tours & inspections</option><option value="tour" ${state.historyKind === 'tour' ? 'selected' : ''}>Tours only</option><option value="inspection" ${state.historyKind === 'inspection' ? 'selected' : ''}>Inspections only</option></select>
      <span class="meta" id="histCount"></span>
    </div><div id="histList"></div>`;
  }
  renderHistoryList();
}
export function renderHistoryList() {
  const list = document.getElementById('histList'); if (!list || historyRows === null) return;
  const q = state.historyQ.toLowerCase().trim();
  const dayKey = iso => ymd(new Date(iso));
  const when = r => r.startedAtIso || r.createdAtIso;
  const rows = historyRows.filter(r => r.startedAtIso || r.finishedAtIso)
    .filter(r => !state.historyWho || r.assistant === state.historyWho)
    .filter(r => !state.historyKind || (state.historyKind === 'inspection' ? r.kind === 'inspection' : r.kind !== 'inspection'))
    .filter(r => !q || `${r.prospect} ${r.assistant} ${r.brokerLast || ''} ${(r.stops||[]).map(s => s.unit).join(' ')}`.toLowerCase().includes(q))
    .sort((a,b) => when(a) < when(b) ? 1 : -1);
  const byDay = {}; rows.forEach(r => { (byDay[dayKey(when(r))] = byDay[dayKey(when(r))] || []).push(r); });
  const dayKeys = Object.keys(byDay).sort().reverse();
  const today = dayKey(new Date().toISOString());
  if (historyOpenDays === null) historyOpenDays = { [today]: true, [dayKeys[0]]: true };
  const fmtDay = k => { const [y,m,d] = k.split('-'); const dt = new Date(+y, +m-1, +d); return k === today ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const fmtT = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const quote = st => {
    const rent = parseFloat(String(st.rent || st.monthly || '').replace(/[^0-9.]/g,'')) || 0;
    const parts = []; if (rent) parts.push('$' + Math.round(rent).toLocaleString());
    if (st.free) parts.push(`${st.free} mo free`); else if (st.incentive && !/^no incentives?$/i.test(st.incentive)) parts.push(st.incentive);
    if (st.op) parts.push(`${st.op} mo OP`); if (st.credit) parts.push(`$${st.credit} credit`);
    return parts.join(' · ');
  };
  const row = (r, i) => `<div class="queue-row" style="grid-template-columns: 28px minmax(0, 1fr) auto auto;">
        <div class="n">${i + 1}</div>
        <div><div class="who"><span class="flag ${r.kind === 'inspection' ? 'insp' : 'tour'}">${r.kind === 'inspection' ? 'Inspection' : 'Tour'}</span>${escapeHtml(r.prospect || '(no name)')} <span style="font-weight:400; color:var(--ink-soft);">· ${escapeHtml(r.assistant || 'unassigned')}${r.broker ? ' · broker ' + escapeHtml([r.brokerFirst, r.brokerLast].filter(Boolean).join(' ')) : ''}</span></div>
          <div class="sub">${(r.stops||[]).map(st => `#${escapeHtml(String(st.unit))}`).join(', ') || 'no units'}${r.profile && profileSummary(r.profile) ? ' · ' + escapeHtml(profileSummary(r.profile)) : ''}</div></div>
        <div class="when">${fmtT(when(r))}${r.followUpSentAtIso ? ' · <span class="sent-tag">follow-up sent</span>' : r.finishedAtIso ? ' · finished' : ' · not finished'}${r.checkInSentAtIso ? ` · <span class="sent-tag">check-in sent${r.checkInSentBy ? ' by ' + escapeHtml(r.checkInSentBy) : ''} ${new Date(r.checkInSentAtIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>` : ''}</div>
        <div class="acts"><button class="tiny ghost" onclick='toggleMissed(${jsArg('h-' + r.id)})'>Details</button> ${r.kind === 'inspection' ? '' : `<button class="tiny" onclick='queueOpenHistory(${jsArg(r.id)})'>Open</button>`} ${r.checkInSentAtIso ? `<button class="tiny ghost" title="Put it back in Leasing Manager Check-In" onclick='reopenFromHistory(${jsArg(r.id)}, "checkin")'>↩ Undo check-in</button>` : r.followUpSentAtIso ? `<button class="tiny ghost" title="Put it back in Follow-Ups to Send" onclick='reopenFromHistory(${jsArg(r.id)}, "followup")'>↩ Undo follow-up</button>` : ''}</div>
      </div>
      <div id="missed-h-${escapeHtml(r.id)}" style="display:none; padding:4px 0 10px 40px; font-size:12px;">
        ${(r.stops||[]).length ? (r.stops||[]).map(st => `<div style="padding:5px 0; border-top:1px solid var(--line-soft);"><strong>${escapeHtml(bldgTitle(st.building))} #${escapeHtml(String(st.unit))}</strong> · ${escapeHtml(st.type || '')}${quote(st) ? ` — ${escapeHtml(quote(st))}` : ''}${st.notes ? `<div style="color:var(--ink-soft); font-style:italic;">${escapeHtml(st.notes)}</div>` : ''}</div>`).join('') : '<em>No units recorded.</em>'}
      </div>`;
  const cnt = document.getElementById('histCount'); if (cnt) cnt.textContent = `${rows.length} in the last ${historyDays} days`;
  list.innerHTML = (dayKeys.length ? dayKeys.map(k => { const l = byDay[k]; const nT = l.filter(r => r.kind !== 'inspection').length, nI = l.length - nT; const open = !!historyOpenDays[k];
      return `<button type="button" class="queue-section history-day" aria-expanded="${open}" onclick='toggleHistoryDay(${jsArg(k)})'><span>${open ? '▾' : '▸'} ${fmtDay(k)}</span><span class="count">${nT} tour${nT===1?'':'s'}${nI ? ` · ${nI} inspection${nI===1?'':'s'}` : ''}</span></button>${open ? l.map(row).join('') : ''}`; }).join('') : `<div class="empty">${state.historyQ || state.historyWho || state.historyKind ? 'Nothing matches — clear the search or filters.' : 'No tours in the last ' + historyDays + ' days.'}</div>`) +
    `<div style="padding:12px 0 4px;"><button class="tiny" onclick="historyMore()">Load 14 more days</button></div>`;
}
export async function reopenFromHistory(id, which) {
  const r = (historyRows || []).find(x => x.id === id) || queueRows.find(x => x.id === id); if (!r) return;
  const label = which === 'checkin' ? 'Leasing Manager Check-In' : 'Follow-Ups to Send';
  if (!confirm(`Put ${r.prospect} back in ${label}?`)) return;
  const db = fbDb(); if (!db) return;
  const now = new Date().toISOString();
  const patch = which === 'checkin' ? { checkInSentAtIso: null, checkInSentBy: '', updatedAtIso: now } : { followUpSentAtIso: null, followUpSentBy: '', updatedAtIso: now };
  try {
    await db.collection('tours').doc(id).set(patch, { merge: true });
    Object.assign(r, patch); renderHistory();
    toast(`${r.prospect} is back in ${label}`);
  } catch (e) { console.error(e); toast('Update failed: ' + (e.message || e), true); }
}
export function queueOpenHistory(id) { applyTour(id, historyRows); }
