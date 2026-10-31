// Reports → Print or save as PDF (production Desk v1.28, v1.30, D33, D36): only the Reports, landscape, drawn at the
// page's width so chart text keeps its size. "Choose what to print" asks first: every part in page order, all ticked each
// time (nothing is remembered, and the screen doesn't change). Unticked = left off the printout; the menu = how a ticked
// part prints. Without a pick, everything prints the way it shows on screen.
import { escapeHtml } from '../../shared/html.js';
import { currentReport, renderReports, rpt } from './reports.js';
import { tourTimes } from './tour-times.js';

export function printReports(pick) {
  const panel = document.getElementById('reportsPanel'); if (!panel || !panel.classList.contains('open') || !tourTimes.rows) return;
  const page = document.createElement('style'); page.textContent = '@page { size: landscape; margin: 12mm; }';
  document.head.appendChild(page); document.body.classList.add('print-reports');
  rpt.printPick = pick || null; rpt.printW = 960; renderReports();
  const done = () => { window.removeEventListener('afterprint', done); page.remove(); document.body.classList.remove('print-reports'); rpt.printW = 0; rpt.printPick = null; renderReports(); };
  window.addEventListener('afterprint', done);
  window.print();
}
// [group, [[part, name, 'fig' (chart / table / both) or the list's top N]]]
export const REPORT_PARTS = [
  ['', [['kpis', 'Summary numbers (the six tiles)']]],
  ['Apartments shown', [['sizes', 'By size, week by week', 'fig'], ['bldg', 'By building', 'fig'], ['netweek', 'Week by week (the size picked on screen)'], ['apts', 'Most-shown apartments', 15], ['still', 'Most-shown, still available', 10]]],
  ['What prospects want', [['demand', 'Sizes asked for vs. sizes available', 'fig'], ['movein', 'When they want to move in', 'fig'], ['net', 'Net rent of the apartments shown', 'fig'], ['fit', 'Shown within the prospect’s price', 'fig']]],
  ['Traffic', [['weekly', 'Tours per week', 'fig'], ['busy', 'Busiest days and times', 'fig']]],
  ['Team', [['tourtimes', 'Tour times by day (the week on screen)'], ['quiz', 'Training quiz results']]]
];
export function openPrintPick() {
  const panel = document.getElementById('reportsPanel'), list = document.getElementById('printPickList');
  if (!panel || !panel.classList.contains('open') || !tourTimes.rows || !list) return;
  let m = null; try { m = currentReport(); } catch (e) { console.error(e); }
  const count = { apts: m ? m.apts.length : 0, still: m ? m.stillAvail.length : 0 };
  const menu = (part, name, choices, now) => `<select class="pp-how" data-part="${part}" aria-label="${escapeHtml('How to print ' + name)}">${choices.map(([v, l]) => `<option value="${v}"${v === now ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  // Each menu starts the way the part shows on screen, so printing straight away prints what you see
  const how = (part, name, kind) => kind === 'fig' ? menu(part, name, [['chart', 'Chart'], ['table', 'Table'], ['both', 'Chart and table']], part === 'net' ? 'both' : rpt.tables[part] ? 'table' : 'chart')
    : typeof kind === 'number' && count[part] > kind ? menu(part, name, [['top', `Top ${kind}`], ['all', `All ${count[part]}`]], rpt.tables[part + 'All'] ? 'all' : 'top') : '';
  list.innerHTML = REPORT_PARTS.map(([group, parts]) => `<fieldset class="pp-group">${group ? `<legend>${group}<span class="pp-gone"> · left off</span></legend>` : ''}${parts.map(([part, name, kind]) =>
    `<div class="pp-row"><label class="cbx"><input type="checkbox" data-part="${part}" checked onchange="printPickSync()"> <span>${escapeHtml(name)}</span></label>${how(part, name, kind)}<span class="pp-off">Left off</span></div>`).join('')}</fieldset>`).join('');
  printPickSync();
  document.getElementById('printPickModal').classList.add('show');
  setTimeout(() => { const f = list.querySelector('input'); if (f) f.focus(); }, 0);   // after the dialog script notes the button that opened it
}
export function printPickSync() {
  const list = document.getElementById('printPickList'); if (!list) return;
  list.querySelectorAll('.pp-row').forEach(r => r.classList.toggle('off', !r.querySelector('input').checked));
  list.querySelectorAll('.pp-group').forEach(g => g.classList.toggle('off', !g.querySelector('.pp-row:not(.off)')));
  const any = !!list.querySelector('input:checked');
  document.getElementById('printPickGo').disabled = !any;
  document.getElementById('printPickNote').textContent = any ? '' : 'Tick at least one part to print.';
}
export function printPickAll(on) { document.querySelectorAll('#printPickList input[type="checkbox"]').forEach(x => { x.checked = on; }); printPickSync(); }
export function closePrintPick() { document.getElementById('printPickModal').classList.remove('show'); }
export function printPicked() {
  const pick = {};
  document.querySelectorAll('#printPickList .pp-row').forEach(r => { const x = r.querySelector('input'), s = r.querySelector('select'); if (x.checked) pick[x.getAttribute('data-part')] = s ? s.value : true; });
  if (!Object.keys(pick).length) return;
  closePrintPick();
  setTimeout(() => printReports(pick), 0);   // once the dialog has closed and focus is back on the Reports bar
}
