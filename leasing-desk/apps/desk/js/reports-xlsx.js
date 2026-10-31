// Reports → Download Excel (production Desk v1.28–v1.31, D33, D37, D38): one sheet per section, for the period and building
// picked, with the bundled SheetJS (window.XLSX). Every number comes from reportModel, the same as on screen; the Tour times
// sheet is worked out with the same rules as the table (rules/tour-times.js).
import { availStatusLabel } from '../../shared/avail-status.js';
import { currentReport, rpt } from './reports.js';
import { REPORT_DAYS, REPORT_SIZES, rptArr, rptConcName, rptConcRank, rptDay, rptHour, rptMedian, rptNum, rptPct, rptYmd } from './rules/reports.js';
import { tourTimeStatus } from './rules/tour-times.js';
import { tourTimes } from './tour-times.js';
import { toast } from './ui.js';

export function downloadReportsXlsx() {
  if (typeof XLSX === 'undefined') { toast('The spreadsheet tool didn’t load. Check the connection and reload the page.', true); return; }
  if (!tourTimes.rows) return;
  let m; try { m = currentReport(); } catch (e) { console.error(e); toast('Couldn’t make the spreadsheet from the saved tours. Click Refresh, then try again.', true); return; }
  const wb = XLSX.utils.book_new();
  const add = (name, rows, widths) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = (widths || []).map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
  const day = iso => iso ? new Date(iso).toLocaleDateString('en-US') : '';
  const round = v => v == null || isNaN(v) ? '' : Math.round(v);
  const weekOf = wk => wk.full ? rptDay(wk.start) : `${rptDay(wk.start)} (so far)`;
  add('Summary', [['Leasing reports'], ['Period', m.label], ['Buildings', m.bldg || 'All buildings'], ['Downloaded', new Date().toLocaleString('en-US')], [],
    ['Tours', m.tours.length], ['Apartments shown', m.shown.length], ['Different apartments', m.apts.length], ['Shown and still available', m.stillAvail.length],
    ['Apartments shown to prospects who gave a price', m.fit.units], ['Within their price (on the net)', m.fit.fits], ['Over their price (on the net)', m.fit.over],
    ['Typical tour length (minutes)', round(m.typical.med)], ['Timed tours', m.typical.n], ['Quiz attempts', m.quiz.loaded ? m.quiz.attempts : 'not loaded'], ['Quiz passed', m.quiz.loaded ? m.quiz.passed : 'not loaded'], [],
    ['Apartments shown = every apartment on a tour that was started (inspections aren’t counted). Net = what was quoted on the tour after the concession, or the rent when there’s no concession; a credit is never taken off. Price = the top of the range the prospect gave at sign-in. Status today, Rent today and Available today are from today’s showsheet.']], [34, 28]);
  add('Tours per week', [['Week of', 'Tours', 'Apartments shown', 'Typical tour length (minutes)']].concat(m.weeks.map((wk, i) => [weekOf(wk), m.toursPerWeek[i], m.shownPerWeek[i], round(rptMedian(m.weekLens[i]))])), [16, 8, 18, 22]);
  add('Shown by size by week', [['Week of'].concat(m.sizes, ['Total'])].concat(m.weeks.map((wk, i) => [weekOf(wk)].concat(m.sizes.map(z => m.bySizeWeek[z][i]), [m.shownPerWeek[i]])), [['Total'].concat(m.sizes.map(z => m.sizeTotals[z]), [m.shown.length])]), [16, 9, 9, 9, 9, 9, 9]);
  add('Shown by building', [['Building'].concat(m.sizes, ['Total'])].concat(m.bldgs.map((b, i) => [b].concat(m.sizes.map(z => m.bySizeBldg[z][i]), [m.sizes.reduce((a, z) => a + m.bySizeBldg[z][i], 0)]))), [12, 9, 9, 9, 9, 9, 9]);
  add('Apartments shown', [['Building', 'Unit', 'Size', 'Type', 'Times shown', 'Last shown', 'Status today', 'Rent today', 'Concession today']].concat(m.apts.map(a => [a.b, a.unit, a.size, a.type, a.n, day(a.last), a.status, a.live ? rptNum(a.live.monthly) || '' : '', a.live ? a.live.incentive || '' : ''])), [10, 8, 8, 30, 12, 12, 30, 10, 28]);
  add('Shown, still available', [['Building', 'Unit', 'Size', 'Times shown', 'Rent today', 'Concession today', 'Available']].concat(m.stillAvail.map(a => [a.b, a.unit, a.size, a.n, rptNum(a.live.monthly) || '', a.live.incentive || '', [a.live.avail || '', availStatusLabel(a.live.availStatus)].filter(Boolean).join(' · ')])), [10, 8, 8, 12, 10, 28, 30]);
  add('Sizes asked vs available', [['Size', 'Prospects asking', 'Share of requests', 'Apartments available today', 'Share of available']].concat(REPORT_SIZES.map(z => [z, m.asked[z], rptPct(m.asked[z], m.askedTotal), m.availNow[z], rptPct(m.availNow[z], m.availTotal)])), [10, 13, 12, 18, 15]);
  add('Net rent shown by size', [['Size', 'Apartments shown (with a rent)', 'Typical net', 'Most were between: from', 'Most were between: to', 'Typical rent before the concession']].concat(m.netBySize.map(r => [r.size, r.n, round(r.med), round(r.p25), round(r.p75), round(r.rent)])), [10, 28, 12, 22, 20, 32]);
  const allConc = [...new Set(REPORT_SIZES.flatMap(z => m.concWeek[z].flatMap(c => Object.keys(c))))].sort((a, b) => rptConcRank(a) - rptConcRank(b));
  add('Week by week by size', [['Size', 'Week of', 'Asked for', 'Shown', 'Typical net'].concat(allConc.map(rptConcName))].concat(REPORT_SIZES.flatMap(z => m.weeks.map((wk, i) => [z, weekOf(wk), m.askWeek[z][i], m.bySizeWeek[z][i], round(m.netByWeek[z][i])].concat(allConc.map(k => m.concWeek[z][i][k] || 0))))), [10, 16, 10, 8, 12].concat(allConc.map(() => 16)));
  add('Within their price', [['Size', 'Apartments shown (to prospects who gave a price)', 'Within their price', 'Over their price', 'Typically over by ($/month)']].concat(m.sizes.filter(z => m.fitBySize[z].units).map(z => { const f = m.fitBySize[z]; return [z, f.units, f.fits, f.over, round(rptMedian(f.overBy))]; }), [['All', m.fit.units, m.fit.fits, m.fit.over, round(rptMedian(m.fit.overBy))]]), [10, 44, 18, 16, 26]);
  add('Move-in months', [['Move-in month', 'Prospects']].concat(m.months.map(x => [x.long, x.n]), m.flexible ? [['Flexible (no date)', m.flexible]] : []), [22, 8]);
  add('Busiest days and times', [['Day'].concat(m.hours.map(rptHour), ['Total'])].concat(REPORT_DAYS.map((dn, di) => [dn].concat(m.grid[di], [m.dayTotals[di]]))), [12].concat(m.hours.map(() => 7), [8]));
  const tt = [['Week of', 'Assistant', 'Tours started', 'Timed tours', 'Typical length (minutes)']];
  m.weeks.forEach(wk => {
    const ts = rptArr(tourTimes.rows).filter(r => r && r.kind !== 'inspection' && typeof r.startedAtIso === 'string' && new Date(r.startedAtIso) >= wk.start && new Date(r.startedAtIso) < wk.end);
    [...new Set(ts.map(r => String(r.assistant || 'Unassigned')))].sort().forEach(a => { const mine = ts.filter(r => String(r.assistant || 'Unassigned') === a), ok = mine.map(tourTimeStatus).filter(s => s.ok).map(s => s.len); tt.push([rptDay(wk.start), a, mine.length, ok.length, round(rptMedian(ok))]); });
  });
  add('Tour times', tt, [12, 16, 14, 12, 24]);
  add('Quiz results', m.quiz.loaded ? [['Date', 'Name', 'Score', 'Total', 'Percent', 'Passed', 'Missed topics']].concat(m.quiz.rows.map(q => [day(q.dateIso), String(q.name || ''), q.score, q.total, q.pct, q.passed ? 'Yes' : 'No', rptArr(q.missed).filter(x => x && x.category).map(x => x.category).join(', ')])) : [['The quiz results weren’t loaded. Click Refresh in Reports, then download again.']], [12, 18, 8, 8, 9, 8, 40]);
  XLSX.writeFile(wb, `Leasing reports ${rptYmd(m.from)} to ${rptYmd(m.endShown)}${rpt.bldg ? ' ' + rpt.bldg : ''}.xlsx`);
  toast('Downloaded the reports spreadsheet.');
}
