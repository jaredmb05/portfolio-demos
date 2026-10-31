// Reports (managers only; production Desk v1.28–v1.31, D33, D37, D38): every number the Reports panel shows, worked
// out from the tours, today's showsheet and the quiz results. Nothing is saved. Pure: the panel passes in what it read.
// "Shown" = every unit on a tour that was started; inspections are left out. Sizes: Studio · 1 Bed · 2 Bed (2 Bed/1 Bath
// counts here) · 3 Bed (3 or more). Budget = the top of the price range. Arrival = when the tour was set up: tours are
// signed in as the prospect arrives, while Start is often tapped late (D25).
// Money follows this repo's rulings, not production's: a credit is never in the net effective, and the net uses the
// stop's lease term (D19, M1).
import { ymd } from '../../../shared/dates.js';
import { availStatusLabel } from '../../../shared/avail-status.js';
import { leaseTerm, parseIncentive } from '../../../shared/pricing.js';
import { bldgNum, fpKey } from '../units.js';
import { tourTimeStatus, weekStartOf } from './tour-times.js';

export const REPORT_SIZES = ['Studio', '1 Bed', '2 Bed', '3 Bed'];
export const REPORT_BLDGS = ['2050', '2230', '2120', '2040', '2110'];   // the demo's display order
export const REPORT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const REPORT_SIZE_VARS = { 'Studio': '--size-1', '1 Bed': '--size-2', '2 Bed': '--size-3', '3 Bed': '--size-4', 'Other': '--size-other' };
export const REPORT_FIT = [['fits', 'Within their price', '--fit-1'], ['over', 'Over their price', '--fit-3']];   // compared on the net (D37)
export const REPORT_MAX_TOURS = 2000;   // the limit on the tours read for Reports
export const reportBldgLabel = bn => `${bn} Tidemark Blvd`;

// A unit type ("1 Bed, 1 Bath W/D", "2 Bdrm, 2 Bth…", "2-Bedroom", "1BR") or a size asked for ("2 Bed/1 Bath")
export function reportSize(t) {
  t = String(t || '');
  if (/studio/i.test(t)) return 'Studio';
  const m = t.match(/(?<![\d.])(\d)[\s-]*(?:bedrooms?|bdrms?|beds?|bds?|br)(?![a-z])/i);   // "1.5 Bed" isn't read as 5
  if (!m) return 'Other';
  return +m[1] >= 3 ? '3 Bed' : +m[1] === 2 ? '2 Bed' : +m[1] === 1 ? '1 Bed' : 'Studio';
}
// A showsheet section ("1 BEDROOMS", "CONVERTIBLES", "PENTHOUSES"), read the way the unit list's quick filters read it
export function reportGroupSize(g) {
  g = String(g || '').toUpperCase();
  return g.includes('STUDIO') || g.includes('CONVERTIBLE') ? 'Studio' : g.includes('1 BEDROOM') || g.includes('JR 1') ? '1 Bed' : g.includes('2 BEDROOM') ? '2 Bed' : g.includes('3 BEDROOM') || g.includes('PENTHOUSE') ? '3 Bed' : 'Other';
}
export function rptArr(v) { return Array.isArray(v) ? v : []; }   // saved data that should be a list but isn't counts as empty
export function rptNum(v) { return parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, '')) || 0; }
export function rptQuantile(a, q) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.max(0, Math.ceil(q * s.length) - 1)]; }   // nearest rank: a value someone actually gave
export function rptMedian(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
export function rptMoney(n) { return n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString('en-US'); }
// The concession on a showing (D38): free months ('1.5', '1'…), a credit only, another concession, or none; most first
export function rptConcRank(k) { return isNaN(k) ? 100 + ['credit', 'other', 'none'].indexOf(k) : -parseFloat(k); }
export function rptConcName(k) { return k === 'credit' ? 'Credit only' : k === 'other' ? 'Other concession' : k === 'none' ? 'No concession' : `${{ 0.25: '¼', 0.5: '½', 0.75: '¾' }[+k] || +k} month${+k <= 1 ? '' : 's'} free`; }
export function rptPct(n, d) { return d ? Math.round(100 * n / d) + '%' : '—'; }
export function rptDay(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
export function rptHour(h) { return `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`; }
export const rptYmd = ymd;
export function rptN(n, word, many) { return `${n.toLocaleString('en-US')} ${n === 1 ? word : (many || word + 's')}`; }
// A prospect's budget: the top of the price range. Under $1,000 or over $30,000 is taken as a typo, and "budget flexible"
// (production v1.34) has no top price: both are left out (0).
export function rptBudget(r) {
  const pr = (r && r.profile) || {};
  if (pr.priceFlexible === true) return 0;
  const b = rptNum(pr.priceMax); return b >= 1000 && b <= 30000 ? b : 0;
}

// The net quoted for a unit shown, as the iPad quotes it (resolveStop): the rent (typed over, else the showsheet's) less the
// free months (typed on the tour, else the showsheet's) over the lease term, never above the rent. When no free months can
// be read, the showsheet's NET EFF gives the free amount. The term is the stop's saved term (the iPad saves the unit's own,
// the Desk its "Other concession" term), else the unit's lease term from its incentive text, 12 when none is written (M1).
// A credit is quoted next to the rent and never taken off (D19), and the OP goes to a broker, so neither is counted. A broker
// on an OR concession takes the OP unless they waive it, so the prospect pays the rent.
export function stopNetEff(st, broker) {
  const rent = rptNum(st.rent || st.monthly); if (!rent) return 0;
  const sheet = parseIncentive(st.incentive);
  if (broker && sheet.mode === 'or') return Math.round(rent);
  const saved = parseInt(st.term, 10), term = saved > 0 ? saved : leaseTerm(st.incentive);
  const free = parseFloat(st.free) > 0 ? parseFloat(st.free) : sheet.freeMonths;
  const freeAmt = free ? rent * free : rptNum(st.netEff) ? (rent - rptNum(st.netEff)) * term : 0;
  return Math.round(rent - Math.max(0, freeAmt) / term);
}
// The concession behind that net (D38): the free months quoted (typed on the tour, else the showsheet's), else 'credit'
// when the tour typed a credit, else 'other' when the showsheet's NET EFF is below the rent, else 'none'. A broker on an OR
// concession means no free months for the prospect (the OP goes to the broker).
export function concOf(st, broker) {
  const rent = rptNum(st.rent || st.monthly), sheet = parseIncentive(st.incentive), orBroker = !!broker && sheet.mode === 'or';
  const months = orBroker ? 0 : parseFloat(st.free) > 0 ? parseFloat(st.free) : sheet.freeMonths || 0;
  return months ? String(months) : rptNum(st.credit) ? 'credit' : !orBroker && rptNum(st.netEff) && rptNum(st.netEff) < rent ? 'other' : 'none';
}
// A unit's status on today's showsheet (u = that unit, or nothing when it isn't on it)
const occupied = u => u.availStatus === 'occupied' || /^occupied$/i.test(String(u.avail || '').trim());
export function liveStatus(u) {
  return !u ? 'Not on the showsheet' : u.hasApp ? 'App pending' : u.backupApps ? 'Backup apps welcome' : occupied(u) ? 'Occupied'
    : u.availStatus === 'reno' ? availStatusLabel('reno') : 'Available';
}

// ---------- the numbers ----------
// tours: the tours read (any order; non-tours and odd saved data are skipped) · units: today's showsheet · quiz: the quiz
// results read (null = not loaded) · weeks: 1, 2, 4 or 6 · bldg: '' or a building number · now: the clock · maxTours: the
// read's limit (a read that hit it may be missing the earliest tours)
export function reportModel({ tours: rows, units: sheetUnits, quiz: quizRows = null, weeks: nWeeks = 4, bldg = '', now: nowIn = new Date(), maxTours = REPORT_MAX_TOURS } = {}) {
  const units = rptArr(sheetUnits).filter(u => u && typeof u === 'object');
  const now = new Date(nowIn), ws0 = weekStartOf(now), dayStart = iso => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d; };
  let weeks = [];
  for (let i = Math.max(1, parseInt(nWeeks, 10) || 4) - 1; i >= 0; i--) {
    const s = new Date(ws0); s.setDate(s.getDate() - 7 * i); const e = new Date(s); e.setDate(e.getDate() + 7);
    weeks.push({ start: s, end: e, now: !i, label: i ? rptDay(s) : 'This week', long: i ? `week of ${rptDay(s)}` : `this week (${rptDay(s)} on, so far)` });
  }
  const toursAll = rptArr(rows).filter(r => r && r.kind !== 'inspection' && typeof r.startedAtIso === 'string' && !isNaN(new Date(r.startedAtIso)));
  const capped = rptArr(rows).length >= maxTours;   // the read hit its limit, so the earliest weeks may be missing tours
  const firstIso = toursAll.reduce((a, r) => !a || r.startedAtIso < a ? r.startedAtIso : a, '');
  const kept = firstIso && !capped ? weeks.filter(w => w.end > new Date(firstIso)) : weeks;
  const startsLater = kept.length > 0 && kept.length < weeks.length;   // the records begin inside the period
  if (kept.length) weeks = kept;
  const firstDay = firstIso && !capped ? dayStart(firstIso) : null;
  weeks.forEach(w => { w.full = !w.now && !(firstDay && firstDay > w.start); });   // a whole week of records (for "a week" and the trend lines)
  const from = weeks[0].start, to = weeks[weeks.length - 1].end;
  const lastDay = new Date(to); lastDay.setDate(lastDay.getDate() - 1);   // the Sunday, by the calendar (a clock-change day included)
  const endShown = lastDay < now ? lastDay : now;
  const within = iso => { if (!iso) return false; const d = new Date(iso); return d >= from && d < to; };
  const weekOf = iso => { const d = new Date(iso); return weeks.findIndex(w => d >= w.start && d < w.end); };
  const perWeek = () => weeks.map(() => 0);
  const bn = String(bldg || '');
  const stopsOf = r => rptArr(r.stops).filter(st => st && typeof st === 'object' && (!bn || bldgNum(st.building) === bn));
  const tours = toursAll.filter(r => within(r.startedAtIso) && (!bn || stopsOf(r).length));
  const toursPerWeek = perWeek(), weekLens = weeks.map(() => []);
  tours.forEach(r => { const i = weekOf(r.startedAtIso), st = tourTimeStatus(r); toursPerWeek[i]++; if (st.ok) weekLens[i].push(st.len); });

  // Today's showsheet: the size when a tour's unit type can't be read, the status and rent now, and what's available now
  const live = {}, haveSheet = units.length > 0; units.forEach(u => { live[fpKey(u.building, u.unit)] = u; });
  const unitSize = u => { const z = reportSize(u.type); return z === 'Other' ? reportGroupSize(u.bedroomGroup) : z; };

  // Apartments shown
  const shown = [];
  tours.forEach(r => stopsOf(r).forEach(st => {
    const key = fpKey(st.building, st.unit); let size = reportSize(st.type);
    if (size === 'Other' && live[key]) size = unitSize(live[key]);
    shown.push({ r, st, key, size, w: weekOf(r.startedAtIso) });
  }));
  const shownPerWeek = perWeek(); shown.forEach(s => { shownPerWeek[s.w]++; });
  const sizes = REPORT_SIZES.concat(shown.some(s => s.size === 'Other') ? ['Other'] : []);
  const bySizeWeek = {}, sizeTotals = {}; sizes.forEach(z => { bySizeWeek[z] = perWeek(); sizeTotals[z] = 0; });
  shown.forEach(s => { bySizeWeek[s.size][s.w]++; sizeTotals[s.size]++; });
  const bOf = st => { const b = bldgNum(st.building); return /^\d{4}$/.test(b) ? b : 'Other'; };   // a typed building name is never shown as is
  const bldgs = REPORT_BLDGS.filter(b => !bn || b === bn).concat([...new Set(shown.map(s => bOf(s.st)))].filter(b => !REPORT_BLDGS.includes(b)).sort());
  const bySizeBldg = {}; sizes.forEach(z => { bySizeBldg[z] = bldgs.map(() => 0); });
  shown.forEach(s => { bySizeBldg[s.size][bldgs.indexOf(bOf(s.st))]++; });
  const aptMap = {};
  shown.forEach(s => {
    const a = aptMap[s.key] = aptMap[s.key] || { key: s.key, b: bOf(s.st), unit: String(s.st.unit == null ? '' : s.st.unit), type: '', size: s.size, n: 0, last: '' };
    a.n++; if (s.r.startedAtIso > a.last) { a.last = s.r.startedAtIso; a.type = String(s.st.type || a.type); a.size = s.size; }
  });
  const apts = Object.values(aptMap).map(a => Object.assign(a, { live: live[a.key] || null, status: haveSheet ? liveStatus(live[a.key]) : '—' }))
    .sort((x, y) => y.n - x.n || (x.last < y.last ? 1 : -1));
  const stillAvail = apts.filter(a => a.live && !a.live.hasApp);   // a "Backup apps welcome" unit is still on the market

  // What prospects ask for (the building filter keeps tours that visited that building)
  const askSizes = r => [...new Set(rptArr((r.profile || {}).beds).map(reportSize).filter(z => z !== 'Other'))];
  const asked = {}, availNow = {}, rentShown = {}, netShown = {};
  REPORT_SIZES.forEach(z => { asked[z] = 0; availNow[z] = 0; rentShown[z] = []; netShown[z] = []; });
  const toursWithSize = tours.filter(r => askSizes(r).length);
  toursWithSize.forEach(r => askSizes(r).forEach(z => { asked[z]++; }));
  units.filter(u => !u.hasApp && (!bn || bldgNum(u.building) === bn)).forEach(u => {
    const z = unitSize(u); if (availNow[z] === undefined) return;
    availNow[z]++;
  });
  // Net rent of the apartments shown (D37): every priced showing, at the net quoted on that tour (stopNetEff), or the rent
  // when there's no concession. People come in on the net, so this, not the price typed at sign-in, is what they look at.
  const priceOf = s => { const rent = rptNum(s.st.rent || s.st.monthly); return rent ? { rent, net: stopNetEff(s.st, !!s.r.broker) } : null; };
  const netWeek = {}; REPORT_SIZES.forEach(z => { netWeek[z] = weeks.map(() => []); });
  shown.forEach(s => { const p = priceOf(s); if (!p || !rentShown[s.size]) return; rentShown[s.size].push(p.rent); netShown[s.size].push(p.net); netWeek[s.size][s.w].push(p.net); });
  const netBySize = REPORT_SIZES.map(z => ({ size: z, n: netShown[z].length, p25: rptQuantile(netShown[z], 0.25), med: rptMedian(netShown[z]), p75: rptQuantile(netShown[z], 0.75), rent: rptMedian(rentShown[z]) }));
  const netByWeek = {}; REPORT_SIZES.forEach(z => { netByWeek[z] = netWeek[z].map(a => rptMedian(a)); });
  // Week by week for one size (D38): prospects who asked for it at sign-in, and the concession each priced showing had
  const askWeek = {}, concWeek = {}; REPORT_SIZES.forEach(z => { askWeek[z] = perWeek(); concWeek[z] = weeks.map(() => ({})); });
  tours.forEach(r => { const i = weekOf(r.startedAtIso); askSizes(r).forEach(z => { askWeek[z][i]++; }); });
  shown.forEach(s => { if (!concWeek[s.size] || !priceOf(s)) return; const c = concOf(s.st, !!s.r.broker), w = concWeek[s.size][s.w]; w[c] = (w[c] || 0) + 1; });
  const askedTotal = REPORT_SIZES.reduce((a, z) => a + asked[z], 0), availTotal = REPORT_SIZES.reduce((a, z) => a + availNow[z], 0);

  // Shown within the prospect's price: each apartment shown to a prospect who gave a top price at sign-in, compared on the
  // net quoted (the rent when there's no concession; D37). Within, or over by how much a month.
  const fitRow = () => ({ units: 0, fits: 0, over: 0, overBy: [] });
  const fit = fitRow(), fitBySize = {}; sizes.forEach(z => { fitBySize[z] = fitRow(); });
  shown.forEach(s => {
    const max = rptBudget(s.r), p = priceOf(s);
    if (!max || !p) return;
    [fit, fitBySize[s.size]].forEach(f => { f.units++; if (p.net <= max) f.fits++; else { f.over++; f.overBy.push(p.net - max); } });
  });

  // Move-in dates: month by month from the first month asked for (empty months stay on the axis), at most 8 bars (the 8th
  // becomes "Later" when there's more); months before the period count as "Earlier"
  const moveOf = r => String((r.profile || {}).moveIn || '');
  const withDate = tours.filter(r => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/.test(moveOf(r)));
  const dated = new Set(withDate);
  const flexible = tours.filter(r => !dated.has(r) && (r.profile || {}).flexible).length;
  const monthCount = {}; withDate.forEach(r => { const k = moveOf(r).slice(0, 7); monthCount[k] = (monthCount[k] || 0) + 1; });
  const firstKey = rptYmd(from).slice(0, 7), keys = Object.keys(monthCount).sort(), seq = [];
  const earlier = keys.filter(k => k < firstKey).reduce((a, k) => a + monthCount[k], 0), inRange = keys.filter(k => k >= firstKey);
  // (y <= 9999: past December 9999 the key has five digits, and '10000-01' would sort before '9999-12')
  if (inRange.length) { const last = inRange[inRange.length - 1]; let [y, mo] = inRange[0].split('-').map(Number), k = inRange[0]; while (seq.length < 8 && y <= 9999 && k <= last) { seq.push(k); if (++mo > 12) { mo = 1; y++; } k = `${y}-${String(mo).padStart(2, '0')}`; } }
  const monthOf = k => { const d = new Date(k + '-15T12:00:00'); return { key: k, label: `${d.toLocaleDateString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`, long: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), n: monthCount[k] || 0 }; };
  let months = seq.map(monthOf);
  const beyond = seq.length ? inRange.filter(k => k > seq[seq.length - 1]).reduce((a, k) => a + monthCount[k], 0) : 0;
  if (beyond) months = months.slice(0, 7).concat({ key: 'later', label: 'Later', long: `${months[7].long} or later`, n: months[7].n + beyond });
  if (earlier) months.unshift({ key: 'earlier', label: 'Earlier', long: `before ${monthOf(firstKey).long}`, n: earlier });
  const leads = withDate.map(r => Math.round((new Date(moveOf(r).slice(0, 10) + 'T00:00:00') - dayStart(r.startedAtIso)) / 864e5)).filter(d => d >= 0);

  // Busiest days and times, by arrival: the set-up time when it's within 4 hours before the start (a tour planned the day
  // before counts at its start)
  const arrivalOf = r => {
    const s = new Date(r.startedAtIso);
    for (const k of ['createdAtIso', 'queuedAtIso']) { const d = r[k] ? new Date(r[k]) : null; if (d && !isNaN(d) && d <= s && s - d < 4 * 36e5) return d; }
    return s;
  };
  const arr = tours.map(arrivalOf).filter(d => !isNaN(d));
  let hMin = 10, hMax = 17; arr.forEach(d => { hMin = Math.min(hMin, d.getHours()); hMax = Math.max(hMax, d.getHours()); });
  hMin = Math.max(7, hMin); hMax = Math.min(21, hMax);   // anything earlier or later counts in the first or last hour
  const hours = []; for (let h = hMin; h <= hMax; h++) hours.push(h);
  const grid = REPORT_DAYS.map(() => hours.map(() => 0));
  arr.forEach(d => { grid[(d.getDay() + 6) % 7][Math.min(hMax, Math.max(hMin, d.getHours())) - hMin]++; });
  const dayTotals = grid.map(row => row.reduce((a, b) => a + b, 0));
  let top = null; grid.forEach((row, di) => row.forEach((v, hi) => { if (v && (!top || v > top.n)) top = { day: di, hour: hours[hi], n: v }; }));
  const topDay = dayTotals.reduce((b, v, i) => v > dayTotals[b] ? i : b, 0);

  // Tour length and the quiz in the period ("a week" = the typical full week, so a short first week doesn't pull it down)
  const lens = tours.map(tourTimeStatus).filter(s => s.ok).map(s => s.len);
  const quizIn = rptArr(quizRows).filter(q => q && within(q.dateIso));
  const topicMiss = {}; quizIn.forEach(q => rptArr(q.missed).forEach(x => { if (x && x.category) topicMiss[x.category] = (topicMiss[x.category] || 0) + 1; }));
  const fullWeeks = weeks.map((w, i) => i).filter(i => weeks[i].full);
  const year = from.getFullYear() !== endShown.getFullYear() ? `, ${from.getFullYear()}` : '';

  return { weeks, from, to, endShown, startsLater, capped, firstIso, fullWeeks, weekTyp: rptMedian(fullWeeks.map(i => toursPerWeek[i])),
    label: `${rptDay(from)}${year} – ${rptDay(endShown)}, ${endShown.getFullYear()}`, bldg: bn ? reportBldgLabel(bn) : '',
    haveSheet, tours, toursPerWeek, weekLens, shown, shownPerWeek, sizes, bySizeWeek, sizeTotals, bldgs, bySizeBldg, apts, stillAvail,
    asked, askedTotal, availNow, availTotal, toursWithSize, netBySize, netByWeek, askWeek, concWeek, fit, fitBySize,
    months, withDate, flexible, leadMed: rptMedian(leads), hours, grid, dayTotals, top, topDay, heatMax: Math.max(0, ...grid.flat()), arrivals: arr.length,
    typical: { med: rptMedian(lens), n: lens.length },
    quiz: { loaded: !!quizRows, rows: quizIn, attempts: quizIn.length, passed: quizIn.filter(q => q.passed).length, topics: Object.entries(topicMiss).sort((a, b) => b[1] - a[1]) } };
}
