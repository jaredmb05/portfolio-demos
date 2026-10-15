// Building Cheat Sheet page.
import { escapeHtml as esc } from '../../shared/html.js';
import { BUILDING_INFO, BUILDING_ORDER, ROLE_RULES, STAFF, STAFF_ALL, TALKING_POINTS } from './buildings.js';
import { $ } from './ui.js';

// ---------- Cheat sheet page ----------
export function renderCheatSheet() {
  const box = $('cheatBody'); if (!box) return;
  const bKeys = BUILDING_ORDER;
  let html = '';
  for (const b of bKeys) {
    const i = BUILDING_INFO[b], st = STAFF[b]; if (!i) continue;
    html += `<section class="bldg-info"><div class="bldg-hdr"><h2>${b} Tidemark Blvd</h2><span class="bldg-count">Opened ${esc(i.opened)}</span></div>
      <dl class="facts">
        <dt>Building</dt><dd>${esc(i.units)}<small>${esc(i.layouts)}</small></dd>
        <dt>Leasing specialist</dt><dd>${esc(st.ls)}</dd>
        <dt>Building manager</dt><dd>${esc(st.bm)}${st.bmNote ? `<small>${esc(st.bmNote)}</small>` : ''}</dd>
        <dt>Front desk</dt><dd>${esc(st.desk)}</dd>
        <dt>Outdoor space</dt><dd>${i.outdoor.map((o,ix) => ix===0 ? esc(o) : `<small>${esc(o)}</small>`).join('')}</dd>
        <dt>Gym</dt><dd>${esc(i.gym)}</dd>
        <dt>Lounge</dt><dd>${esc(i.lounge)}</dd>
        <dt>Laundry</dt><dd>${esc(i.laundry)}</dd>
        ${i.extra ? `<dt>Also</dt><dd>${esc(i.extra)}</dd>` : ''}
      </dl></section>`;
  }
  html += `<section class="bldg-info"><div class="bldg-hdr"><h2>Who handles what</h2></div><dl class="facts">${ROLE_RULES.map(([q,a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl></section>`;
  html += `<section class="bldg-info"><div class="bldg-hdr"><h2>Company contacts</h2></div><dl class="facts">${STAFF_ALL.map(([r,n]) => `<dt>${esc(r)}</dt><dd>${esc(n)}</dd>`).join('')}</dl></section>`;
  html += `<details class="tp" open><summary>Talking points</summary><div class="body">${TALKING_POINTS}</div></details>`;
  box.innerHTML = html;
}
