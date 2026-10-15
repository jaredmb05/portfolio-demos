// The rulings on the cases where the two apps disagreed (AUDIT.md §8 M1–M5; §11, including the follow-up rulings)
// and the Desk's own AND/OR selector (D19). Credits are quoted next to the rent and never included in the net effective.
// Rent and net effective are the showsheet's; "override" means a per-tour change made on the iPad or at the Desk.
import { describe, expect, it } from 'vitest';
import { parseIncentive, resolveConcession } from '../../apps/shared/pricing.js';
import { AND_UNIT, deskEmail, FREE_ONLY_UNIT, ipadQuote, LONG_LEASE_UNIT, MIXED_UNIT, OR_UNIT } from './fixtures.js';

const custom = incentive => ({ building: '2040 Tidemark Blvd', unit: '1204', monthly: 4000, netEff: '', incentive });

describe('M1: net effective uses the unit\'s lease term, not an assumed 12 months', () => {
  it('iPad: 2 months free on a 24-month lease at $8,950 → net $8,204 (the showsheet\'s figure)', () => {
    expect(ipadQuote(LONG_LEASE_UNIT)).toEqual({ line1: '$8,950 · 2 Months Free on 24-Month Lease', line2: 'Net effective $8,204' });
  });
  it('iPad: a free-month override keeps the unit\'s 24-month term: 1 month free → net $8,577', () => {
    expect(ipadQuote(LONG_LEASE_UNIT, { stop: { free: 1 } })).toEqual({ line1: '$8,950 · 1 month free', line2: 'Net effective $8,577' });
  });
  it('iPad: a credit is quoted next to the concession and left out of the net: + $1,200, net stays $8,204', () => {
    expect(ipadQuote(LONG_LEASE_UNIT, { stop: { credit: '1200' } })).toEqual({ line1: '$8,950 · 2 Months Free on 24-Month Lease + $1,200 credit', line2: 'Net effective $8,204' });
  });
  it('both apps read the term however it is written: "on 24-Month Lease", "24-Mo Lease", "24 month lease"', () => {
    for (const incentive of ['2 Months Free on 24-Month Lease', '2 Months Free, 24-Mo Lease', '2 Months Free on a 24 month lease']) {
      const unit = { ...LONG_LEASE_UNIT, incentive };
      expect(ipadQuote(unit).line2).toBe('Net effective $8,204');
      expect(deskEmail(unit, { stop: { free: 1 } }).text).toBe('1 month free on a 24-month lease');
    }
  });
  it('iPad: when the free months can\'t be read, the showsheet net effective still stands on a 24-month lease: $5,654', () => {
    const unit = { building: '2110 Tidemark Blvd', unit: '1507', monthly: 6000, netEff: 5654, incentive: '6 Weeks Free on 24-Month Lease' };
    expect(ipadQuote(unit).line2).toBe('Net effective $5,654');
  });
  it('Desk: the email shows the showsheet net effective for the 24-month unit: $8,204', () => {
    expect(deskEmail(LONG_LEASE_UNIT)).toEqual({ text: '2 Months Free on 24-Month Lease', netEff: 8204 });
  });
  it('Desk: an iPad free-month override on the 24-month unit keeps its term: "1 month free on a 24-month lease", $8,577', () => {
    expect(deskEmail(LONG_LEASE_UNIT, { stop: { free: 1 } })).toEqual({ text: '1 month free on a 24-month lease', netEff: 8577 });
  });
  it('Desk: "Other concession" on a unit added by hand starts at the unit\'s term: 1 month free → "1 month free on a 24-month lease", $8,577', () => {
    expect(resolveConcession({ ...LONG_LEASE_UNIT, showNetEff: true, noBroker: true, otherConc: true, otherFree: 1, otherOp: 0 })).toEqual({ text: '1 month free on a 24-month lease', netEff: 8577 });
  });
});

describe('M2: "½" reads the same as "1/2"', () => {
  it('"½ Month Free" on a $4,000 custom unit → net $3,833', () => {
    expect(ipadQuote(custom('½ Month Free'))).toEqual({ line1: '$4,000 · ½ Month Free', line2: 'Net effective $3,833' });
  });
  it('"1/2 Month Free" on the same unit → net $3,833', () => {
    expect(ipadQuote(custom('1/2 Month Free')).line2).toBe('Net effective $3,833');
  });
  it('"1½ Months Free" → 1.5 months → net $3,500', () => {
    expect(parseIncentive('1½ Months Free').freeMonths).toBe(1.5);
    expect(ipadQuote(custom('1½ Months Free')).line2).toBe('Net effective $3,500');
  });
  it('"1 1/2 Months Free" reads the same as "1½": net $3,500', () => {
    expect(parseIncentive('1 1/2 Months Free').freeMonths).toBe(1.5);
    expect(ipadQuote(custom('1 1/2 Months Free')).line2).toBe('Net effective $3,500');
  });
});

describe('M3: text mixing "and" and "or" is an OR incentive', () => {
  it('"1 Month Free and $500 Credit OR 1 Mo. OP": the prospect side is "1 Month Free and $500 Credit", the broker side "1 Mo. OP"', () => {
    expect(parseIncentive(MIXED_UNIT.incentive)).toMatchObject({ mode: 'or', conc: '1 Month Free and $500 Credit', opText: '1 Mo. OP', freeMonths: 1 });
  });
  it('iPad, broker: the OP to the broker; if the broker waives, the free month and the credit, with the credit left out of the net: $3,804', () => {
    expect(ipadQuote(MIXED_UNIT, { broker: true })).toEqual({ line1: '$4,150 · 1 Mo. OP to the broker', line2: 'If the broker waives the OP: 1 Month Free and $500 Credit → net $3,804' });
  });
  it('iPad, no broker: the free month and the credit, net $3,804', () => {
    expect(ipadQuote(MIXED_UNIT)).toEqual({ line1: '$4,150 · 1 Month Free and $500 Credit', line2: 'Net effective $3,804' });
  });
  it('Desk, broker: the OP only, no net effective', () => {
    expect(deskEmail(MIXED_UNIT, { broker: true })).toEqual({ text: '1 Mo. OP', netEff: null });
  });
  it('Desk, no broker: the free month and the credit, net $3,804', () => {
    expect(deskEmail(MIXED_UNIT)).toEqual({ text: '1 Month Free and $500 Credit', netEff: 3804 });
  });
});

describe('M4: broker on an AND unit gets the OP, and the prospect still gets the net effective', () => {
  it('Desk: "1 Month Free and 1/2 Mo. OP" with net effective $5,913', () => {
    expect(deskEmail(AND_UNIT, { broker: true })).toEqual({ text: '1 Month Free and 1/2 Mo. OP', netEff: 5913 });
  });
  it('Desk: a broker tour on a unit with no OP on the showsheet still shows the prospect\'s net effective: "1 Month Free", $3,804', () => {
    expect(deskEmail(FREE_ONLY_UNIT, { broker: true })).toEqual({ text: '1 Month Free', netEff: 3804 });
  });
});

describe('M5: a per-tour override changes amounts only, never the broker rule', () => {
  it('Desk, broker, OR unit, iPad override ½ month free: the email quotes the OP only', () => {
    expect(deskEmail(OR_UNIT, { broker: true, stop: { free: 0.5 } })).toEqual({ text: '1 Mo. OP', netEff: null });
  });
  it('… and when the broker waives ("OP only" unchecked): "½ month free on a 12-month lease", $3,977', () => {
    expect(deskEmail(OR_UNIT, { broker: true, stop: { free: 0.5 }, edit: { opOnly: false } })).toEqual({ text: '½ month free on a 12-month lease', netEff: 3977 });
  });
  it('Desk, broker, OR unit, iPad overrides ½ month free and 1/2 Mo. OP: the email quotes the overridden OP only', () => {
    expect(deskEmail(OR_UNIT, { broker: true, stop: { free: 0.5, op: 0.5 } })).toEqual({ text: '1/2 Mo. OP', netEff: null });
  });
  it('… and when the broker waives: "½ month free on a 12-month lease", $3,977', () => {
    expect(deskEmail(OR_UNIT, { broker: true, stop: { free: 0.5, op: 0.5 }, edit: { opOnly: false } })).toEqual({ text: '½ month free on a 12-month lease', netEff: 3977 });
  });
  it('Desk, broker, OR unit, iPad override of the OP only: the overridden OP, no net effective', () => {
    expect(deskEmail(OR_UNIT, { broker: true, stop: { op: 0.5 } })).toEqual({ text: '1/2 Mo. OP', netEff: null });
  });
  it('Desk, broker, AND unit, iPad override of the OP only (1 Mo. OP): the prospect keeps the free month and the net: "1 Month Free and 1 Mo. OP", $5,913', () => {
    expect(deskEmail(AND_UNIT, { broker: true, stop: { op: 1 } })).toEqual({ text: '1 Month Free and 1 Mo. OP', netEff: 5913 });
  });
  it('Desk, broker, AND unit, iPad override of the free months only (½): the broker keeps the showsheet OP: "½ month free and 1/2 Mo. OP on a 12-month lease", $6,181', () => {
    expect(deskEmail(AND_UNIT, { broker: true, stop: { free: 0.5 } })).toEqual({ text: '½ month free and 1/2 Mo. OP on a 12-month lease', netEff: 6181 });
  });
  it('iPad, broker, AND unit, override ½ month free: both, with the prospect\'s net $6,181', () => {
    expect(ipadQuote(AND_UNIT, { broker: true, stop: { free: 0.5 } })).toEqual({ line1: '$6,450 · ½ month free AND 1/2 Mo. OP', line2: 'Net effective $6,181 · broker also gets the OP' });
  });
  it('Desk, broker, AND unit, iPad overrides ½ month free and 1 Mo. OP: still AND: "½ month free and 1 Mo. OP on a 12-month lease", $6,181', () => {
    expect(deskEmail(AND_UNIT, { broker: true, stop: { free: 0.5, op: 1 } })).toEqual({ text: '½ month free and 1 Mo. OP on a 12-month lease', netEff: 6181 });
  });
  it('Desk, no broker, iPad override ½ month free: the override and its net, $3,977', () => {
    expect(deskEmail(OR_UNIT, { stop: { free: 0.5 } })).toEqual({ text: '½ month free on a 12-month lease', netEff: 3977 });
  });
  it('iPad, broker, OR unit, override ½ month free: the OP to the broker; ½ month free only if the broker waives → $3,977', () => {
    expect(ipadQuote(OR_UNIT, { broker: true, stop: { free: 0.5 } })).toEqual({ line1: '$4,150 · 1 Mo. OP to the broker', line2: 'If the broker waives the OP: ½ month free → net $3,977' });
  });
  it('iPad, broker, AND unit, overrides ½ month free and 1 Mo. OP: both, with the prospect\'s net $6,181', () => {
    expect(ipadQuote(AND_UNIT, { broker: true, stop: { free: 0.5, op: 1 } })).toEqual({ line1: '$6,450 · ½ month free AND 1 Mo. OP', line2: 'Net effective $6,181 · broker also gets the OP' });
  });
});

describe('D19: the Desk email honors its own AND/OR selector ("Free Months & OP Offered As")', () => {
  // Broker tour on an OR unit; at the Desk, "Other concession" is set to 1 month free and 1/2 Mo. OP on a 12-month lease
  const other = (mode, more = {}) => ({ otherConc: true, otherFree: 1, otherOp: 0.5, otherOpMode: mode, otherTerm: 12, ...more });

  it('Both (AND): both, with the prospect\'s net: "1 month free and 1/2 Mo. OP on a 12-month lease", $3,804', () => {
    expect(deskEmail(OR_UNIT, { broker: true, edit: other('and') })).toEqual({ text: '1 month free and 1/2 Mo. OP on a 12-month lease', netEff: 3804 });
  });
  it('Either/or, broker not waiving: the OP only, no net effective: "1/2 Mo. OP"', () => {
    expect(deskEmail(OR_UNIT, { broker: true, edit: other('or') })).toEqual({ text: '1/2 Mo. OP', netEff: null });
  });
  it('Either/or, broker waives ("OP only" unchecked): "1 month free on a 12-month lease", $3,804', () => {
    expect(deskEmail(OR_UNIT, { broker: true, edit: other('or', { opOnly: false }) })).toEqual({ text: '1 month free on a 12-month lease', netEff: 3804 });
  });
  it('Both (AND) with "No broker" ticked: the OP is dropped: "1 month free on a 12-month lease", $3,804', () => {
    expect(deskEmail(OR_UNIT, { broker: true, edit: other('and', { noBroker: true }) })).toEqual({ text: '1 month free on a 12-month lease', netEff: 3804 });
  });
  it('a broker tour starts with "OP only" ticked under Either/or, even on an AND unit: "1/2 Mo. OP", no net', () => {
    expect(deskEmail(AND_UNIT, { broker: true, edit: other('or') })).toEqual({ text: '1/2 Mo. OP', netEff: null });
  });
  it('no broker on the tour ("No broker" ticked, "OP only" unticked by default): the OP is never mentioned, whichever way the selector is set', () => {
    expect(deskEmail(OR_UNIT, { edit: other('and') })).toEqual({ text: '1 month free on a 12-month lease', netEff: 3804 });
    expect(deskEmail(OR_UNIT, { edit: other('or') })).toEqual({ text: '1 month free on a 12-month lease', netEff: 3804 });
  });
});
