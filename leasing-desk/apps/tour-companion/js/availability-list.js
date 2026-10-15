// Availability tab: the unit list with filters and search.
import { escapeHtml as esc, safeUrl } from '../../shared/html.js';
import { money } from '../../shared/pricing.js';
import { fitsNeeds } from '../../shared/unit-options.js';
import { BUILDING_NOTES, BUILDING_ORDER } from './buildings.js';
import { bldgTitle, bnum, fpKey } from './format.js';
import { data, fpMap } from './showsheet-feed.js';
import { state } from './state.js';
import { inTour } from './tour-planner.js';
import { $ } from './ui.js';

const BED_ORDER = ['STUDIOS','1 BEDROOMS','2 BEDROOMS','3 BEDROOMS','4 BEDROOMS'];
export const FILTERS = [['all','All'],['fits','Fits needs'],['studio','Studios'],['1br','1 Bed'],['2br','2 Bed'],['3br','3+ Bed'],['priority','Priority'],['noapp','No app'],['fp','Has floor plan'],['selected','Selected']];

// ---------- Availability list ----------
export function chips() {
  $('chips').innerHTML = FILTERS.filter(([k]) => k !== 'selected' && k !== 'fits').map(([k,l]) => `<button class="chip ${state.filter===k?'on':''}" aria-pressed="${state.filter===k}" onclick="setFilter('${k}')">${l}</button>`).join('');
}
export function setFilter(k) { state.filter = k; chips(); render(); }
function bedLabel(g) {
  if (/STUDIO/.test(g)) return 'Studios';
  const m = g.match(/^(\d)\s*BEDROOMS?$/); if (m) return `${m[1]} Bedroom${m[1]==='1'?'':'s'}`;
  return g.charAt(0) + g.slice(1).toLowerCase();
}
function bedKey(u) {
  const g = String(u.bedroomGroup || '').toUpperCase();
  if (/STUDIO/.test(g) || /^studio/i.test(u.type||'')) return 'studio';
  const m = g.match(/(\d)/); return m ? m[1] + 'br' : 'other';
}
export function passes(u, q) {
  if (state.filter === 'studio' && bedKey(u) !== 'studio') return false;
  if (state.filter === '1br' && bedKey(u) !== '1br') return false;
  if (state.filter === '2br' && bedKey(u) !== '2br') return false;
  if (state.filter === '3br' && !/^[3-9]br$/.test(bedKey(u))) return false;
  if (state.filter === 'priority' && !u.priority) return false;
  if (state.filter === 'noapp' && u.hasApp) return false;
  if (state.filter === 'fp' && !fpMap[fpKey(u.building, u.unit)]) return false;
  if (state.filter === 'selected' && !inTour(u)) return false;
  if (state.filter === 'fits' && !fitsNeeds(u, state.tour.profile)) return false;
  if (q) {
    const hay = `${u.unit} ${u.building} ${u.type} ${u.view} ${u.direction} ${u.incentive} ${u.avail} ${u.notes||''}`.toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }
  return true;
}
export function render() {
  if (!data) return;
  const q = ($('search').value || '').toLowerCase().trim();
  const units = (data.units || []).filter(u => passes(u, q));
  if (!units.length) { $('list').innerHTML = '<div class="empty">No units match.</div>'; return; }
  const byB = {};
  units.forEach(u => { (byB[u.building] = byB[u.building] || []).push(u); });
  const bKeys = Object.keys(byB).sort((a,b) => { const ia = BUILDING_ORDER.indexOf(bnum(a)), ib = BUILDING_ORDER.indexOf(bnum(b)); return (ia<0?99:ia) - (ib<0?99:ib); });
  let html = '';
  for (const b of bKeys) {
    const list = byB[b];
    const groups = {};
    list.forEach(u => { const g = String(u.bedroomGroup || 'OTHER').toUpperCase(); (groups[g] = groups[g] || []).push(u); });
    const gKeys = Object.keys(groups).sort((a,b) => { const ia = BED_ORDER.indexOf(a), ib = BED_ORDER.indexOf(b); return (ia<0?99:ia) - (ib<0?99:ib); });
    const note = BUILDING_NOTES[bnum(b)];
    html += `<section class="bldg"><div class="bldg-hdr"><h2>${esc(bldgTitle(b))}${note ? `<span class="bldg-note">${esc(note)}</span>` : ''}</h2><span class="bldg-count">${list.length} unit${list.length===1?'':'s'}</span></div>`;
    for (const g of gKeys) {
      html += `<div class="bed-hdr">${esc(bedLabel(g))}</div>`;
      for (const u of groups[g]) html += unitRow(u);
    }
    html += `</section>`;
  }
  $('list').innerHTML = html;
}
function unitRow(u) {
  const fp = safeUrl(fpMap[fpKey(u.building, u.unit)]);
  const inc = u.incentive && !/^no incentives?$/i.test(String(u.incentive).trim()) ? u.incentive : '';
  const tags = [];
  if (u.hasApp) tags.push(`<span class="flag pending">App pending</span>`);
  if (u.priority) tags.push(`<span class="flag pri">Priority</span>`);
  if (inc) tags.push(`<span class="flag inc">${esc(inc)}</span>`);
  if (u.direction) tags.push(`<span class="flag">${esc(u.direction)}</span>`);
  if (fp) tags.push(`<span class="flag">Floor plan ↗</span>`);
  if (u.notes) tags.push(`<span class="tag note">${esc(u.notes)}</span>`);
  const ne = u.netEff && Number(u.netEff) && Number(u.netEff) !== Number(u.monthly) ? `<div class="neteff">Net ${money(u.netEff)}</div>` : '';
  const availTxt = u.avail && !/^priority$/i.test(u.avail) ? u.avail : (u.avail ? 'Available now' : '');
  const inner = `
    <div class="unit-num">#${esc(u.unit)}${u.sqft ? `<small>${esc(u.sqft)} sq ft</small>` : ''}</div>
    <div class="unit-main">
      <div class="unit-type">${esc(u.type)}</div>
      ${u.view ? `<div class="unit-view">${esc(u.view)}</div>` : ''}
      <div class="unit-meta">${tags.join('')}</div>
    </div>
    <div class="unit-price"><div class="price">${money(u.monthly)}</div>${ne}${availTxt ? `<div class="avail">${esc(availTxt)}</div>` : ''}</div>`;
  const row = fp
    ? `<a class="unit tap ${u.hasApp?'app':''}" href="${esc(fp)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="unit ${u.hasApp?'app':''}">${inner}</div>`;
  return `<div class="unit-wrap">${row}</div>`;
}
