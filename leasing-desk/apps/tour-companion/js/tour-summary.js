// What to show and quote once a tour has started: the summary, building cards and talking points.
import { clockTime } from '../../shared/dates.js';
import { escapeHtml as esc, safeUrl } from '../../shared/html.js';
import { BROKER_NOTE, quoteLines } from '../../shared/pricing.js';
import { profileSummary } from '../../shared/unit-options.js';
import { BUILDING_INFO, BUILDING_ORDER, TALKING_POINTS } from './buildings.js';
import { bldgTitle, bnum, fpKey, stopKey } from './format.js';
import { data, fpMap } from './showsheet-feed.js';
import { state } from './state.js';
import { $ } from './ui.js';

// Summary shown after Start: what's being shown and what to quote, without the picker noise.
export function renderSummary() {
  const box = $('tourSummary'); if (!box) return;
  const byB = {}; state.tour.stops.forEach(s => { (byB[s.building] = byB[s.building] || []).push(s); });
  const bKeys = Object.keys(byB).sort((a,b) => { const ia = BUILDING_ORDER.indexOf(bnum(a)), ib = BUILDING_ORDER.indexOf(bnum(b)); return (ia<0?99:ia) - (ib<0?99:ib); });
  const who = [state.tour.prospect ? `<b>${esc(state.tour.prospect)}</b>` : '', state.tour.assistant ? `with ${esc(state.tour.assistant)}` : '<span style="color:var(--amber-ink)">unassigned</span>', state.tour.broker ? `broker: ${esc([state.tour.brokerFirst, state.tour.brokerLast].filter(Boolean).join(' ') || 'yes')}` : ''].filter(Boolean).join(' · ');
  const needs = profileSummary(state.tour.profile);
  let html = `<section class="bldg"><div class="sum-head">${who}${state.tour.startedAtIso ? ` · started ${esc(clockTime(state.tour.startedAtIso))}` : ''} · ${state.tour.stops.length} unit${state.tour.stops.length===1?'':'s'}${needs ? `<div style="margin-top:4px; color:var(--accent-muted); font-size:13px;">Looking for: ${esc(needs)}</div>` : ''}</div>`;
  for (const b of bKeys) {
    html += `<div class="bed-hdr">${esc(bldgTitle(b))}</div>`;
    for (const st of byB[b]) {
      html += `<div class="sum-unit"><div class="unit-num">#${esc(st.unit)}${st.sqft ? `<small>${esc(st.sqft)} sq ft</small>` : ''}</div>
        <div><div class="unit-type">${esc(st.type)}${st.custom ? ' <span class="flag">Not on showsheet</span>' : ''}${summaryFlags(st)}</div>${st.view ? `<div class="unit-view">${esc(st.view)}</div>` : ''}
        <div style="margin-top:6px;">${quoteHtml(st)}</div>${st.notes ? `<div class="notes">"${esc(st.notes)}"</div>` : ''}${summaryExtra(st)}</div></div>`;
    }
  }
  html += `</section>`;
  if (state.tour.broker) html += `<div class="disclaimer" style="margin:12px 14px 0;">${esc(BROKER_NOTE)}</div>`;
  box.innerHTML = html;
}
// What a prospect asks mid-tour: is someone else applying, when can I move in, can I see the layout?
function summaryFlags(st) {
  const live = (data && data.units || []).find(u => stopKey(u) === st.key) || {};
  return `${(st.hasApp || live.hasApp) ? ' <span class="flag pending">App pending</span>' : ''}${live.priority ? ' <span class="flag pri">Priority</span>' : ''}`;
}
function summaryExtra(st) {
  const live = (data && data.units || []).find(u => stopKey(u) === st.key) || {};
  const avail = st.avail || live.avail || '';
  const fp = safeUrl(fpMap[fpKey(st.building, st.unit)]);
  if (!avail && !fp) return '';
  return `<div class="sum-extra">${avail ? `<span>${/^(immediately|occupied)$/i.test(avail) ? 'Available ' + esc(avail.toLowerCase()) : 'Available ' + esc(avail)}</span>` : ''}${fp ? `<a class="btn sec" href="${esc(fp)}" target="_blank" rel="noopener">Floor plan ↗</a>` : ''}</div>`;
}
// Building amenity cards + talking points for whichever buildings are on the tour.
export function renderTourExtras() {
  if (!state.tour.stops.length) { $('tourBuildings').innerHTML = ''; $('talkingPoints').innerHTML = TALKING_POINTS; return; }
  const byB = {};
  state.tour.stops.forEach(s => { (byB[s.building] = byB[s.building] || []).push(s); });
  const bKeys = Object.keys(byB).sort((a,b) => { const ia = BUILDING_ORDER.indexOf(bnum(a)), ib = BUILDING_ORDER.indexOf(bnum(b)); return (ia<0?99:ia) - (ib<0?99:ib); });
  $('tourBuildings').innerHTML = bKeys.map(b => {
    const i = BUILDING_INFO[bnum(b)]; if (!i) return '';
    return `<section class="bldg-info"><div class="bldg-hdr"><h2>${esc(bldgTitle(b))} — where things are</h2><span class="bldg-count">Opened ${esc(i.opened)}</span></div>
      <dl class="facts">
        <dt>Building</dt><dd>${esc(i.units)}<small>${esc(i.layouts)}</small></dd>
        <dt>Outdoor space</dt><dd>${i.outdoor.map((o,ix) => ix===0 ? esc(o) : `<small>${esc(o)}</small>`).join('')}</dd>
        <dt>Gym</dt><dd>${esc(i.gym)}</dd>
        <dt>Lounge</dt><dd>${esc(i.lounge)}</dd>
        <dt>Laundry</dt><dd>${esc(i.laundry)}</dd>
        ${i.extra ? `<dt>Also</dt><dd>${esc(i.extra)}</dd>` : ''}
      </dl></section>`;
  }).join('');
  $('talkingPoints').innerHTML = TALKING_POINTS;
}
export function quoteHtml(s) {
  const { line1, line2 } = quoteLines(s, state.tour.broker);
  return `<div class="q1">${esc(line1)}</div>${line2 ? `<div class="q2">${esc(line2)}</div>` : ''}`;
}
