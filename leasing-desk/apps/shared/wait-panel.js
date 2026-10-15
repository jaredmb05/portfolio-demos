// The per-person wait panel: who is out on tours, the Outlook slots that matter, and the estimate headline.
import { hooks } from './hooks.js';
import { apptByHour, estimateMinutes, estimateWait } from './wait-estimate.js';

// Wait panel for one waiting entry: who's out, the appointment questions that matter before this person starts, the result.
const openWaitPanels = {};
export function waitPanelHtml(r, rows, names, out, escFn, readOnly) {
  const READ_ONLY = !!readOnly;   // the iPad shows the answers; the Leasing Desk enters them
  const est = estimateWait(rows, names, out, r.id);
  const fmt = ms => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const now = Date.now(); const todayStr = new Date().toDateString();
  // Right now: every assistant in today, with what they're doing
  const onTour = {};
  rows.filter(x => x.startedAtIso && !x.finishedAtIso && new Date(x.startedAtIso).toDateString() === todayStr).forEach(x => { onTour[x.assistant] = x; });
  const inToday = names.filter(n => !out.includes(n));
  const people = inToday.map(n => {
    const x = onTour[n];
    if (!x) return `<div class="wp-p"><span class="wp-dot free"></span><b>${escFn(n)}</b><span class="wp-muted">available</span></div>`;
    const end = Math.max(new Date(x.startedAtIso).getTime() + estimateMinutes(x) * 60000, now + 5 * 60000);
    const where = [...new Set((x.stops || []).map(st => (String(st.building || '').match(/\d{4}/) || [''])[0]).filter(Boolean))].join(' → ');
    const what = x.kind === 'inspection' ? 'on an inspection' : `on a tour (${(x.stops||[]).length || 3} unit${(x.stops||[]).length === 1 ? '' : 's'}${where ? ', ' + where : ''})`;
    return `<div class="wp-p"><span class="wp-dot busy"></span><b>${escFn(n)}</b><span class="wp-muted">${what} · back ~${fmt(end)}</span></div>`;
  }).join('') || '<div class="wp-muted">No assistants are in today — check the schedule.</div>';
  // Outlook slots between now and when this person would start (office hours only, max 4)
  const slots = []; const d = new Date(now); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  if (d.getHours() < 10) d.setHours(10, 0, 0, 0);
  const until = (est && est.targetStart ? est.targetStart : now) + 30 * 60000;
  while (d.getTime() <= until && slots.length < 4 && d.getHours() < 18) { slots.push(d.getHours() + (d.getMinutes() === 30 ? 0.5 : 0)); d.setMinutes(d.getMinutes() + 30); }
  const lbl = h => { const hr = Math.floor(h); return `${hr > 12 ? hr - 12 : hr}:${h % 1 ? '30' : '00'} ${hr >= 12 ? 'PM' : 'AM'}`; };
  const seg = (h, kind, max) => { const c = apptByHour[String(h)] || {}; return `<span class="wp-seg">${[...Array(max + 1).keys()].map(n => `<button class="${c.asked && (c[kind] || 0) === n ? 'on' : ''}" onclick="setApptExact('${h}','${kind}',${n})">${n}</button>`).join('')}</span>`; };
  const slotRows = slots.map(h => { const c = apptByHour[String(h)] || {};
    const val = READ_ONLY
      ? (c.asked ? `<span>${c.tours || 0} tour${(c.tours||0)===1?'':'s'}, ${c.insp || 0} inspection${(c.insp||0)===1?'':'s'}</span>` : '<span class="wp-tag">not checked</span>')
      : `<span class="wp-lab">Tours</span>${seg(h, 'tours', 3)}<span class="wp-lab">Inspections</span>${seg(h, 'insp', 2)}${c.asked ? '' : '<span class="wp-tag">not checked</span>'}`;
    return `<div class="wp-slot"><span class="wp-time">${lbl(h)}</span>${val}</div>`; }).join('');
  const unanswered = slots.some(h => !(apptByHour[String(h)] || {}).asked);
  const head = !est || est.none ? 'No assistants in today'
    : est.targetStart <= now + 2 * 60000 ? `Can start now with ${escFn(est.targetLane)}`
    : `≈ ${Math.max(0, Math.round((est.targetStart - now) / 60000) - 5)}–${Math.round((est.targetStart - now) / 60000) + 5} min · ~${fmt(est.targetStart)} with ${escFn(est.targetLane)}`;
  return `<div class="wp">
    <div class="wp-head"><span class="wp-k">Estimated wait</span><span class="wp-v">${head}</span>${unanswered ? `<span class="wp-note">${READ_ONLY ? 'Could be longer — Outlook not checked yet' : 'Check Outlook below for a better estimate'}</span>` : ''}</div>
    <div class="wp-cols">
      <div><div class="wp-sec">Right now</div>${people}</div>
      ${slots.length ? `<div><div class="wp-sec">Booked on Outlook${READ_ONLY ? '' : ' before they\'d start'}</div>${slotRows}</div>` : ''}
    </div>
  </div>`;
}

// The first waiting entry's panel starts open; the rest start folded to a one-line estimate. A tap flips either way.
export function waitPanelOpen(id, first) { return openWaitPanels[id] === undefined ? !!first : !!openWaitPanels[id]; }
export function toggleWaitPanel(id, first) { openWaitPanels[id] = !waitPanelOpen(id, first); hooks.onWaitPanelToggled(); }
// The panel's headline ("Can start now with Nadia", "≈ 8–18 min · ~2:23 PM with Jun") for the folded one-line view
export function waitHeadline(panelHtml) { const m = /<span class="wp-v">([\s\S]*?)<\/span>/.exec(panelHtml || ''); return m ? m[1] : ''; }
