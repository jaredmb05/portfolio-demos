// Tour times by day (managers only; production Desk v1.22–v1.23, D24, D25; part of Reports since v1.28): the typical
// tour length and tours started for each assistant, day by day, with a Week column; ‹ › steps back through the last 8 weeks.
// The tours are read once when Reports opens (the same read gives Reports its numbers), not on every redraw; tours only.
// What counts and the median are in rules/tour-times.js. Leave out / Count it again is the only thing saved here.
import { clockTime } from '../../shared/dates.js';
import { escapeHtml, jsArg } from '../../shared/html.js';
import { fbDb } from './firebase.js';
import { patchHistoryRow } from './history.js';
import { queueRows, renderTourQueue } from './queue.js';
import { renderReports } from './reports.js';
import { REPORT_MAX_TOURS } from './rules/reports.js';
import { fmtMinutes, tourTimeStatus, TREND_MAX_MIN, TREND_MIN_MIN, TREND_WEEKS, typicalMinutes, weekStartOf } from './rules/tour-times.js';
import { state } from './state.js';
import { toast } from './ui.js';

// rows: the tours read (null = not read yet) · status: '' | 'loading' | 'error' · pick: the cell whose tours are listed,
// { name ('' = Team), day (0–6 = Mon–Sun, 7 = Week) } · week: 0 = this week, 1 = last week…
export const tourTimes = { rows: null, status: '', loadedAt: '', pick: null, week: 0 };

// 8 weeks plus the week before the oldest, so every week shown has its change from the week before. A tour started in
// the period always has updatedAtIso on or after its start, so the read is complete (up to its limit).
export async function loadWeeklyTrends() {
  const db = fbDb(); if (!db) { tourTimes.status = 'error'; renderReports(); return; }
  tourTimes.status = 'loading'; renderReports();
  try {
    const from = weekStartOf(new Date()); from.setDate(from.getDate() - 7 * TREND_WEEKS);
    const snap = await db.collection('tours').where('updatedAtIso', '>=', from.toISOString()).orderBy('updatedAtIso', 'desc').limit(REPORT_MAX_TOURS).get();
    const rows = []; snap.forEach(d => rows.push(d.data()));
    tourTimes.rows = rows; tourTimes.status = ''; tourTimes.loadedAt = new Date().toISOString();
  } catch (e) { console.error(e); tourTimes.status = 'error'; }
  renderReports();
}
// Leave one tour out of tour times (or count it again). The tour itself, its count, History and follow-ups are untouched.
export async function setTimeExcluded(id, on) {
  const r = (tourTimes.rows || []).find(x => x.id === id); if (!r || !state.trainingUnlocked) return;
  const db = fbDb(); if (!db) return;
  let by = '';
  if (on) {
    let last = ''; try { last = localStorage.getItem('ld_agent') || ''; } catch (e) {}
    by = prompt(`Leave ${r.prospect || 'this'}'s tour out of tour times? It still counts as a tour and stays in History.\n\nYour name:`, last); if (by === null) return;
  }
  const patch = { timeExcluded: !!on, timeExcludedBy: on ? by.trim() : '', timeExcludedAtIso: on ? new Date().toISOString() : null };
  try {
    // updatedAtIso is left alone on purpose: bumping it would pull an old tour back into the Desk's 30-day lists
    await db.collection('tours').doc(id).set(patch, { merge: true });
    Object.assign(r, patch); const q = queueRows.find(x => x.id === id); if (q) Object.assign(q, patch); patchHistoryRow(id, patch);
    toast(on ? `${r.prospect || 'The tour'} is left out of tour times.` : `${r.prospect || 'The tour'} counts in tour times again.`);
  } catch (e) {
    console.error(e);
    // The rules refuse this save when the tour was deleted after the list was loaded (no tour is created from the note alone)
    let gone = false;
    try { gone = !(await db.collection('tours').doc(id).get()).exists; } catch (e2) {}
    toast(gone ? 'This tour was deleted, so it can’t be left out. Click Refresh to update the list.' : 'Not saved — ' + String(e.message || e).replace(/\.$/, '') + '. Check the connection and try again.', true);
  }
  renderTourQueue(); renderReports();
}
export function weekNav(step) { tourTimes.week = Math.min(TREND_WEEKS - 1, Math.max(0, tourTimes.week + step)); tourTimes.pick = null; renderReports(); }
export function pickCell(name, day) { const p = tourTimes.pick; tourTimes.pick = p && p.name === name && p.day === day ? null : { name, day }; renderReports(); }
export function closeWeekPick() { tourTimes.pick = null; renderReports(); }

export function weeklyTrendsHtml() {
  const head = `<figcaption><div><h3 class="rpt-h">Tour times by day</h3><p class="rpt-note">How long each assistant’s tours take, day by day (all buildings).<span class="rpt-screen"> One week at a time: ‹ › goes back up to ${TREND_WEEKS} weeks, whatever the period above.</span></p></div></figcaption>`;
  const rowsIn = tourTimes.rows;
  if (!rowsIn) return head + (tourTimes.status === 'error' ? `<div class="empty">Couldn’t load the tour times. Check the connection, then <button class="tiny" onclick="loadWeeklyTrends()">Try again</button></div>` : `<div class="empty">Loading the last ${TREND_WEEKS} weeks…</div>`);
  const ws = weekStartOf(new Date()); ws.setDate(ws.getDate() - 7 * tourTimes.week);   // Monday of the week shown
  const prevWs = new Date(ws); prevWs.setDate(prevWs.getDate() - 7);
  const days = [...Array(7)].map((_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d; });
  const blank = () => ({ n: 0, lens: [], out: 0, rows: [] });
  const group = () => ({ days: days.map(blank), week: blank(), prev: blank() });
  const by = {}, team = group();
  rowsIn.filter(r => r && r.kind !== 'inspection' && r.assistant && typeof r.startedAtIso === 'string' && !isNaN(new Date(r.startedAtIso))).forEach(r => {
    const w = weekStartOf(r.startedAtIso).getTime(), st = tourTimeStatus(r);
    const add = c => { c.n++; c.rows.push(r); if (st.ok) c.lens.push(st.len); if (st.out) c.out++; };
    const gs = [by[r.assistant] = by[r.assistant] || group(), team];
    if (w === ws.getTime()) { const di = (new Date(r.startedAtIso).getDay() + 6) % 7; gs.forEach(g => { add(g.days[di]); add(g.week); }); }
    else if (w === prevWs.getTime()) gs.forEach(g => add(g.prev));
  });
  const names = Object.keys(by).filter(n => by[n].week.n).sort((a, b) => a.localeCompare(b));
  const typ = c => typicalMinutes(c.lens);
  const fmtD = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const span = `${fmtD(days[0])} – ${fmtD(days[6])}`, wk = tourTimes.week, pick = tourTimes.pick;
  const nav = `<div class="wk-nav"><button class="tiny" data-rkey="wk-prev" onclick="weekNav(1)" aria-label="Previous week"${wk >= TREND_WEEKS - 1 ? ' disabled' : ''}>‹</button><strong>${wk === 0 ? 'This week · ' + span : span}</strong><button class="tiny" data-rkey="wk-next" onclick="weekNav(-1)" aria-label="Next week"${wk === 0 ? ' disabled' : ''}>›</button></div>`;
  const outWhy = `Finished on a later day, under ${TREND_MIN_MIN} minutes, over ${TREND_MAX_MIN / 60} hours, or left out by a manager`;
  const cell = (c, name, day, extra) => {
    if (!c.n) return `<td class="wk-none${day === 7 ? ' wk-week' : ''}">—</td>`;
    const a = typ(c), on = !!pick && pick.name === name && pick.day === day;
    return `<td${day === 7 ? ' class="wk-week"' : ''}><button class="wk-cell${on ? ' on' : ''}" data-rkey="${escapeHtml('wk-' + name + '-' + day)}" aria-expanded="${on}" title="Show the tours behind this number" onclick='pickCell(${jsArg(name)}, ${day})'><strong>${a !== null ? fmtMinutes(a) : '—'}</strong><span class="wk-sub">${c.n} tour${c.n === 1 ? '' : 's'}${c.out ? ` · <span title="${outWhy}">${c.out} left out</span>` : ''}${extra || ''}</span></button></td>`;
  };
  const change = g => { const a = typ(g.week), p = typ(g.prev); if (a === null || p === null) return ''; const d = a - p; return d === 0 ? ' · same' : ` · <span title="${Math.abs(d)} min ${d > 0 ? 'longer' : 'shorter'} than the week before">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} min</span>`; };
  const row = (label, g, name) => `<tr${name === '' ? ' class="team"' : ''}><th scope="row">${escapeHtml(label)}</th>${g.days.map((c, i) => cell(c, name, i)).join('')}${cell(g.week, name, 7, change(g))}</tr>`;
  const headRow = `<tr><th>Assistant</th>${days.map(d => `<th>${d.toLocaleDateString('en-US', { weekday: 'short' })}<span class="wk-sub">${fmtD(d)}</span></th>`).join('')}<th class="wk-week">Week</th></tr>`;
  const table = names.length ? `<div class="rpt-tablewrap"><table class="totals-table weekly-table">${headRow}${names.map(n => row(n, by[n], n)).join('')}${row('Team', team, '')}</table></div>` : `<div class="empty">No tours started this week.</div>`;
  const left = team.week.out;
  // The tours behind the picked cell, with why each one counts or not, and Leave out / Count it again
  let review = '';
  const pg = pick ? (pick.name ? by[pick.name] : team) : null, picked = pg && (pick.day === 7 ? pg.week : pg.days[pick.day]);
  if (picked && picked.n) {
    const day = iso => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const isTeam = !pick.name;
    const when = pick.day === 7 ? 'week of ' + fmtD(days[0]) : days[pick.day].toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    review = `<div class="wk-review">
      <div class="queue-section" style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;"><span>${escapeHtml(pick.name || 'Team')} · ${when} <span class="count">(${picked.n} tour${picked.n === 1 ? '' : 's'})</span></span><button class="tiny ghost" data-rkey="wk-close" onclick="closeWeekPick()">Close</button></div>
      <div class="rpt-tablewrap"><table class="totals-table wk-review-table"><tr><th>Day</th><th>Prospect</th>${isTeam ? '<th>Assistant</th>' : ''}<th>Start</th><th>Finish</th><th>Length</th><th>Counts in tour times?</th><th><span class="sr-only">Action</span></th></tr>
        ${picked.rows.slice().sort((a, b) => a.startedAtIso < b.startedAtIso ? -1 : 1).map(r => { const st = tourTimeStatus(r), id = jsArg(r.id); return `<tr>
          <td class="nw">${day(r.startedAtIso)}</td><td>${escapeHtml(r.prospect || '(no name)')}</td>${isTeam ? `<td>${escapeHtml(r.assistant)}</td>` : ''}
          <td class="nw">${clockTime(r.startedAtIso)}${r.startCorrectedFromIso ? ` <span title="Start time chosen at Finish (Start was tapped at ${clockTime(r.startCorrectedFromIso)})">· set at Finish</span>` : ''}</td><td class="nw">${r.finishedAtIso ? clockTime(r.finishedAtIso) + (st.why === 'finished on a later day' ? ', ' + day(r.finishedAtIso) : '') : '—'}</td>
          <td class="nw">${st.len !== null ? fmtMinutes(st.len) : '—'}</td>
          <td>${st.ok ? 'Yes' : `No: ${st.why}${r.timeExcluded && r.timeExcludedBy ? ` (${escapeHtml(r.timeExcludedBy)})` : ''}`}</td>
          <td>${r.timeExcluded ? `<button class="tiny" data-rkey="${escapeHtml('wkx-' + r.id)}" onclick='setTimeExcluded(${id}, false)'>Count it again</button>` : st.ok ? `<button class="tiny ghost" data-rkey="${escapeHtml('wkx-' + r.id)}" onclick='setTimeExcluded(${id}, true)'>Leave out of tour times</button>` : ''}</td></tr>`; }).join('')}
      </table></div></div>`;
  }
  return head + `<div class="queue-note" style="margin-bottom:6px;">Each box shows that day’s typical tour length, then how many tours were started. “Typical” is the middle tour (half took longer, half less), so one forgotten Finish barely moves it. The Week column covers the whole week, with the change from the week before.<span class="rpt-screen"> Click a box to see its tours.</span></div>
    ${nav}${table}
    <div class="queue-note" style="margin-top:6px;">Tour length counts only tours with a Start and a Finish on the same day, from ${TREND_MIN_MIN} minutes to ${TREND_MAX_MIN / 60} hours.${left ? ` ${left} finished tour${left === 1 ? ' was' : 's were'} left out this week (“left out” in a cell): finished on a later day, under ${TREND_MIN_MIN} minutes (usually Start and Finish tapped together after the tour), over ${TREND_MAX_MIN / 60} hours, or left out by a manager. They still count in tours started.` : ''} Loaded ${clockTime(tourTimes.loadedAt)}.</div>${review}`;
}
