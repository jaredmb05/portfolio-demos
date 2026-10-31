// What a prospect tour needs before it goes in the queue or starts (production Desk v1.34 / iPad v1.27, D45): the list and its
// message are one module both apps use (apps/shared/tour-required.js), the price boxes take whole dollars
// (apps/shared/format.js), and the one-line summary of the prospect's needs says "budget flexible" (apps/shared/unit-options.js).
import { describe, expect, it } from 'vitest';
import { moneyText, moneyTyped, parseMoney } from '../../apps/shared/format.js';
import { detailsMissing, stillNeeded, tourMissing } from '../../apps/shared/tour-required.js';
import { profileSummary } from '../../apps/shared/unit-options.js';
import { reportModel, rptBudget } from '../../apps/desk/js/rules/reports.js';

const complete = (over = {}) => ({ kind: 'tour', prospectFirst: 'Maren', broker: false, brokerLast: '',
  profile: { beds: ['1 Bed'], priceMin: 3800, priceMax: 4500, priceFlexible: false, moveIn: '2026-11-15', flexible: false }, stops: [{ unit: '1812' }], ...over });
const withProfile = over => complete({ profile: { ...complete().profile, ...over } });
const fields = (t, opts) => tourMissing(t, opts).map(m => m.field);
const DESK = {}, IPAD = { needUnit: true };   // the Desk sends a tour without units; the iPad needs one

describe('what a prospect tour needs (D45), the same list on the Desk and the iPad', () => {
  it('an empty tour: first name, size, the most they\'d pay and a move-in date, in that order; the iPad adds a unit last', () => {
    const empty = { kind: 'tour', profile: { beds: [] }, stops: [] };
    expect(fields(empty, DESK)).toEqual(['first', 'beds', 'max', 'moveIn']);
    expect(fields(empty, IPAD)).toEqual(['first', 'beds', 'max', 'moveIn', 'units']);
  });
  it('one message names everything missing, the last joined with "and"', () => {
    const empty = { kind: 'tour', profile: null, stops: [] };
    expect(stillNeeded(tourMissing(empty, DESK))).toBe("Still needed: first name, size, the most they'd pay (or Flexible) and move-in date (or Flexible).");
    expect(stillNeeded(tourMissing(empty, IPAD))).toBe("Still needed: first name, size, the most they'd pay (or Flexible), move-in date (or Flexible) and at least one unit.");
    expect(stillNeeded(tourMissing(withProfile({ beds: [], moveIn: '' }), DESK))).toBe('Still needed: size and move-in date (or Flexible).');
    expect(stillNeeded(tourMissing(withProfile({ moveIn: '' }), DESK))).toBe('Still needed: move-in date (or Flexible).');
  });
  it('a complete tour needs nothing, and there is no message', () => {
    expect(tourMissing(complete(), IPAD)).toEqual([]);
    expect(stillNeeded([])).toBe('');
  });
  it('the price\'s Flexible box stands in for the top price; a minimum alone doesn\'t', () => {
    expect(fields(withProfile({ priceMax: null, priceFlexible: true }), DESK)).toEqual([]);
    expect(fields(withProfile({ priceMax: null, priceMin: 3800 }), DESK)).toEqual(['max']);
  });
  it('the date\'s Flexible box stands in for a move-in date', () => {
    expect(fields(withProfile({ moveIn: '', flexible: true }), DESK)).toEqual([]);
    expect(fields(withProfile({ moveIn: '', flexible: false }), DESK)).toEqual(['moveIn']);
  });
  it('a top price counts in whole dollars as typed ("$4,500", "4500.75"); zero, cents only or no digits don\'t', () => {
    expect(fields(withProfile({ priceMax: '$4,500' }), DESK)).toEqual([]);
    expect(fields(withProfile({ priceMax: '4500.75' }), DESK)).toEqual([]);
    for (const none of [0, '0', '.99', 'abc', '', null]) expect(fields(withProfile({ priceMax: none }), DESK)).toEqual(['max']);
  });
  it('touring with a broker: the broker\'s last name, right after the first name; no broker, no broker name', () => {
    expect(fields(complete({ broker: true, brokerLast: '' }), DESK)).toEqual(['brokerLast']);
    expect(fields(complete({ broker: true, brokerLast: '  ' }), DESK)).toEqual(['brokerLast']);
    expect(fields({ kind: 'tour', broker: true, profile: {}, stops: [] }, DESK)).toEqual(['first', 'brokerLast', 'beds', 'max', 'moveIn']);
    expect(fields(complete({ broker: false, brokerLast: '' }), DESK)).toEqual([]);
  });
  it('a first name of spaces only is missing', () => {
    expect(fields(complete({ prospectFirst: '   ' }), DESK)).toEqual(['first']);
  });
  it('a resident inspection needs only the name here (its unit is asked for where it\'s typed), in the resident\'s words', () => {
    expect(tourMissing({ kind: 'inspection', prospectFirst: 'Odile', profile: null, stops: [] }, IPAD)).toEqual([]);
    expect(tourMissing({ kind: 'inspection', prospectFirst: '', profile: null, stops: [] }, IPAD)).toEqual([{ field: 'first', name: 'first name', note: "Enter the resident's first name." }]);
  });
  it('each item carries the note shown under its field', () => {
    expect(tourMissing({ kind: 'tour', broker: true, profile: {}, stops: [] }, IPAD).map(m => m.note)).toEqual([
      "Enter the prospect's first name.", "Enter the broker's last name.", 'Pick at least one size.',
      "Enter the most they'd pay per month, or tick Flexible.", 'Pick a move-in date, or tick Flexible.', '']);
  });
  it('a tour with units: the Desk and the iPad ask for exactly the same', () => {
    const t = withProfile({ beds: [], priceMax: null });
    expect(tourMissing(t, IPAD)).toEqual(tourMissing(t, DESK));
  });
});

describe('the details before the units (production iPad v1.28, D48)', () => {
  it('Done and a unit tap ask for the same as Send to queue minus the unit: never "at least one unit"', () => {
    const empty = { kind: 'tour', profile: {}, stops: [] };
    expect(detailsMissing(empty).map(m => m.field)).toEqual(['first', 'beds', 'max', 'moveIn']);
    expect(stillNeeded(detailsMissing(complete({ prospectFirst: 'Dora', profile: {}, stops: [] })))).toBe("Still needed: size, the most they'd pay (or Flexible) and move-in date (or Flexible).");
  });
  it('the details in but no unit yet: nothing to ask (Send to queue and Start still need a unit)', () => {
    const noUnit = complete({ stops: [] });
    expect(detailsMissing(noUnit)).toEqual([]);
    expect(tourMissing(noUnit, IPAD).map(m => m.field)).toEqual(['units']);
  });
  it('the broker\'s last name is a detail; an inspection is never asked', () => {
    expect(detailsMissing(complete({ broker: true, brokerLast: '' })).map(m => m.field)).toEqual(['brokerLast']);
    expect(detailsMissing({ kind: 'inspection', prospectFirst: 'Odile', profile: null, stops: [] })).toEqual([]);
  });
  it('the same items, notes and order as the full list, without the unit', () => {
    const t = { kind: 'tour', broker: true, profile: {}, stops: [] };
    expect(detailsMissing(t)).toEqual(tourMissing(t, IPAD).slice(0, -1));
  });
});

describe('price boxes take whole dollars (D45)', () => {
  it('the number: cents (anything after a ".") and letters dropped; nothing, zero or no digits is no price', () => {
    expect(['4500.75', '$4,500', 'abc3,2 00', '4,500.99', 4500, '  6200 '].map(parseMoney)).toEqual([4500, 4500, 3200, 4500, 4500, 6200]);
    expect(['', '0', '.75', 'abc', null, undefined].map(parseMoney)).toEqual([null, null, null, null, null, null]);
  });
  it('what the box shows: "$4,500"; nothing for no price', () => {
    expect(['4500.75', 4500, '12345678', ''].map(moneyText)).toEqual(['$4,500', '$4,500', '$12,345,678', '']);
  });
  it('typing: the box shows "$4,500" and the cursor stays after the digit just typed', () => {
    expect(moneyTyped('4500', 4)).toEqual({ value: '$4,500', caret: 6 });
    expect(moneyTyped('$4,5000', 7)).toEqual({ value: '$45,000', caret: 7 });
    expect(moneyTyped('$4,5900', 5)).toEqual({ value: '$45,900', caret: 5 });   // a 9 typed after the 5: the cursor right after the 9
  });
  it('typing cents: they\'re dropped and the cursor goes to the end of the dollars', () => {
    expect(moneyTyped('4500.75', 7)).toEqual({ value: '$4,500', caret: 6 });
  });
  it('deleting: the cursor stays where the deleted digit was', () => {
    expect(moneyTyped('$4,00', 3)).toEqual({ value: '$400', caret: 2 });   // the 5 of $4,500 deleted: the cursor after the 4
    expect(moneyTyped('$,500', 1)).toEqual({ value: '$500', caret: 0 });    // the first digit deleted
  });
  it('letters only: the box empties', () => {
    expect(moneyTyped('abc', 3)).toEqual({ value: '', caret: 0 });
  });
});

describe('the prospect\'s needs in one line (both apps)', () => {
  it('the price\'s Flexible box reads "budget flexible"', () => {
    expect(profileSummary({ beds: ['1 Bed'], priceFlexible: true, moveIn: '2026-11-15' })).toBe('1 Bed · budget flexible · move-in Nov 15');
    expect(profileSummary({ beds: ['2 Bed'], priceFlexible: true, flexible: true })).toBe('2 Bed · budget flexible · move-in flexible');
  });
  it('a price range and the Flexible box both show', () => {
    expect(profileSummary({ beds: ['Studio'], priceMin: 3000, priceMax: 3400, priceFlexible: true, moveIn: '2026-11-15' })).toBe('Studio · $3,000–$3,400 · budget flexible · move-in Nov 15');
  });
  it('without it, as before', () => {
    expect(profileSummary({ beds: ['1 Bed'], priceMax: 4500, priceFlexible: false, moveIn: '2026-11-15' })).toBe('1 Bed · up to $4,500 · move-in Nov 15');
  });
});

describe('Reports: a flexible budget has no top price (D45)', () => {
  const unit = { building: '2050 TIDEMARK BLVD', bedroomGroup: 'STUDIOS', unit: '506', type: 'Studio, 1 Bath Alc', monthly: 3295, netEff: null, incentive: 'No Incentive', avail: 'Immediately' };
  const stop = { key: '2050|506', building: unit.building, unit: '506', type: unit.type, monthly: 3295, netEff: null, incentive: 'No Incentive', rent: '', free: 0, term: 12, op: 0, opMode: 'or', credit: '', notes: '' };
  const tour = (id, profile) => ({ id, kind: 'tour', prospect: 'Maren V.', assistant: 'Rosa', stops: [stop], profile,
    createdAtIso: '2026-10-05T14:00:00.000Z', queuedAtIso: '2026-10-05T14:00:00.000Z', startedAtIso: '2026-10-05T14:10:00.000Z', finishedAtIso: '2026-10-05T14:50:00.000Z' });
  const fit = tours => reportModel({ tours, units: [unit], quiz: [], weeks: 1, now: new Date('2026-10-06T14:10:00') }).fit;
  it('a tour sent with only the price\'s Flexible box ticked is left out of "within their price"', () => {
    expect(rptBudget(tour('f', { beds: ['Studio'], priceFlexible: true, moveIn: '2026-11-01' }))).toBe(0);
    expect(fit([tour('f', { beds: ['Studio'], priceFlexible: true, moveIn: '2026-11-01' })])).toEqual({ units: 0, fits: 0, over: 0, overBy: [] });
  });
  it('the same apartment shown to a prospect who gave a top price is counted', () => {
    expect(fit([tour('m', { beds: ['Studio'], priceMax: 3300, moveIn: '2026-11-01' })])).toEqual({ units: 1, fits: 1, over: 0, overBy: [] });
  });
});
