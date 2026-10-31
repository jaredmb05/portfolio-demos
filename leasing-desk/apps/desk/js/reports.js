// Reports (managers only; production Desk v1.28–v1.31, D33, D34, D36–D38): the panel at the bottom of the Desk, behind
// the manager PIN. Every number comes from reportModel (rules/reports.js); this module only reads, draws and remembers what
// is picked on screen. Nothing is saved. The charts are in viz.js, print in reports-print.js, Excel in reports-xlsx.js.
// Reads when Reports opens, and again on opening once what was read is over 15 minutes old (a Desk stays open all day);
// Refresh always reads. The tours come from the tour-times read (tour-times.js): 8 weeks plus the week before.
import { clockTime } from '../../shared/dates.js';
import { availStatusFlag } from '../../shared/avail-status.js';
import { prefersReducedMotion } from '../../shared/dom.js';
import { escapeHtml, jsArg } from '../../shared/html.js';
import { fbDb } from './firebase.js';
import { fmtMinutes, TREND_WEEKS } from './rules/tour-times.js';
import {
  REPORT_BLDGS, REPORT_DAYS, REPORT_FIT, REPORT_MAX_TOURS, REPORT_SIZE_VARS, REPORT_SIZES, reportBldgLabel, reportModel,
  rptArr, rptConcName, rptConcRank, rptDay, rptHour, rptMedian, rptMoney, rptN, rptNum, rptPct
} from './rules/reports.js';
import { unlockManager } from './staff.js';
import { state } from './state.js';
import { loadWeeklyTrends, tourTimes, weeklyTrendsHtml } from './tour-times.js';
import { syncScrollUi } from './ui.js';
import { vizCols, vizFit, vizHeat, vizLegend, vizPairBars, vizRanges, vizSpark, vizStackBars, vizStackCols, vizTable, vizTipHideNow } from './viz.js';

// What is picked on screen (kept while the page is open, never saved): weeks · bldg ('' = all) · tables (Show table per
// chart, and Show all for the lists) · netSize (Week by week, D38) · printPick / printW (while printing, D36) · the quiz read
export const rpt = { weeks: 4, bldg: '', tables: {}, netSize: 'Studio', printPick: null, printW: 0, lastW: 0,
  quizRows: null, quizState: '', quizLoadedAt: '', quizOpen: {} };

// The numbers for what's picked, from what was read and this computer's showsheet
export function currentReport() {
  return reportModel({ tours: tourTimes.rows, units: state.units, quiz: rpt.quizRows, weeks: rpt.weeks, bldg: rpt.bldg });
}
function rptLoaded(iso) { return !iso ? '' : new Date(iso).toDateString() === new Date().toDateString() ? clockTime(iso) : `${rptDay(iso)}, ${clockTime(iso)}`; }   // the date too when it isn't today

// ---------- open, lock, load ----------
export async function toggleReports() {
  const panel = document.getElementById('reportsPanel'), tt = document.getElementById('reportsToggle');
  if (panel.classList.contains('open')) { panel.classList.remove('open'); tt.textContent = 'Show'; tt.setAttribute('aria-expanded', 'false'); vizTipHideNow(); return; }
  if (!state.trainingUnlocked && !(await unlockManager())) return;
  panel.classList.add('open'); tt.textContent = 'Hide'; tt.setAttribute('aria-expanded', 'true');
  renderReports();
  refreshReports(false);
}
// The Rotation tab's "Open Reports"
export async function openReports() {
  const panel = document.getElementById('reportsPanel');
  if (!panel.classList.contains('open')) await toggleReports();
  if (panel.classList.contains('open')) panel.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
// A read already running isn't started twice
export function refreshReports(force) {
  const old = iso => !iso || Date.now() - new Date(iso).getTime() > 15 * 60000;
  if (tourTimes.status !== 'loading' && (force || !tourTimes.rows || old(tourTimes.loadedAt))) loadWeeklyTrends();
  if (rpt.quizState !== 'loading' && (force || !rpt.quizRows || old(rpt.quizLoadedAt))) loadQuizResults();
}
async function loadQuizResults() {
  const db = fbDb(); if (!db) { rpt.quizState = 'error'; renderReports(); return; }
  rpt.quizState = 'loading'; renderReports();
  try {
    const snap = await db.collection('quiz_results').orderBy('dateIso', 'desc').limit(200).get();
    const rows = []; snap.forEach(d => rows.push(Object.assign({ _id: d.id }, d.data())));
    rpt.quizRows = rows; rpt.quizState = ''; rpt.quizLoadedAt = new Date().toISOString();
  } catch (e) { console.error(e); rpt.quizState = 'error'; }
  renderReports();
}
export function setReportRange(n) { rpt.weeks = n; renderReports(); }
export function setReportBldg(b) { rpt.bldg = b; renderReports(); }
export function setReportNetSize(z) { if (REPORT_SIZES.includes(z)) { rpt.netSize = z; renderReports(); } }
export function toggleReportTable(key) { rpt.tables[key] = !rpt.tables[key]; renderReports(); }
// A quiz attempt's details: shown or hidden; Reports remembers which are open across redraws
export function toggleMissed(id) { const el = document.getElementById('missed-' + id); if (!el) return; const show = el.style.display === 'none'; el.style.display = show ? '' : 'none'; rpt.quizOpen[id] = show; }
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { const b = document.getElementById('reportsBody'); if (b && b.clientWidth && b.clientWidth !== rpt.lastW) renderReports(); }, 200); });

// ---------- the page ----------
// A chart (or list) with its heading, note and Show table button. opt.both: the chart and the table always show together
// (Net rent), no Show table button. opt.withChart: the table to put under the chart when both show, if not the table
// itself. opt.tools: a control for the caption's right side (the size picker in Week by week).
export function rptFig(key, title, note, chart, table, wide, opt) {
  opt = opt || {};
  // Printing from Choose what to print (D36): a part left off isn't drawn at all; a ticked one shows as picked
  const pick = rpt.printPick ? rpt.printPick[key] : null;
  if (rpt.printPick && !pick) return '';
  const asTable = !!(table && rpt.tables[key]);
  const show = !table ? 'chart' : ['chart', 'table', 'both'].includes(pick) ? pick : opt.both ? 'both' : asTable ? 'table' : 'chart';
  const content = show === 'table' ? table : show === 'both' ? chart + (opt.both ? table : `<div class="rpt-and">${opt.withChart || table}</div>`) : chart;
  return `<figure class="rpt-fig${wide ? ' wide' : ''}" id="rpt-${key}"><figcaption><div><h3 class="rpt-h">${escapeHtml(title)}</h3>${note ? `<p class="rpt-note">${note}</p>` : ''}</div>${table && !opt.both ? `<button type="button" class="tiny ghost rpt-tbtn" data-rkey="tbl-${key}" aria-pressed="${asTable}" onclick="toggleReportTable('${key}')">${asTable ? 'Show chart' : 'Show table'}</button>` : ''}${opt.tools || ''}</figcaption>${content}</figure>`;
}
// The bar pinned at the top while scrolling through Reports (D34): period, building, Refresh, Print, Excel
function reportBar(m) {
  const seg = [[1, 'This week'], [2, '2 weeks'], [4, '4 weeks'], [6, '6 weeks']].map(([n, l]) => `<button type="button" class="tiny${rpt.weeks === n ? ' on' : ''}" data-rkey="range-${n}" aria-pressed="${rpt.weeks === n}" onclick="setReportRange(${n})">${l}</button>`).join('');
  const sel = `<select class="rpt-bldg" data-rkey="bldg" aria-label="Building" onchange="setReportBldg(this.value)"><option value="">All buildings</option>${REPORT_BLDGS.map(b => `<option value="${b}"${rpt.bldg === b ? ' selected' : ''}>${reportBldgLabel(b)}</option>`).join('')}</select>`;
  const asof = m ? `${m.label}${tourTimes.loadedAt ? ` · loaded ${rptLoaded(tourTimes.loadedAt)}` : ''}` : '';
  const stale = m && tourTimes.status === 'error' ? `<span class="rpt-err">Couldn’t refresh. Showing what was loaded at ${rptLoaded(tourTimes.loadedAt)}.</span>` : '';
  return `<div class="rpt-bar"><div class="rpt-seg" role="group" aria-label="Period">${seg}</div>${sel}<span class="rpt-asof">${escapeHtml(asof)}</span>${stale}<span class="rpt-spacer"></span><button type="button" class="tiny ghost" data-rkey="refresh" onclick="refreshReports(true)">Refresh</button><button type="button" class="tiny" data-rkey="print" onclick="openPrintPick()"${m ? '' : ' disabled'}>Print or save as PDF</button><button type="button" class="tiny" data-rkey="xlsx" onclick="downloadReportsXlsx()"${m ? '' : ' disabled'}>Download Excel</button></div>`;
}
// Training quiz results (Team): the attempts in the period, or every attempt read with Show all
function quizResultsHtml(m) {
  if (!rpt.quizRows) return rpt.quizState === 'error' ? `<div class="empty">Couldn’t load quiz results. Check the connection, then click Refresh.</div>` : `<div class="empty">Loading quiz results…</div>`;
  const all = !!rpt.tables.quizAll, rows = all ? rpt.quizRows : m.quiz.rows;
  const fmt = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const missedOf = r => rptArr(r.missed).filter(x => x && typeof x === 'object');
  const missedBy = r => Object.entries(missedOf(r).reduce((acc, x) => { acc[x.category] = (acc[x.category] || 0) + 1; return acc; }, {}));
  const list = rows.map((r, i) => `
      <div class="queue-row" style="grid-template-columns: 28px 1fr auto auto;">
        <div class="n">${i + 1}</div>
        <div><div class="who">${escapeHtml(r.name || '(no name)')} <span class="flag ${r.passed ? 'pass' : 'fail'}" style="margin-left:6px;">${r.passed ? 'Passed' : 'Not passed'}</span></div>
          <div class="sub">${missedOf(r).length ? `Missed: ${missedBy(r).map(([c, n]) => `${escapeHtml(c)} ×${n}`).join(', ')}` : 'No misses'}</div></div>
        <div class="when"><strong>${escapeHtml(r.pct)}%</strong> · ${escapeHtml(r.score)}/${escapeHtml(r.total)} · ${fmt(r.dateIso)}</div>
        <div class="row" style="justify-content:flex-end;"><button class="tiny ghost" data-rkey="${escapeHtml('quiz-' + r._id)}" onclick='toggleMissed(${jsArg(r._id)})'>Details</button></div>
      </div>
      <div id="missed-${escapeHtml(r._id)}" style="${rpt.quizOpen[r._id] ? '' : 'display:none; '}padding:4px 0 10px 40px; font-size:12px;">
        ${missedOf(r).length ? missedOf(r).map(x => `<div style="padding:5px 0; border-top:1px solid var(--line-soft);"><div><strong>${escapeHtml(x.q)}</strong></div><div style="color:var(--red);">Answered: ${escapeHtml(x.chosen)}</div><div style="color:var(--green);">Correct: ${escapeHtml(x.correct)}</div></div>`).join('') : '<em>Perfect score.</em>'}
      </div>`).join('');
  const q = m.quiz, more = rpt.quizRows.length > q.rows.length || all;
  const head = q.attempts ? `${rptN(q.attempts, 'attempt')} in this period · ${q.passed} passed (${rptPct(q.passed, q.attempts)})${q.topics.length ? ` · most missed: ${escapeHtml(q.topics[0][0])} (${q.topics[0][1]})` : ''}` : 'No quiz attempts in this period.';
  return `<div class="rpt-quizhead"><span>${head}</span>${more ? `<button type="button" class="tiny ghost" data-rkey="quizAll" onclick="toggleReportTable('quizAll')">${all ? 'Only this period' : `Show all ${rpt.quizRows.length} attempts`}</button>` : ''}</div>${list || (all ? '<div class="empty">No quiz attempts yet.</div>' : '')}`;
}
export function renderReports() {
  const panel = document.getElementById('reportsPanel'), body = document.getElementById('reportsBody'), meta = document.getElementById('reportsMeta'), lock = document.getElementById('reportsLock');
  if (!panel || !body) return;
  if (lock) lock.style.display = state.trainingUnlocked ? '' : 'none';
  if (!state.trainingUnlocked) { body.innerHTML = ''; if (meta) meta.textContent = '— managers only (PIN)'; vizTipHideNow(); return; }
  if (!panel.classList.contains('open')) { if (meta) meta.textContent = '— managers only'; return; }
  // Keyboard focus inside Reports survives the redraw (every control and chart target has a data-rkey)
  const ae = document.activeElement, focusKey = ae && body.contains(ae) ? ae.getAttribute('data-rkey') : null;
  const refocus = () => { if (!focusKey) return; const el = [...body.querySelectorAll('[data-rkey]')].find(x => x.getAttribute('data-rkey') === focusKey); if (el) el.focus(); };
  vizTipHideNow();
  rpt.lastW = body.clientWidth;
  if (!tourTimes.rows) {
    if (meta) meta.textContent = '— managers only';
    body.innerHTML = reportBar(null) + (tourTimes.status === 'error' ? `<div class="empty">Couldn’t load the tours. Check the connection, then <button class="tiny" data-rkey="retry" onclick="refreshReports(true)">Try again</button></div>` : `<div class="empty">Loading the last ${TREND_WEEKS} weeks of tours…</div>`);
    refocus(); return;
  }
  // Odd saved data (a field of the wrong kind) shows a message instead of a half-drawn panel
  try { renderReportsPage(body, meta); } catch (e) {
    console.error(e);
    body.innerHTML = reportBar(null) + `<div class="empty">Couldn’t work out the Reports from the saved tours. Click Refresh to read them again.</div>`;
  }
  refocus();
}
function renderReportsPage(body, meta) {
  const m = currentReport();
  if (meta) meta.textContent = `— ${m.label}${m.bldg ? ' · ' + m.bldg : ''}`;
  const W = rpt.printW || Math.max(320, body.clientWidth - 36), two = W >= 900;   // 36 = the panel's side padding
  const full = Math.round(W - 34), half = two ? Math.round((W - 16) / 2 - 34) : full;   // 34 = a figure's padding and border; 16 = the gap
  // Printing from Choose what to print: a half-width chart prints full width when the other one in its row is left off, or
  // when either prints the busiest-times table (too wide for half a page)
  const PAIR = { sizes: 'bldg', bldg: 'sizes', demand: 'movein', movein: 'demand', weekly: 'busy', busy: 'weekly' };
  const pp = rpt.printPick, wideTable = k => !!pp && k === 'busy' && ['table', 'both'].includes(pp.busy);
  const solo = k => !!pp && (wideTable(k) || wideTable(PAIR[k]) || !pp[PAIR[k]]), wOf = k => solo(k) ? full : half;
  const nT = m.tours.length, bWord = m.bldg ? ` at ${m.bldg}` : '';
  const sparkOf = vals => m.fullWeeks.length >= 2 ? m.fullWeeks.map(i => vals[i]) : [];
  const kpi = (label, value, sub, spark) => `<div class="rpt-kpi"><div class="rpt-kpi-l">${label}</div><div class="rpt-kpi-row"><div class="rpt-kpi-v">${value}</div>${spark || ''}</div><div class="rpt-kpi-s">${sub}</div></div>`;
  const kpis = `<div class="rpt-kpis">${[
    kpi('Tours', nT.toLocaleString('en-US'), m.fullWeeks.length ? `typically ${Math.round(m.weekTyp)} a week` : 'this week so far', vizSpark(sparkOf(m.toursPerWeek), 'Tours per full week')),
    kpi('Apartments shown', m.shown.length.toLocaleString('en-US'), nT ? `${(m.shown.length / nT).toFixed(1)} per tour` : '—', vizSpark(sparkOf(m.shownPerWeek), 'Apartments shown per full week')),
    kpi('Different apartments', m.apts.length.toLocaleString('en-US'), m.apts.length ? `most shown: ${escapeHtml(m.apts[0].b)} #${escapeHtml(m.apts[0].unit)} (${rptN(m.apts[0].n, 'time')})` : 'none shown yet'),
    kpi('Within their price', m.fit.units ? rptPct(m.fit.fits, m.fit.units) : '—', m.fit.units ? 'of apartments shown were at or under the price the prospect gave, on the net' : 'no prices given at sign-in'),
    kpi('Typical tour length', m.typical.med != null ? fmtMinutes(Math.round(m.typical.med)) : '—', m.typical.n ? `from ${rptN(m.typical.n, 'timed tour')}` : 'no timed tours yet'),
    kpi('Quiz pass rate', m.quiz.attempts ? rptPct(m.quiz.passed, m.quiz.attempts) : '—', !m.quiz.loaded ? (rpt.quizState === 'error' ? 'couldn’t load the quiz results' : 'loading…') : m.quiz.attempts ? `${m.quiz.passed} of ${rptN(m.quiz.attempts, 'attempt')}` : 'no attempts in this period')
  ].join('')}</div>`;
  const started = m.capped ? `<p class="rpt-note rpt-start">Only the latest ${REPORT_MAX_TOURS.toLocaleString('en-US')} tours could be read, so the earliest weeks may be missing some.</p>`
    : m.startsLater ? `<p class="rpt-note rpt-start">Tours are recorded from ${rptDay(m.firstIso)}, ${new Date(m.firstIso).getFullYear()}, so the period starts that week.</p>` : '';
  const group = t => `<h3 class="rpt-group">${t}</h3>`;

  // Apartments shown by size, week by week
  const series = m.sizes.map(z => ({ name: z, color: REPORT_SIZE_VARS[z], values: m.bySizeWeek[z] }));
  const sizeWords = z => z === 'Studio' ? 'studios' : z === 'Other' ? 'other sizes' : z.toLowerCase() + 's';   // "1 beds"
  const share = REPORT_SIZES.filter(z => m.sizeTotals[z]).map(z => `${rptPct(m.sizeTotals[z], m.shown.length)} ${sizeWords(z)}`).join(', ');
  const fSizes = rptFig('sizes', 'Apartments shown by size, week by week', `How many apartments of each size we showed each week${escapeHtml(bWord)} (Monday to Sunday). A tour that showed 3 apartments counts 3.${share ? ' Of all the apartments shown in this period: ' + escapeHtml(share) + '.' : ''}`,
    m.shown.length ? vizLegend(series.map(s => [s.name, s.color])) + vizStackCols(m.weeks, series, wOf('sizes'), 'shown') : '<div class="empty">No apartments shown in this period.</div>',
    m.shown.length ? vizTable(['Week of'].concat(m.sizes, ['Total']), m.weeks.map((wk, i) => [wk.label].concat(m.sizes.map(z => m.bySizeWeek[z][i]), [m.shownPerWeek[i]])), ['Total'].concat(m.sizes.map(z => m.sizeTotals[z]), [m.shown.length])) : '', solo('sizes'));
  // Week by week for one size (D38): asked for at sign-in (the demand), shown, the typical net quoted, and the concession on
  // those showings, so a move in the net can be told apart from a change in which apartments were shown
  const nz = REPORT_SIZES.includes(rpt.netSize) ? rpt.netSize : 'Studio', cw = m.concWeek[nz];
  const concKeys = [...new Set(cw.flatMap(c => Object.keys(c)))].sort((a, b) => rptConcRank(a) - rptConcRank(b));
  const sizePick = `<select class="rpt-pick" data-rkey="netsize" aria-label="Size" onchange="setReportNetSize(this.value)">${REPORT_SIZES.map(z => `<option value="${z}"${z === nz ? ' selected' : ''}>${z}</option>`).join('')}</select>`;
  const fNetWeek = rptFig('netweek', `Week by week: ${nz}`, `For the size picked: how many prospects asked for it at sign-in${escapeHtml(bWord)}, how many we showed, the typical net we quoted (after the concession, or the rent when there’s none), and how many of those showings had each concession. “Asked for” is the demand, before anyone picks apartments. The concession columns show why the typical net moves: more showings at a bigger concession pull it down.`,
    vizTable(['Week of', 'Asked for', 'Shown', 'Typical net'].concat(concKeys.map(rptConcName)),
      m.weeks.map((wk, i) => [wk.label, m.askWeek[nz][i], m.bySizeWeek[nz][i], rptMoney(m.netByWeek[nz][i])].concat(concKeys.map(k => cw[i][k] || 0))),
      ['Whole period', m.askWeek[nz].reduce((a, b) => a + b, 0), m.sizeTotals[nz], rptMoney(m.netBySize.find(r => r.size === nz).med)].concat(concKeys.map(k => cw.reduce((a, c) => a + (c[k] || 0), 0)))),
    '', true, { tools: sizePick });
  const bSeries = m.sizes.map(z => ({ name: z, color: REPORT_SIZE_VARS[z], values: m.bySizeBldg[z] }));
  const bTot = m.bldgs.map((_, i) => bSeries.reduce((a, x) => a + x.values[i], 0));
  const bLong = b => /^\d{4}$/.test(b) ? reportBldgLabel(b) : 'Other (a building typed by hand)';
  const fBldg = rptFig('bldg', 'Apartments shown by building', m.bldg ? `Only ${escapeHtml(m.bldg)}, the building picked above.` : `The same apartments, split by building. Share of all the apartments shown: ${m.bldgs.filter((b, i) => bTot[i]).map(b => `${escapeHtml(b)} ${rptPct(bTot[m.bldgs.indexOf(b)], m.shown.length)}`).join(' · ')}.`,
    m.shown.length ? vizLegend(bSeries.map(x => [x.name, x.color])) + vizStackBars(m.bldgs.map(b => ({ label: b, long: bLong(b) })), bSeries, wOf('bldg'), 'shown') : '<div class="empty">No apartments shown in this period.</div>',
    m.shown.length ? vizTable(['Building'].concat(m.sizes, ['Total']), m.bldgs.map((b, i) => [b].concat(m.sizes.map(z => m.bySizeBldg[z][i]), [bTot[i]])), ['Total'].concat(m.sizes.map(z => m.sizeTotals[z]), [m.shown.length])) : '', solo('bldg'));

  // The two apartment lists show the top 15 / 10, or all (Show all on screen; Top or All when printing from Choose what to print)
  const listAll = k => pp && typeof pp[k] === 'string' ? pp[k] === 'all' : !!rpt.tables[k + 'All'];
  // Most-shown apartments (a table with a bar in each row)
  const maxN = Math.max(1, ...m.apts.map(a => a.n)), aptList = listAll('apts') ? m.apts : m.apts.slice(0, 15);
  const statusCell = a => a.status === 'Available' || a.status === '—' ? a.status : `<span class="flag${a.status === 'App pending' ? ' pending' : a.status === 'Backup apps welcome' ? ' backup' : ''}">${escapeHtml(a.status)}</span>`;
  const aptRows = aptList.map(a => `<tr><th scope="row">${escapeHtml(a.b)} #${escapeHtml(a.unit)}</th><td>${escapeHtml(a.type || a.size)}</td><td class="rpt-barcell"><div><span class="rpt-inbar" style="width:calc((100% - 34px) * ${(a.n / maxN).toFixed(3)})"></span><b>${a.n}</b></div></td><td class="num">${rptDay(a.last)}</td><td>${statusCell(a)}</td><td class="num">${a.live && rptNum(a.live.monthly) ? rptMoney(rptNum(a.live.monthly)) : '—'}</td></tr>`).join('');
  const fApts = rptFig('apts', 'Most-shown apartments', `Every apartment we showed in this period${escapeHtml(bWord)} and how many times, most shown first (${rptN(m.apts.length, 'different apartment')}). ${m.haveSheet ? '“Status today” and “Rent today” come from today’s showsheet.' : 'Today’s showsheet isn’t loaded on this computer, so “Status today” and “Rent today” are blank.'}`,
    m.apts.length ? `<div class="rpt-tablewrap"><table class="rpt-table rpt-apts"><thead><tr><th>Apartment</th><th>Type</th><th>Times shown</th><th class="num">Last shown</th><th>Status today</th><th class="num">Rent today</th></tr></thead><tbody>${aptRows}</tbody></table></div>${m.apts.length > 15 ? `<button type="button" class="tiny ghost rpt-more" data-rkey="aptsAll" onclick="toggleReportTable('aptsAll')">${rpt.tables.aptsAll ? 'Show the top 15' : `Show all ${m.apts.length}`}</button>` : ''}` : '<div class="empty">No apartments shown in this period.</div>', '', true);

  // The most-shown apartments that are still on the market
  const stillList = listAll('still') ? m.stillAvail : m.stillAvail.slice(0, 10);
  const fStill = rptFig('still', 'Most-shown apartments still available', 'The apartments we showed most in this period that still have no application. If one keeps being shown but not rented, look at its price, its concession or the apartment itself.',
    m.stillAvail.length ? `<div class="rpt-tablewrap"><table class="rpt-table"><thead><tr><th>Apartment</th><th>Type</th><th class="num">Times shown</th><th class="num">Rent today</th><th>Concession today</th><th>Available</th></tr></thead><tbody>${stillList.map(a => `<tr><th scope="row">${escapeHtml(a.b)} #${escapeHtml(a.unit)}</th><td>${escapeHtml(a.type || a.size)}</td><td class="num"><b>${a.n}</b></td><td class="num">${rptMoney(rptNum(a.live.monthly) || null)}</td><td>${escapeHtml(a.live.incentive || '—')}</td><td>${escapeHtml(a.live.avail || '')}${a.live.availStatus ? ' ' + availStatusFlag(a.live) : ''}</td></tr>`).join('')}</tbody></table></div>${m.stillAvail.length > 10 ? `<button type="button" class="tiny ghost rpt-more" data-rkey="stillAll" onclick="toggleReportTable('stillAll')">${rpt.tables.stillAll ? 'Show the top 10' : `Show all ${m.stillAvail.length}`}</button>` : ''}` : `<div class="empty">${m.haveSheet ? 'None in this period: every apartment shown has an application or has left the showsheet.' : 'Today’s showsheet isn’t loaded on this computer.'}</div>`, '', true);

  // Sizes asked for vs available now
  const pairRows = REPORT_SIZES.map(z => ({ label: z, a: m.askedTotal ? 100 * m.asked[z] / m.askedTotal : 0, b: m.availTotal ? 100 * m.availNow[z] / m.availTotal : 0,
    aText: `${rptPct(m.asked[z], m.askedTotal)} · ${m.asked[z]}`, bText: `${rptPct(m.availNow[z], m.availTotal)} · ${m.availNow[z]}`,
    aTip: `${rptPct(m.asked[z], m.askedTotal)} (${rptN(m.asked[z], 'prospect')})`, bTip: `${rptPct(m.availNow[z], m.availTotal)} (${rptN(m.availNow[z], 'apartment')})` }));
  const fDemand = rptFig('demand', 'Sizes asked for vs. sizes available', `The sizes prospects asked for at sign-in, next to the sizes we have available today (no application yet)${escapeHtml(bWord)}. Each bar is a share of its total${m.askedTotal && m.availTotal ? `: for example, studios were ${rptPct(m.asked.Studio, m.askedTotal)} of requests and ${rptPct(m.availNow.Studio, m.availTotal)} of the apartments available` : ''}. ${m.toursWithSize.length} of ${rptN(nT, 'tour')} gave a size; some asked for two.`,
    m.askedTotal || m.availTotal ? vizLegend([['Asked for at sign-in', '--viz-1'], ['Available today', '--viz-2']]) + vizPairBars(pairRows, wOf('demand')) : '<div class="empty">No sizes yet.</div>',
    vizTable(['Size', 'Prospects asking', 'Share of requests', 'Apartments available', 'Share of available'], REPORT_SIZES.map(z => [z, m.asked[z], rptPct(m.asked[z], m.askedTotal), m.availNow[z], rptPct(m.availNow[z], m.availTotal)])), solo('demand'));

  // Net rent of the apartments shown, by size (D37): what we quoted, after the concession (the rent when there's none)
  const fNet = rptFig('net', 'Net rent of the apartments shown', `What we quoted on the apartments we showed${escapeHtml(bWord)}, after the concession (or the rent when there’s no concession). Every showing counts: an apartment shown 5 times counts 5 times. The bar shows where most of them fell, and the dot is the typical one.`,
    m.netBySize.some(r => r.n) ? vizLegend([['Typical net', '--viz-1', 'dot'], ['Typical rent before the concession', '--viz-2', 'diamond']]) + vizRanges(m.netBySize, full) : '<div class="empty">No apartments shown in this period.</div>',
    `<div class="rpt-tablewrap"><table class="rpt-table compact"><thead><tr><th>Size</th><th class="num">Apartments shown</th><th class="num">Typical net</th><th class="num">Most were between</th><th class="num">Typical rent before the concession</th></tr></thead><tbody>${m.netBySize.map(r => `<tr><th scope="row">${r.size}</th><td class="num">${r.n}</td><td class="num">${rptMoney(r.med)}</td><td class="num">${r.n ? `${rptMoney(r.p25)}–${rptMoney(r.p75)}` : '—'}</td><td class="num">${rptMoney(r.rent)}</td></tr>`).join('')}</tbody></table></div>`, true, { both: true });

  // Shown within the prospect's price (on the net, D37)
  const fitSizes = m.sizes.filter(z => m.fitBySize[z].units), overBy = rptMedian(m.fit.overBy);
  const fitTiles = `<div class="rpt-fit">${REPORT_FIT.map(([k, , col]) => `<div><i style="background:var(${col})"></i><b>${rptPct(m.fit[k], m.fit.units)}</b><span>${k === 'fits' ? 'at or under the price they gave' : `over the price they gave${overBy != null ? `, typically by ${rptMoney(overBy)} a month` : ''}`}</span></div>`).join('')}</div>`;
  const fitTable = m.fit.units ? vizTable(['Size', 'Apartments shown', 'Within their price', 'Over their price', 'Typically over by (a month)'], fitSizes.map(z => { const f = m.fitBySize[z]; return [z, f.units, rptPct(f.fits, f.units), rptPct(f.over, f.units), rptMoney(rptMedian(f.overBy))]; }), ['All', m.fit.units, rptPct(m.fit.fits, m.fit.units), rptPct(m.fit.over, m.fit.units), rptMoney(overBy)]) : '';
  const fFit = rptFig('fit', 'Shown within the prospect’s price', `For prospects who gave a price at sign-in: was each apartment we showed them at or under that price? It compares the net we quoted (the rent when there’s no concession) with the top of their price range. ${rptN(m.fit.units, 'apartment')} shown to these prospects.`,
    m.fit.units ? (two ? `<div class="rpt-fitwide">${fitTiles}${vizFit(fitSizes.map(z => ({ label: z, f: m.fitBySize[z] })), full - 300)}</div>` : fitTiles + vizFit(fitSizes.map(z => ({ label: z, f: m.fitBySize[z] })), full)) : '<div class="empty">No apartments were shown to prospects who gave a price in this period.</div>',
    m.fit.units ? fitTiles + fitTable : '', true, { withChart: fitTable });   // under the chart, the table without the tiles a second time

  // Move-in months
  const fMove = rptFig('movein', 'When they want to move in', `The month prospects said they want to move in, at sign-in: ${m.withDate.length} of ${rptN(nT, 'tour')} gave a date${m.flexible ? `, and ${m.flexible} more said they’re flexible` : ''}.${m.leadMed != null ? ` Typically ${rptN(Math.round(m.leadMed), 'day')} after their tour.` : ''}`,
    m.months.length ? vizCols(m.months, wOf('movein'), 'tours', 'Move-in month asked for') : '<div class="empty">No move-in dates yet.</div>',
    vizTable(['Move-in month', 'Prospects'], m.months.map(x => [x.long, x.n]).concat(m.flexible ? [['Flexible (no date)', m.flexible]] : [])), solo('movein'));

  // Busiest days and times
  const busyNote = m.arrivals ? `When prospects arrive${escapeHtml(bWord)}, by day and hour: the darker the square, the more arrivals (from the time each tour was set up). ${m.top ? `Busiest hour: ${REPORT_DAYS[m.top.day]} ${rptHour(m.top.hour)}–${rptHour(m.top.hour + 1)} (${rptN(m.top.n, 'arrival')}). ` : ''}Busiest day: ${REPORT_DAYS[m.topDay]} (${rptN(m.dayTotals[m.topDay], 'tour')}).` : 'No tours in this period.';
  const heatLegend = `<div class="viz-legend viz-scale"><span>Fewer</span>${[1, 2, 3, 4, 5].map(k => `<i style="background:var(--heat-${k})"></i>`).join('')}<span>More</span></div>`;
  const fBusy = rptFig('busy', 'Busiest days and times', busyNote, m.arrivals ? heatLegend + vizHeat(m, wOf('busy')) : '',
    m.arrivals ? vizTable(['Day'].concat(m.hours.map(rptHour), ['Total']), REPORT_DAYS.map((d, di) => [d].concat(m.grid[di], [m.dayTotals[di]]))) : '', solo('busy'));
  const typWeek = i => m.weekLens[i].length ? fmtMinutes(Math.round(rptMedian(m.weekLens[i]))) : '—';
  const fWeekly = rptFig('weekly', 'Tours per week', `How many tours were started each week${escapeHtml(bWord)} (Monday to Sunday)${m.fullWeeks.length ? `. A typical full week has ${Math.round(m.weekTyp)}` : ''}. Inspections aren’t counted.`,
    nT ? vizCols(m.weeks.map((wk, i) => ({ label: wk.label, long: wk.long, n: m.toursPerWeek[i], rows: [['Apartments shown', String(m.shownPerWeek[i])], ['Typical tour length', typWeek(i)]] })), wOf('weekly'), 'tours', 'Tours per week') : '<div class="empty">No tours in this period.</div>',
    nT ? vizTable(['Week of', 'Tours', 'Apartments shown', 'Typical tour length'], m.weeks.map((wk, i) => [wk.label, m.toursPerWeek[i], m.shownPerWeek[i], typWeek(i)])) : '', solo('weekly'));

  const printHead = `<div class="rpt-print-head"><strong>Leasing reports</strong><span>${escapeHtml(m.label)} · ${escapeHtml(m.bldg || 'All buildings')} · printed ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>`;
  // Printing from Choose what to print (D36): parts left off aren't drawn, and a heading prints only with something under it
  const on = k => !pp || !!pp[k], section = (t, figs) => figs ? group(t) + figs : '';
  body.innerHTML = `<div class="rpt${tourTimes.status === 'loading' ? ' is-refreshing' : ''}" aria-busy="${tourTimes.status === 'loading'}">${reportBar(m)}${printHead}${started}${on('kpis') ? kpis : ''}
    <div class="rpt-grid${two ? ' two' : ''}">
      ${section('Apartments shown', fSizes + fBldg + fNetWeek + fApts + fStill)}
      ${section('What prospects want', fDemand + fMove + fNet + fFit)}
      ${section('Traffic', fWeekly + fBusy)}
      ${section('Team', (on('tourtimes') ? `<section class="rpt-fig wide" id="rpt-tourtimes">${weeklyTrendsHtml()}</section>` : '') +
        (on('quiz') ? `<section class="rpt-fig wide" id="rpt-quiz"><figcaption><div><h3 class="rpt-h">Training quiz results</h3><p class="rpt-note">Scores from the training quiz on the iPads (all buildings). Details shows which questions someone missed.</p></div></figcaption>${quizResultsHtml(m)}</section>` : ''))}
    </div></div>`;
  body.querySelectorAll('.rpt-fig').forEach(f => f.querySelectorAll('.viz-hit').forEach((h, i) => h.setAttribute('data-rkey', `hit-${f.id}-${i}`)));   // keyboard focus on a chart survives a redraw
  syncScrollUi();
}
