// Net effective rent and the per-tour overrides: the iPad's free / OP / credit / rent overrides,
// and the Desk's "Other concession" (free months, lease term, broker OP, credit).
import { describe, expect, it } from 'vitest';
import { money, netEffective, resolveOp } from '../../apps/shared/pricing.js';
import { formatRent } from '../../apps/shared/format.js';
import { deskEmail, ipadQuote, LONG_LEASE_UNIT, OR_UNIT } from './fixtures.js';

describe('net effective rent', () => {
  it('is the rent averaged over the lease after the free months: $4,150, 1 free on 12 → $3,804.17', () => {
    expect(netEffective(4150, 12, 1, 0)).toBeCloseTo(3804.17, 2);
  });
  it('with no free months it is the rent; a credit never changes it (D19)', () => {
    expect(netEffective(4150, 12, 0)).toBe(4150);
  });
  it('uses the lease term it is given: $8,950, 2 free on 24 → $8,204.17', () => {
    expect(netEffective(8950, 24, 2, 0)).toBeCloseTo(8204.17, 2);
  });
});

describe('iPad per-tour overrides', () => {
  it('a free-month override replaces the showsheet concession: ½ month free on $4,150 → net $3,977', () => {
    expect(ipadQuote(OR_UNIT, { stop: { free: 0.5 } })).toEqual({ line1: '$4,150 · ½ month free', line2: 'Net effective $3,977' });
  });
  it('a credit override is quoted next to the concession and left out of the net effective: + $600, net stays $3,804', () => {
    expect(ipadQuote(OR_UNIT, { stop: { credit: '600' } })).toEqual({ line1: '$4,150 · 1 Month Free + $600 credit', line2: 'Net effective $3,804' });
  });
  it('a rent override replaces the showsheet rent and the net is worked out from it: $3,995 → net $3,662', () => {
    expect(ipadQuote(OR_UNIT, { stop: { rent: '3995' } })).toEqual({ line1: '$3,995 · 1 Month Free', line2: 'Net effective $3,662' });
  });
  it('an OP override changes only what the broker is quoted', () => {
    expect(ipadQuote(OR_UNIT, { broker: true, stop: { op: 0.5 } })).toEqual({ line1: '$4,150 · 1/2 Mo. OP to the broker', line2: 'If the broker waives the OP: 1 Month Free → net $3,804' });
  });
  it('zero overrides mean "use the showsheet"', () => {
    expect(ipadQuote(OR_UNIT, { stop: { free: 0, op: 0, credit: '' } })).toEqual(ipadQuote(OR_UNIT));
  });
  it('when the free months can\'t be read from the incentive, the showsheet net effective is used: "3 Weeks Free" → $4,712', () => {
    const unit = { building: '2040 Tidemark Blvd', unit: '506', monthly: 5000, netEff: 4712, incentive: '3 Weeks Free' };
    expect(ipadQuote(unit).line2).toBe('Net effective $4,712');
  });
});

describe('Desk "Other concession"', () => {
  const other = fields => ({ edit: { otherConc: true, otherFree: 0, otherTerm: 12, otherOp: 0, otherCredit: '', ...fields } });

  it('free months replace the showsheet concession and set the net effective: ½ month free on 12 → $3,977', () => {
    expect(deskEmail(OR_UNIT, other({ otherFree: 0.5 }))).toEqual({ text: '½ month free on a 12-month lease', netEff: 3977 });
  });
  it('the lease term field is used for the net effective: 1 month free on 24 → $8,577', () => {
    expect(deskEmail(LONG_LEASE_UNIT, other({ otherFree: 1, otherTerm: 24 }))).toEqual({ text: '1 month free on a 24-month lease', netEff: 8577 });
  });
  it('a credit is quoted with the concession and left out of the net effective: 1 free + $600 on 12, net stays $3,804', () => {
    expect(deskEmail(OR_UNIT, other({ otherFree: 1, otherCredit: '600' }))).toEqual({ text: '1 month free on a 12-month lease plus a $600 one-time credit', netEff: 3804 });
  });
  it('a credit alone keeps the showsheet concession and its net effective: $3,804', () => {
    expect(deskEmail(OR_UNIT, other({ otherCredit: '600' }))).toEqual({ text: '1 Month Free plus a $600 one-time credit', netEff: 3804 });
  });
  it('the credit label is whatever the Desk typed', () => {
    expect(deskEmail(OR_UNIT, other({ otherFree: 1, otherCredit: '250', otherCreditLabel: 'gift card' })).text).toBe('1 month free on a 12-month lease plus a $250 gift card');
  });
  it('a broker-only OP replaces the showsheet concession, with no net effective', () => {
    expect(deskEmail(OR_UNIT, { broker: true, ...other({ otherOp: 1 }) })).toEqual({ text: '1 Mo. OP', netEff: null });
  });
  it('a blank or zero lease term counts as 12 months', () => {
    expect(deskEmail(OR_UNIT, other({ otherFree: 1, otherTerm: '' })).text).toBe('1 month free on a 12-month lease');
    expect(deskEmail(OR_UNIT, other({ otherFree: 1, otherTerm: '0' })).netEff).toBe(3804);
  });
});

describe('broker OP typed as "Other…"', () => {
  it('months up to 12 are months: "1.5" → 1.5 Mo. OP, "0.5" → 1/2 Mo. OP', () => {
    expect(resolveOp({ otherOp: 'custom', otherOpCustom: '1.5' })).toEqual({ amount: 1.5, label: '1.5 Mo. OP' });
    expect(resolveOp({ otherOp: 'custom', otherOpCustom: '0.5' })).toEqual({ amount: 0.5, label: '1/2 Mo. OP' });
  });
  it('a $ sign or anything over 12 is dollars: "$3000" and "3000" → $3,000 OP', () => {
    expect(resolveOp({ otherOp: 'custom', otherOpCustom: '$3000' })).toEqual({ amount: 3000, label: '$3,000 OP' });
    expect(resolveOp({ otherOp: 'custom', otherOpCustom: '3000' })).toEqual({ amount: 3000, label: '$3,000 OP' });
  });
  it('blank means no OP', () => {
    expect(resolveOp({ otherOp: 'custom', otherOpCustom: '' })).toEqual({ amount: 0, label: '' });
  });
  it('a preset is read from the list: 0.75 → 3/4 Mo. OP', () => {
    expect(resolveOp({ otherOp: '0.75' })).toEqual({ amount: 0.75, label: '3/4 Mo. OP' });
  });
});

describe('money formatting', () => {
  it('the iPad shows whole dollars with commas, and nothing for zero or text', () => {
    expect(money(4150)).toBe('$4,150');
    expect(money('3,804')).toBe('$3,804');
    expect(money(4150.6)).toBe('$4,151');
    expect(money(0)).toBe('');
    expect(money('call')).toBe('');
  });
  it('the Desk shows "?" for a missing rent', () => {
    expect(formatRent(4150)).toBe('4,150');
    expect(formatRent('')).toBe('?');
    expect(formatRent(null)).toBe('?');
  });
});
