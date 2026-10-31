// Reports (production Desk v1.28–v1.31, D33, D37, D38): every number the panel shows, worked out from invented tours, an
// invented showsheet and invented quiz results. Money follows this repo's rulings: a credit is never in the net effective,
// and the net uses the stop's lease term (D19, M1); the net matches what the iPad quotes for the same stop.
import { describe, expect, it } from 'vitest';
import { quoteLines, resolveConcession, resolveStop, savedQuoteFields } from '../../apps/shared/pricing.js';
import { selectionFromStop } from '../../apps/desk/js/rules/tour-selection.js';
import { fpKey } from '../../apps/desk/js/units.js';
import {
  concOf, liveStatus, REPORT_BLDGS, REPORT_SIZES, reportBldgLabel, reportGroupSize, reportModel, reportSize, rptBudget,
  rptConcName, rptConcRank, rptDay, rptHour, rptMedian, rptMoney, rptN, rptPct, rptQuantile, rptYmd, stopNetEff
} from '../../apps/desk/js/rules/reports.js';
import { AND_UNIT, CREDIT_ONLY_UNIT, FREE_ONLY_UNIT, LONG_LEASE_UNIT, MIXED_UNIT, NO_INCENTIVE_UNIT, OP_ONLY_UNIT, OR_UNIT } from './fixtures.js';

// ---------- invented data ----------
const NOW = new Date('2026-10-06T14:10:00');   // Tue Oct 6, 2026, 2:10 PM in New York (the zone is pinned in vitest.config.js)
const at = (day, hm = '12:00') => new Date(`${day}T${hm}:00`).toISOString();
const WK1 = '2026-09-28', WK2 = '2026-10-05';   // last week's Monday and this week's

// Today's showsheet, in the shape the Desk parses
const U = (b, group, unit, type, monthly, netEff, incentive, extra = {}) => ({ building: `${b} TIDEMARK BLVD`, bedroomGroup: group, unit, type, monthly, netEff, incentive, avail: 'Immediately', priority: false, hasApp: false, ...extra });
const S506 = U('2050', 'STUDIOS', '506', 'Studio, 1 Bath Alc', 3295, null, 'No Incentive');
const S714 = U('2230', 'STUDIOS', '714', 'Studio, 1 Bath', 3195, 2929, '1 Month Free OR 1 Mo. OP');
const S308 = U('2120', 'STUDIOS', '308', 'Studio, 1 Bath', 3050, 2950, 'Reduced rent');   // a NET EFF with no free months to read
const B1812 = U('2050', '1 BEDROOMS', '1812', '1 Bed, 1 Bath W/D', 4150, 3804, '1 Month Free OR 1 Mo. OP');
const B2203 = U('2050', '1 BEDROOMS', '2203', '1 Bed, 1 Bath W/D Balc', 4495, 4120, '1 Month Free OR 1 Mo. OP');
const B906 = U('2120', '1 BEDROOMS', '906', '1 Bed, 1 Bath W/D', 3895, 3570, '1 Month Free OR 1 Mo. OP');
const B2901 = U('2050', '2 BEDROOMS', '2901', '2 Bed, 2 Bath W/D WIC', 6450, 5913, '1 Month Free and 1/2 Mo. OP');
const B4201 = U('2230', '3 BEDROOMS', '4201', '3 Bed, 2 Bath W/D Terr', 8950, 8204, '2 Months Free on 24-Month Lease');
const C1104 = U('2040', 'CONVERTIBLES', '1104', 'Conv, 1 Bath', 3450, null, 'No Incentive');   // the type doesn't say a size
const PH2 = U('2110', 'PENTHOUSES', 'PH2', 'Penthouse, 2 Bath Terr', 9950, null, 'No Incentive');
const SHEET = [S506, S714, S308, B1812, B2203, B906, B2901, B4201, C1104, PH2];

// A stop as the iPad saves it: the showsheet unit, any per-tour changes, and the opMode and term it quotes with
function stop(u, over = {}) {
  const st = { key: fpKey(u.building, u.unit), building: u.building, unit: u.unit, type: u.type, monthly: u.monthly, netEff: u.netEff, incentive: u.incentive, avail: u.avail,
    rent: '', free: 0, op: 0, opMode: 'or', credit: '', notes: '', ...over };
  return Object.assign(st, savedQuoteFields(st));
}
const HAND_TYPED = { building: '2120 TIDEMARK BLVD', unit: '1501', type: 'Studio', monthly: '', rent: '', custom: true };   // no rent
// A started prospect tour: set up 10 minutes before the start, finished 40 minutes after
let n = 0;
function tour(start, stops, extra = {}) {
  const s = new Date(start), mins = m => new Date(s.getTime() + m * 60000).toISOString();
  return { id: 'r' + (++n), kind: 'tour', assistant: 'Rosa', prospect: 'Maya K.', broker: false, createdAtIso: mins(-10), queuedAtIso: mins(-10),
    startedAtIso: start, finishedAtIso: mins(40), stops, profile: { beds: ['1 Bed'], priceMax: 4500, moveIn: '2026-11-15', flexible: false }, ...extra };
}
const model = (tours, opts = {}) => reportModel({ tours, units: SHEET, quiz: [], weeks: 4, now: NOW, ...opts });

// ---------- what counts ----------
describe('what counts as a tour', () => {
  it('a tour counts once it is started; inspections, tours never started and broken start times are left out', () => {
    const rows = [
      tour(at(WK2, '11:00'), [stop(B1812), stop(S714)]),
      { ...tour(at(WK2, '12:00'), [stop(B906)]), kind: 'inspection' },
      { ...tour(at(WK2, '13:00'), [stop(B906)]), startedAtIso: null },   // still in the queue
      { ...tour(at(WK2, '13:00'), [stop(B906)]), startedAtIso: 'not a date' },
      null,
    ];
    const m = model(rows);
    expect(m.tours.length).toBe(1);
    expect(m.shown.length).toBe(2);
  });
  it('a tour counts in the period it was started in: Monday 00:00 to the end of Sunday', () => {
    const rows = [tour(at('2026-08-01'), [stop(B1812)]), tour(at('2026-09-13', '23:59'), [stop(B1812)]), tour(at('2026-09-14', '00:00'), [stop(B1812)])];
    expect(model(rows).tours.map(r => r.startedAtIso)).toEqual([at('2026-09-14', '00:00')]);
  });
});

describe('apartments shown', () => {
  const T1 = tour(at('2026-09-21', '11:00'), [stop(B1812), stop(S714)]);
  const T2 = tour(at(WK1, '11:00'), [stop(B1812), stop(B906)]);
  const T3 = tour(at(WK2, '11:00'), [{ ...stop(B1812), unit: '01812' }]);   // the same apartment, typed with a leading zero

  it('every unit on a started tour is shown; the same apartment shown again is still one different apartment', () => {
    const m = model([T1, T2, T3]);
    expect(m.shown.length).toBe(5);
    expect(m.apts.length).toBe(3);
  });
  it('most-shown first; a tie goes to the one shown most recently', () => {
    const m = model([T1, T2, T3]);
    expect(m.apts.map(a => [a.key, a.n])).toEqual([['2050|1812', 3], ['2120|906', 1], ['2230|714', 1]]);
    expect(m.apts[0].last).toBe(T3.startedAtIso);
  });
  it('by size, week by week, and by building in the demo\'s order', () => {
    const m = model([T1, T2, T3]);
    expect(m.sizes).toEqual(REPORT_SIZES);
    expect(m.sizeTotals).toEqual({ 'Studio': 1, '1 Bed': 4, '2 Bed': 0, '3 Bed': 0 });
    expect(m.weeks.map(w => w.label)).toEqual(['Sep 21', 'Sep 28', 'This week']);
    expect(m.bySizeWeek['1 Bed']).toEqual([1, 2, 1]);
    expect(m.shownPerWeek).toEqual([2, 2, 1]);
    expect(m.bldgs).toEqual(['2050', '2230', '2120', '2040', '2110']);
    expect(m.bySizeBldg['1 Bed']).toEqual([3, 0, 1, 0, 0]);
    expect(m.bySizeBldg['Studio']).toEqual([0, 1, 0, 0, 0]);
  });
  it('the building filter keeps only that building\'s units, and only the tours that visited it', () => {
    const b2050 = model([T1, T2, T3], { bldg: '2050' });
    expect([b2050.tours.length, b2050.shown.length, b2050.apts.length]).toEqual([3, 3, 1]);
    expect(b2050.bldgs).toEqual(['2050']);
    expect(b2050.bySizeBldg['1 Bed']).toEqual([3]);
    expect(b2050.bldg).toBe('2050 Tidemark Blvd');
    const b2120 = model([T1, T2, T3], { bldg: '2120' });
    expect([b2120.tours.length, b2120.shown.length, b2120.apts.map(a => a.key)]).toEqual([1, 1, ['2120|906']]);
    expect(model([T1, T2, T3], { bldg: '2040' }).tours.length).toBe(0);
    expect(model([T1, T2, T3]).bldg).toBe('');
  });
});

// ---------- the period ----------
describe('the period: This week, 2, 4 or 6 weeks, Monday to Sunday', () => {
  const ROWS = [
    tour(at('2026-08-20'), [stop(B1812)]),            // before every period: the records begin earlier
    tour(at('2026-08-30', '23:30'), [stop(B1812)]),   // the Sunday before 6 weeks
    tour(at('2026-08-31', '00:00'), [stop(B1812)]),   // the first minute of 6 weeks
    tour(at('2026-09-13', '23:59'), [stop(B1812)]),   // the last minute before 4 weeks
    tour(at('2026-09-14', '00:00'), [stop(B1812)]),   // the first minute of 4 weeks
    tour(at('2026-10-04', '18:00'), [stop(B1812)]),   // last Sunday: 2 weeks, not this week
    tour(at(WK2, '09:00'), [stop(B1812)]),
    tour(at('2026-10-06', '13:00'), [stop(B1812)]),
  ];
  it('This week: Monday to now, one column', () => {
    const m = model(ROWS, { weeks: 1 });
    expect([m.label, m.tours.length, m.weeks.length, m.weeks[0].label]).toEqual(['Oct 5 – Oct 6, 2026', 2, 1, 'This week']);
  });
  it('2 weeks', () => {
    const m = model(ROWS, { weeks: 2 });
    expect([m.label, m.tours.length, m.toursPerWeek]).toEqual(['Sep 28 – Oct 6, 2026', 3, [1, 2]]);
  });
  it('4 weeks (where Reports opens)', () => {
    const m = model(ROWS, { weeks: 4 });
    expect([m.label, m.tours.length, m.weeks.map(w => w.label)]).toEqual(['Sep 14 – Oct 6, 2026', 4, ['Sep 14', 'Sep 21', 'Sep 28', 'This week']]);
    expect(m.weeks[1].long).toBe('week of Sep 21');
    expect(m.weeks[3].long).toBe('this week (Oct 5 on, so far)');
  });
  it('6 weeks; "a week" is the typical full week (this week, still going, is left out of it)', () => {
    const m = model(ROWS, { weeks: 6 });
    expect([m.label, m.tours.length, m.toursPerWeek]).toEqual(['Aug 31 – Oct 6, 2026', 6, [1, 1, 1, 0, 1, 2]]);
    expect(m.fullWeeks).toEqual([0, 1, 2, 3, 4]);
    expect(m.weekTyp).toBe(1);
    expect(m.startsLater).toBe(false);
  });
  it('records that begin inside the period: it starts at the first week with a tour, says so, and that week isn\'t a full one', () => {
    const rows = [tour(at('2026-09-23', '11:00'), [stop(B1812)]), tour(at(WK2, '11:00'), [stop(B1812)])];
    const m = model(rows, { weeks: 4 });
    expect([m.startsLater, m.label, m.firstIso]).toEqual([true, 'Sep 21 – Oct 6, 2026', at('2026-09-23', '11:00')]);
    expect(m.weeks.map(w => w.full)).toEqual([false, true, false]);
    expect(m.fullWeeks).toEqual([1]);
    expect(model(rows, { weeks: 1 }).startsLater).toBe(false);
  });
  it('… unless the read hit its limit (the earliest tours may be missing): then the whole period stays', () => {
    const rows = [tour(at('2026-09-23', '11:00'), [stop(B1812)]), tour(at(WK2, '11:00'), [stop(B1812)])];
    const m = model(rows, { weeks: 4, maxTours: 2 });
    expect([m.capped, m.startsLater, m.weeks.length]).toEqual([true, false, 4]);
    expect(m.weeks.map(w => w.full)).toEqual([true, true, true, false]);
  });
  it('a week ending on the clock-change Sunday (Nov 1, 2026) ends on Nov 1, and a tour late that night counts in it', () => {
    const now = new Date('2026-11-01T23:40:00');
    const m = reportModel({ tours: [tour(at('2026-11-01', '23:15'), [stop(B1812)])], units: SHEET, weeks: 1, now });
    expect(m.label).toBe('Oct 26 – Nov 1, 2026');
    expect(m.toursPerWeek).toEqual([1]);
    expect((m.weeks[0].end - m.weeks[0].start) / 36e5).toBe(7 * 24 + 1);   // the week has the extra hour
  });
  it('… and on the spring-forward Sunday (Mar 8, 2026) it still ends on Mar 8, not Mar 7', () => {
    const m = reportModel({ tours: [], units: SHEET, weeks: 1, now: new Date('2026-03-08T22:00:00') });
    expect(m.label).toBe('Mar 2 – Mar 8, 2026');
  });
  it('a period crossing New Year shows the start year', () => {
    const now = new Date('2027-01-06T12:00:00');
    const rows = [tour(at('2026-12-01'), [stop(B1812)]), tour(at('2026-12-31', '15:00'), [stop(B1812)])];
    const m = reportModel({ tours: rows, units: SHEET, weeks: 4, now });
    expect(m.label).toBe('Dec 14, 2026 – Jan 6, 2027');
    expect(m.weeks.map(w => w.label)).toEqual(['Dec 14', 'Dec 21', 'Dec 28', 'This week']);
    expect(m.toursPerWeek).toEqual([0, 0, 1, 0]);
    expect(reportModel({ tours: rows, units: SHEET, weeks: 1, now }).label).toBe('Jan 4 – Jan 6, 2027');
  });
});

// ---------- sizes ----------
describe('sizes', () => {
  it('read from unit types and sign-in sizes however they are written; "1.5 Bed" is not read as 5', () => {
    const read = ['2-Bedroom', '1BR', '2BR2BA', 'Studio Alc', 'Studio, 1 Bath', '1.5 Bed', '2 Bdrm, 2 Bth, W/D', 'Jr 1 Bed', '2 Bed/1 Bath', '4 Bed, 3 Bath', 'Loft', '', undefined];
    expect(read.map(reportSize)).toEqual(['2 Bed', '1 Bed', '2 Bed', 'Studio', 'Studio', 'Other', '2 Bed', '1 Bed', '2 Bed', '3 Bed', 'Other', 'Other', 'Other']);
  });
  it('a showsheet section reads like the unit list\'s quick filters: Convertibles are studios, Penthouses 3 Bed', () => {
    expect(['CONVERTIBLES', 'PENTHOUSES', 'JR 1 BEDROOMS', '2 BEDROOMS', 'STUDIOS', 'TOWNHOUSES'].map(reportGroupSize)).toEqual(['Studio', '3 Bed', '1 Bed', '2 Bed', 'Studio', 'Other']);
  });
  it('a type that doesn\'t say a size takes it from the unit\'s section on today\'s showsheet; a unit not on it is Other', () => {
    const loft = { building: '2040 TIDEMARK BLVD', unit: '9', type: 'Loft', monthly: 5000, custom: true };
    const m = model([tour(at(WK2), [stop(C1104), stop(PH2), loft])]);
    expect(m.shown.map(s => s.size)).toEqual(['Studio', '3 Bed', 'Other']);
    expect(m.sizes).toEqual([...REPORT_SIZES, 'Other']);
    expect(m.sizeTotals).toEqual({ 'Studio': 1, '1 Bed': 0, '2 Bed': 0, '3 Bed': 1, 'Other': 1 });
  });
});

describe('the typical value and where most fell', () => {
  it('nearest-rank quarters: a value someone actually gave; the middle half of three runs from the lowest to the highest', () => {
    expect([rptQuantile([3000, 3500, 4000], 0.25), rptQuantile([3000, 3500, 4000], 0.75)]).toEqual([3000, 4000]);
    expect([0.25, 0.5, 0.75].map(q => rptQuantile([4, 1, 3, 2], q))).toEqual([1, 2, 3]);
  });
  it('the median of an even count is the middle two averaged; nothing to work from is null', () => {
    expect(rptMedian([3195, 2929, 3295, 2929])).toBe(3062);
    expect([rptMedian([]), rptQuantile([], 0.25)]).toEqual([null, null]);
  });
  it('the list passed in is left as it was', () => {
    const a = [3, 1, 2]; rptQuantile(a, 0.5); rptMedian(a);
    expect(a).toEqual([3, 1, 2]);
  });
});

// ---------- money ----------
// What the iPad puts in front of the prospect for a stop: the net effective when it quotes one, otherwise the rent (no
// concession, or a broker on an OR deal, where "If the broker waives the OP: … → net" is the broker's choice, not the price)
function ipadPrice(st, broker) {
  const q = quoteLines(st, broker), ne = /^Net effective \$([\d,]+)/.exec(q.line2);
  return ne ? +ne[1].replace(/,/g, '') : resolveStop(st).rent;
}

describe('the net of an apartment shown is what the iPad quotes for that stop', () => {
  const CASES = [
    ['no broker on an OR unit: the free month over 12 months', OR_UNIT, false, {}, 3804],
    ['a broker on an OR unit: the OP goes to the broker, so the prospect pays the rent', OR_UNIT, true, {}, 4150],
    ['a broker on an AND unit: the prospect still gets the net', AND_UNIT, true, {}, 5913],
    ['a 24-month unit: 2 months free over 24 months, not 12', LONG_LEASE_UNIT, false, {}, 8204],
    ['a rent typed over on the iPad: the free month on the typed rent', OR_UNIT, false, { rent: '4000' }, 3667],
    ['a rent typed over on the 24-month unit: over 24 months', LONG_LEASE_UNIT, false, { rent: '8500' }, 7792],
    ['a credit typed on the tour is quoted next to the rent, never taken off the net', LONG_LEASE_UNIT, false, { credit: '1200' }, 8204],
    ['a credit on a broker tour on an OR unit: still the rent', OR_UNIT, true, { credit: '500' }, 4150],
    ['free months typed on the tour beat the showsheet\'s: ½ month on a broker AND unit', AND_UNIT, true, { free: 0.5 }, 6181],
    ['free months typed on a broker tour on an OR unit: still the rent (an override never changes the broker rule)', OR_UNIT, true, { free: 0.5 }, 4150],
    ['"and" and "OR" mixed is an OR incentive: no broker → the net', MIXED_UNIT, false, {}, 3804],
    ['… with a broker → the rent', MIXED_UNIT, true, {}, 4150],
    ['a credit-only unit: no free months to read, so the showsheet\'s NET EFF stands', CREDIT_ONLY_UNIT, false, {}, 3875],
    ['no incentive: the rent', NO_INCENTIVE_UNIT, false, {}, 3600],
    ['a broker on an OP-only unit: the rent', OP_ONLY_UNIT, true, {}, 4150],
  ];
  for (const [name, unit, broker, over, net] of CASES) {
    it(`${name}: ${rptMoney(net)}`, () => {
      const st = stop(unit, over);
      expect(stopNetEff(st, broker)).toBe(net);
      expect(ipadPrice(st, broker)).toBe(net);
    });
  }
});

describe('net rent: the term and the limits', () => {
  it('the stop\'s saved term wins: a Desk "Other concession" of 1 month free on a 14-month lease nets $3,854, as its email says', () => {
    const st = { ...stop(FREE_ONLY_UNIT), free: 1, term: 14 };   // how the Desk's Plan a tour saves it
    expect(stopNetEff(st, false)).toBe(3854);
    expect(resolveConcession(selectionFromStop(st, FREE_ONLY_UNIT, { broker: false, floorPlans: {}, now: 0 })).netEff).toBe(3854);
  });
  it('no term saved: the unit\'s lease term from its incentive text, 12 months when it states none', () => {
    const bare = u => ({ monthly: u.monthly, netEff: u.netEff, incentive: u.incentive });
    expect(stopNetEff(bare(LONG_LEASE_UNIT), false)).toBe(8204);
    expect(stopNetEff({ ...bare(FREE_ONLY_UNIT), free: 0.5 }, false)).toBe(3977);
  });
  it('never above the rent: a rent typed under the showsheet\'s NET EFF, with no free months to read, nets at the rent', () => {
    expect(stopNetEff(stop(NO_INCENTIVE_UNIT, { rent: '3800', netEff: 4000 }), false)).toBe(3800);
    expect(stopNetEff(stop(CREDIT_ONLY_UNIT, { rent: '3800' }), false)).toBe(3800);
  });
  it('no rent (a unit typed in by hand without one): 0, and it is left out of every net figure', () => {
    expect(stopNetEff(HAND_TYPED, false)).toBe(0);
  });
});

describe('net rent of the apartments shown, by size and week by week', () => {
  const ROWS = [
    tour(at(WK1, '11:00'), [stop(S714)]),                             // $2,929: 1 month free over 12
    tour(at(WK1, '12:00'), [stop(S714)], { broker: true }),           // $3,195: a broker on an OR deal pays the rent
    tour(at(WK2, '11:00'), [stop(S506), HAND_TYPED]),                 // $3,295, and a studio with no rent (shown, not priced)
    tour(at(WK2, '12:00'), [stop(S714, { credit: '500' })]),          // $2,929: the credit isn't taken off
    tour(at(WK2, '13:00'), [stop(B4201)]),                            // $8,204: over its 24-month lease
    tour(at(WK2, '14:00'), [stop(B1812, { rent: '4000' })]),          // $3,667: a typed rent
  ];
  it('each size: how many priced showings, the typical net, the middle half, and the typical rent before the concession', () => {
    const m = model(ROWS, { weeks: 2 });
    expect(m.netBySize).toEqual([
      { size: 'Studio', n: 4, p25: 2929, med: 3062, p75: 3195, rent: 3195 },
      { size: '1 Bed', n: 1, p25: 3667, med: 3667, p75: 3667, rent: 4000 },
      { size: '2 Bed', n: 0, p25: null, med: null, p75: null, rent: null },
      { size: '3 Bed', n: 1, p25: 8204, med: 8204, p75: 8204, rent: 8950 },
    ]);
    expect(m.sizeTotals.Studio).toBe(5);
  });
  it('the typical net each week, per size (no showings: none)', () => {
    const m = model(ROWS, { weeks: 2 });
    expect(m.netByWeek).toEqual({ 'Studio': [3062, 3112], '1 Bed': [null, 3667], '2 Bed': [null, null], '3 Bed': [null, 8204] });
  });
});

describe('shown within the prospect\'s price', () => {
  const p = (priceMax, more = {}) => ({ profile: { beds: ['Studio'], priceMax, ...more } });
  it('the net (the rent with no concession) against the top of their price: within, or over by how much a month', () => {
    const rows = [
      tour(at(WK2, '10:00'), [stop(S714)], p(3000)),                                // $2,929: within
      tour(at(WK2, '11:00'), [stop(S714)], { broker: true, ...p(3000) }),           // $3,195: over by $195
      tour(at(WK2, '12:00'), [stop(S506)], p('$3,300')),                            // $3,295: within ("$3,300" as typed)
      tour(at(WK2, '13:00'), [stop(B4201)], { profile: { beds: ['3 Bed'], priceMax: 8000 } }),   // $8,204: over by $204
    ];
    const m = model(rows);
    expect(m.fit).toEqual({ units: 4, fits: 2, over: 2, overBy: [195, 204] });
    expect(m.fitBySize.Studio).toEqual({ units: 3, fits: 2, over: 1, overBy: [195] });
    expect(m.fitBySize['3 Bed']).toEqual({ units: 1, fits: 0, over: 1, overBy: [204] });
  });
  it('left out: "budget flexible", a top price under $1,000 or over $30,000 (a typo), no top price, and a unit with no rent', () => {
    const rows = [
      tour(at(WK2, '10:00'), [stop(S506)], p(3300, { priceFlexible: true })),
      tour(at(WK2, '11:00'), [stop(S506)], p(450)),
      tour(at(WK2, '12:00'), [stop(S506)], p(45000)),
      tour(at(WK2, '13:00'), [stop(S506)], { profile: { beds: ['Studio'], priceMin: 3000 } }),
      tour(at(WK2, '14:00'), [HAND_TYPED], p(3300)),
    ];
    expect(model(rows).fit).toEqual({ units: 0, fits: 0, over: 0, overBy: [] });
  });
  it('a credit doesn\'t bring the net under their price: $2,929 with a $1,200 credit is still over $2,900', () => {
    const m = model([tour(at(WK2), [stop(S714, { credit: '1200' })], p(2900))]);
    expect(m.fit).toEqual({ units: 1, fits: 0, over: 1, overBy: [29] });
  });
  it('the budget: the top price between $1,000 and $30,000, else none', () => {
    const b = profile => rptBudget({ profile });
    expect([b({ priceMax: 1000 }), b({ priceMax: 30000 }), b({ priceMax: '$4,500' }), b({ priceMax: 999 }), b({ priceMax: 30001 }), b({ priceMax: 4500, priceFlexible: true }), b(null), b('odd')])
      .toEqual([1000, 30000, 4500, 0, 0, 0, 0, 0]);
    expect(rptBudget(null)).toBe(0);
  });
});

describe('the concession behind the net, week by week (D38)', () => {
  it('free months typed on the tour, else the showsheet\'s; a credit only; another concession; none', () => {
    expect(concOf(stop(S714, { free: 1.5 }), false)).toBe('1.5');
    expect(concOf(stop(S714), false)).toBe('1');
    expect(concOf(stop(S714, { free: 0.5, credit: '500' }), false)).toBe('0.5');
    expect(concOf(stop(S506, { credit: '1200' }), false)).toBe('credit');
    expect(concOf(stop(S308), false)).toBe('other');
    expect(concOf(stop(S506), false)).toBe('none');
  });
  it('a broker on an OR deal counts as no concession for the prospect, even with free months typed on the tour', () => {
    expect(concOf(stop(S714), true)).toBe('none');
    expect(concOf(stop(S714, { free: 1.5 }), true)).toBe('none');
    expect(concOf(stop(S308), true)).toBe('other');   // not an OR deal: the NET EFF is still the prospect's
  });
  it('a broker on an AND deal: the prospect keeps the free month', () => {
    expect(concOf(stop(B2901), true)).toBe('1');
  });
  it('a rent typed under the showsheet\'s NET EFF, with no free months to read: none (it nets at the rent)', () => {
    expect(concOf(stop(S308, { rent: '2900' }), false)).toBe('none');
  });
  it('week by week for each size: who asked for it at sign-in, and how many priced showings had each concession', () => {
    const rows = [
      tour(at(WK1, '11:00'), [stop(S714)], { profile: { beds: ['Studio'] } }),
      tour(at(WK1, '12:00'), [stop(S714, { free: 1.5 })], { profile: { beds: ['Studio', '1 Bed'] } }),
      tour(at(WK2, '11:00'), [stop(S506, { credit: '1200' }), HAND_TYPED], { profile: { beds: ['Studio'] } }),
      tour(at(WK2, '12:00'), [stop(S714)], { broker: true, profile: { beds: ['1 Bed'] } }),
      tour(at(WK2, '13:00'), [stop(S506)], { profile: { beds: [] } }),
      tour(at(WK2, '14:00'), [stop(S308)], { profile: { beds: ['2 Bed/1 Bath'] } }),
    ];
    const m = model(rows, { weeks: 2 });
    expect(m.concWeek.Studio).toEqual([{ '1': 1, '1.5': 1 }, { credit: 1, none: 2, other: 1 }]);
    expect(m.askWeek).toEqual({ 'Studio': [2, 1], '1 Bed': [1, 1], '2 Bed': [0, 1], '3 Bed': [0, 0] });
    expect(m.bySizeWeek.Studio).toEqual([2, 5]);   // shown counts the studio with no rent; the concessions don't
  });
  it('columns run most free months first, then credit only, other, none, with plain names', () => {
    const keys = ['none', '1', 'credit', '1.5', 'other', '0.5'].sort((a, b) => rptConcRank(a) - rptConcRank(b));
    expect(keys).toEqual(['1.5', '1', '0.5', 'credit', 'other', 'none']);
    expect(keys.map(rptConcName)).toEqual(['1.5 months free', '1 month free', '½ month free', 'Credit only', 'Other concession', 'No concession']);
    expect(['2', '0.25', '0.75'].map(rptConcName)).toEqual(['2 months free', '¼ month free', '¾ month free']);
  });
});

// ---------- what prospects want ----------
describe('sizes asked for vs available now', () => {
  const rows = [
    tour(at(WK2, '10:00'), [stop(S506)], { profile: { beds: ['Studio', '1 Bed'] } }),
    tour(at(WK2, '11:00'), [stop(B2901)], { profile: { beds: ['2 Bed/1 Bath'] } }),
    tour(at(WK2, '12:00'), [stop(B906)], { profile: { beds: ['1 Bed', '1 Bed'] } }),   // the same size twice counts once
    tour(at(WK2, '13:00'), [stop(B906)], { profile: { beds: ['Loft'] } }),              // no size read
    tour(at(WK2, '14:00'), [stop(B906)], { profile: { beds: 'Studio' } }),              // not a list
  ];
  const units = [S506, S714, C1104, B1812, { ...B2203, hasApp: true }, { ...B906, backupApps: true }, { ...B4201, availStatus: 'occupied' }, B2901, PH2];
  it('each tour counts once per size it asked for; tours with no size read are left out of the shares', () => {
    const m = model(rows, { units });
    expect([m.asked, m.askedTotal, m.toursWithSize.length]).toEqual([{ 'Studio': 1, '1 Bed': 2, '2 Bed': 1, '3 Bed': 0 }, 4, 3]);
  });
  it('available now: every unit on today\'s showsheet without an application ("Backup apps welcome" still counts), by size and section', () => {
    const m = model(rows, { units });
    expect([m.availNow, m.availTotal]).toEqual([{ 'Studio': 3, '1 Bed': 2, '2 Bed': 1, '3 Bed': 2 }, 8]);
  });
  it('the building filter: that building\'s units, and the tours that visited it', () => {
    const m = model(rows, { units, bldg: '2050' });
    expect([m.asked, m.availNow]).toEqual([{ 'Studio': 1, '1 Bed': 1, '2 Bed': 1, '3 Bed': 0 }, { 'Studio': 1, '1 Bed': 1, '2 Bed': 1, '3 Bed': 0 }]);
  });
});

describe('when they want to move in', () => {
  const mv = (moveIn, flexible = false, day = WK2) => tour(at(day), [stop(B1812)], { profile: { beds: ['1 Bed'], moveIn, flexible } });
  const EARLY = tour(at('2026-08-03'), [stop(B1812)], { profile: { beds: ['1 Bed'], moveIn: '2026-09-01' } });   // records begin before the period
  it('month by month from the first month asked for, empty months kept; months before the period are "Earlier"', () => {
    const m = model([EARLY, mv('2026-08-20'), mv('2026-10-15'), mv('2026-10-30'), mv('2026-12-01'), mv('2027-01-10')]);
    expect(m.months.map(x => [x.label, x.n])).toEqual([['Earlier', 1], ["Oct '26", 2], ["Nov '26", 0], ["Dec '26", 1], ["Jan '27", 1]]);
    expect(m.months[0].long).toBe('before September 2026');
    expect(m.months[1].long).toBe('October 2026');
  });
  it('at most 8 bars: the 8th becomes "Later" and holds the rest, even a mistyped far-off year', () => {
    const m = model(['2026-10-10', '2027-02-10', '2027-05-10', '2027-09-10', '9999-12-01'].map(d => mv(d)));
    expect(m.months.map(x => [x.label, x.n])).toEqual([["Oct '26", 1], ["Nov '26", 0], ["Dec '26", 0], ["Jan '27", 0], ["Feb '27", 1], ["Mar '27", 0], ["Apr '27", 0], ['Later', 3]]);
    expect(m.months[7].long).toBe('May 2027 or later');
  });
  it('a move-in typed as December 9999, alone: one bar for it (the months don\'t run on past the year 9999)', () => {
    expect(model([mv('9999-12-01')]).months.map(x => [x.label, x.n])).toEqual([["Dec '99", 1]]);
  });
  it('flexible: said flexible and gave no date; a tour with a date counts by its date', () => {
    const m = model([mv('', true), mv('soon', true), mv('', false), mv('2026-11-01', true), mv('2026-13-01', false)]);
    expect([m.withDate.length, m.flexible]).toEqual([1, 2]);
  });
  it('typical days from the tour to the move-in (a move-in before the tour is left out)', () => {
    const m = model([mv('2026-08-20'), mv('2026-10-15'), mv('2026-10-30'), mv('2026-12-01'), mv('2027-01-10')]);
    expect(m.leadMed).toBe(41);   // 10, 25, 57 and 97 days
    expect(model([]).leadMed).toBe(null);
  });
});

// ---------- traffic and team ----------
describe('busiest days and times, by when prospects arrive', () => {
  const arrive = (created, queued, start) => ({ ...tour(start, [stop(B1812)]), createdAtIso: created, queuedAtIso: queued });
  const ROWS = [
    arrive(at(WK2, '10:50'), at(WK2, '10:50'), at(WK2, '11:05')),                   // Monday 10 AM: set up 15 minutes before the start
    arrive(at('2026-10-04', '16:00'), at('2026-10-04', '16:00'), at(WK2, '13:30')), // planned the day before: Monday 1 PM, the start
    arrive(null, at('2026-10-06', '11:40'), at('2026-10-06', '12:05')),             // no set-up time: the queue time, Tuesday 11 AM
    arrive(at('2026-10-06', '11:15'), null, at('2026-10-06', '11:25')),             // Tuesday 11 AM
    arrive(at('2026-10-06', '12:30'), null, at('2026-10-06', '12:00')),             // set up after the start: the start, Tuesday 12 PM
    arrive(at('2026-10-06', '09:00'), null, at('2026-10-06', '13:00')),             // exactly 4 hours before: the start, Tuesday 1 PM
    arrive(at('2026-10-06', '07:20'), null, at('2026-10-06', '07:30')),             // Tuesday 7 AM: the hours start earlier
    arrive(at(WK2, '22:20'), null, at(WK2, '22:30')),                               // Monday 10 PM: counts in the last hour, 9 PM
  ];
  it('a day × hour grid from the set-up time when it is within 4 hours before the start, else the start', () => {
    const m = model(ROWS, { weeks: 1 });
    expect(m.hours).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    const cells = day => m.hours.filter((h, i) => m.grid[day][i]).map(h => [rptHour(h), m.grid[day][m.hours.indexOf(h)]]);
    expect(cells(0)).toEqual([['10 AM', 1], ['1 PM', 1], ['9 PM', 1]]);
    expect(cells(1)).toEqual([['7 AM', 1], ['11 AM', 2], ['12 PM', 1], ['1 PM', 1]]);
  });
  it('day totals add up to the tours; the busiest hour and day', () => {
    const m = model(ROWS, { weeks: 1 });
    expect(m.dayTotals).toEqual([3, 5, 0, 0, 0, 0, 0]);
    expect(m.arrivals).toBe(m.tours.length);
    expect([m.top, m.topDay, m.heatMax]).toEqual([{ day: 1, hour: 11, n: 2 }, 1, 2]);
  });
  it('10 AM to 5 PM unless arrivals fall outside it; no tours: no busiest hour', () => {
    expect(model([ROWS[0]], { weeks: 1 }).hours).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
    const empty = model([]);
    expect([empty.top, empty.heatMax, empty.arrivals]).toEqual([null, 0, 0]);
  });
});

describe('typical tour length', () => {
  it('the median of the tours that count toward tour times (under 5 minutes, over 2 hours, left out or still running don\'t)', () => {
    const len = (start, mins, extra = {}) => ({ ...tour(start, [stop(B1812)]), finishedAtIso: mins == null ? null : new Date(new Date(start).getTime() + mins * 60000).toISOString(), ...extra });
    const rows = [
      len(at(WK1, '10:00'), 40), len(at(WK1, '11:00'), 3), len(at(WK1, '12:00'), 150),
      len(at(WK2, '10:00'), 45), len(at(WK2, '11:00'), 50), len(at(WK2, '12:00'), 30, { timeExcluded: true }), len(at(WK2, '13:00'), null),
      { ...tour(at(WK2, '17:30'), [stop(B1812)]), finishedAtIso: at('2026-10-06', '09:00') },   // finished the next morning
    ];
    const m = model(rows, { weeks: 2 });
    expect(m.typical).toEqual({ med: 45, n: 3 });
    expect(m.weekLens).toEqual([[40], [45, 50]]);
  });
});

describe('training quiz results in the period', () => {
  const QUIZ = [
    { name: 'Rosa', passed: true, dateIso: at(WK2, '09:40'), missed: [{ category: 'Requirements' }, { category: 'Broker quoting' }] },
    { name: 'Tariq', passed: false, dateIso: at('2026-10-02', '16:15'), missed: [{ category: 'Requirements' }, { category: 'Buildings' }, { category: 'Requirements' }] },
    { name: 'Jun', passed: true, dateIso: at('2026-09-01', '11:05'), missed: [{ category: 'Buildings' }] },   // before the period
    { name: 'Nadia', passed: false, dateIso: at('2026-09-20', '10:30'), missed: 'oops' },                    // misses not a list
    null,
    { name: 'Marco', passed: true, dateIso: at('2026-10-06', '09:00'), missed: [null, { q: 'no topic' }] },
  ];
  it('attempts, how many passed, and the most-missed topics, for the attempts in the period', () => {
    const q = model([], { quiz: QUIZ }).quiz;
    expect([q.loaded, q.attempts, q.passed, q.rows.map(r => r.name)]).toEqual([true, 4, 2, ['Rosa', 'Tariq', 'Nadia', 'Marco']]);
    expect(q.topics).toEqual([['Requirements', 3], ['Broker quoting', 1], ['Buildings', 1]]);
  });
  it('quiz results that didn\'t load say so (not zero attempts)', () => {
    expect(model([], { quiz: null }).quiz).toEqual({ loaded: false, rows: [], attempts: 0, passed: 0, topics: [] });
    expect(model([], { quiz: [] }).quiz.loaded).toBe(true);
  });
});

// ---------- today's showsheet ----------
describe('status today', () => {
  it('each kind, as the unit lists show it', () => {
    const kinds = [undefined, { hasApp: true }, { hasApp: true, backupApps: true }, { backupApps: true }, { availStatus: 'occupied' }, { avail: 'Occupied' }, { availStatus: 'reno' }, { avail: 'Immediately' }];
    expect(kinds.map(liveStatus)).toEqual(['Not on the showsheet', 'App pending', 'App pending', 'Backup apps welcome', 'Occupied', 'Occupied', 'Currently Undergoing Renovation', 'Available']);
  });
  it('the most-shown list gives each apartment\'s status today; "still available" = on today\'s showsheet with no application', () => {
    const units = [B1812, { ...B906, hasApp: true }, { ...S714, backupApps: true }, { ...S506, availStatus: 'occupied', avail: 'November 1, 2026' }, { ...B2901, availStatus: 'reno', avail: 'October 15, 2026' }];
    const gone = { building: '2040 TIDEMARK BLVD', unit: '1207', type: '1 Bed, 1 Bath', monthly: 3750 };
    const m = model([tour(at(WK2), [stop(B1812), stop(B906), stop(S714), stop(S506), stop(B2901), gone])], { units });
    const status = Object.fromEntries(m.apts.map(a => [a.key, a.status]));
    expect(status).toEqual({ '2050|1812': 'Available', '2120|906': 'App pending', '2230|714': 'Backup apps welcome', '2050|506': 'Occupied',
      '2050|2901': 'Currently Undergoing Renovation', '2040|1207': 'Not on the showsheet' });
    expect(m.stillAvail.map(a => a.key).sort()).toEqual(['2050|1812', '2050|2901', '2050|506', '2230|714']);
    expect(m.apts.find(a => a.key === '2050|1812').live).toBe(B1812);
  });
  it('no showsheet loaded: no status ("—") and nothing still available', () => {
    const m = model([tour(at(WK2), [stop(B1812)])], { units: [] });
    expect([m.haveSheet, m.apts[0].status, m.stillAvail.length, m.availTotal]).toEqual([false, '—', 0, 0]);
  });
});

// ---------- odd saved data ----------
describe('odd saved data never stops Reports', () => {
  it('tours, stops, sizes, move-ins, quiz misses and showsheet units of the wrong kind are skipped or read as text', () => {
    const markup = '<img src=x onerror="window.__pwned=1">';
    const rows = [
      'not a tour',
      tour(at(WK2, '10:00'), 'oops'),   // stops not a list: a tour with nothing shown
      tour(at(WK2, '11:00'), [null, 'x', 42, { building: markup, unit: '<b>9</b>', type: '1 Bed', monthly: 4000 }], { profile: { beds: 'Studio', moveIn: '9999-12-01', priceMax: '4,200' } }),
      tour(at(WK2, '12:00'), [stop(B1812)], { profile: 'not an object' }),
    ];
    let m;
    expect(() => { m = reportModel({ tours: rows, units: [null, 'x', ...SHEET], quiz: [{ name: 'Ellis', passed: false, dateIso: at(WK2), missed: 'oops' }], weeks: 4, now: NOW }); }).not.toThrow();
    expect([m.tours.length, m.shown.length]).toEqual([3, 2]);
    const typed = m.apts.find(a => a.b === 'Other');
    expect([typed.unit, typed.status]).toEqual(['<b>9</b>', 'Not on the showsheet']);   // shown as text by the panel, never as markup
    expect(m.bldgs).toEqual([...REPORT_BLDGS, 'Other']);
    expect(m.bySizeBldg['1 Bed']).toEqual([1, 0, 0, 0, 0, 1]);
    expect(m.months.length).toBe(8);   // the year-9999 move-in lands in "Later"
    expect(m.months[7]).toMatchObject({ label: 'Later', n: 1 });
    expect([m.asked.Studio, m.fit.units]).toEqual([0, 1]);   // sizes not in a list: none read; "4,200" is a top price; a profile that isn't one: none
    expect(m.quiz.topics).toEqual([]);
  });
  it('nothing read yet, or not a list at all: an empty report for the period', () => {
    for (const tours of [undefined, null, {}, 'oops']) {
      const m = reportModel({ tours, units: undefined, now: NOW });
      expect([m.tours.length, m.shown.length, m.label, m.haveSheet]).toEqual([0, 0, 'Sep 14 – Oct 6, 2026', false]);
    }
  });
});

describe('how numbers read', () => {
  it('money, shares, hours, counts and days', () => {
    expect([rptMoney(3062.4), rptMoney(null), rptMoney(NaN)]).toEqual(['$3,062', '—', '—']);
    expect([rptPct(2, 3), rptPct(1, 0)]).toEqual(['67%', '—']);
    expect([0, 9, 12, 13, 21].map(rptHour)).toEqual(['12 AM', '9 AM', '12 PM', '1 PM', '9 PM']);
    expect([rptN(1, 'tour'), rptN(1200, 'tour'), rptN(2, 'body', 'bodies')]).toEqual(['1 tour', '1,200 tours', '2 bodies']);
    expect([rptDay(at('2026-09-14')), rptYmd(new Date(2026, 8, 4))]).toEqual(['Sep 14', '2026-09-04']);
  });
  it('buildings in the demo\'s order, named on its street', () => {
    expect(REPORT_BLDGS).toEqual(['2050', '2230', '2120', '2040', '2110']);
    expect(reportBldgLabel('2110')).toBe('2110 Tidemark Blvd');
  });
});
