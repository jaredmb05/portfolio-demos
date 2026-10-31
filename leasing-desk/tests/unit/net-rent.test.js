// Net effective rent and the per-tour overrides: the iPad's free / OP / credit / rent overrides,
// and the Desk's "Other concession" (free months, lease term, broker OP, credit).
import { describe, expect, it } from 'vitest';
import { listNet, money, neLeftOut, netEffective, parseIncentive, rentChangedNe, resolveConcession, resolveOp } from '../../apps/shared/pricing.js';
import { formatRent } from '../../apps/shared/format.js';
import { selectionFromStop } from '../../apps/desk/js/rules/tour-selection.js';
import { AND_UNIT, CREDIT_ONLY_UNIT, deskEmail, deskSelection, ipadQuote, LONG_LEASE_UNIT, NO_INCENTIVE_UNIT, OR_UNIT } from './fixtures.js';

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

// Production D28 (Desk v1.25), with this repo's ruling R1 (the unit's lease term, not 12 months; see money-rulings.test.js)
describe('Desk: a rent typed over in a Tour or Inquiry email works the net effective out again', () => {
  const typed = (unit, monthly, more = {}) => deskEmail(unit, { ...more, edit: { monthly, ...(more.edit || {}) } });

  it('1 Month Free on a 12-month lease, rent typed as $4,000: $4,000 × 11 ÷ 12 → $3,667', () => {
    expect(typed(OR_UNIT, '4000')).toEqual({ text: '1 Month Free', netEff: 3667 });
  });
  it('a rent typed with a $ sign and a comma reads the same: "$4,000" → $3,667', () => {
    expect(typed(OR_UNIT, '$4,000').netEff).toBe(3667);
  });
  it('rent put back to the showsheet rent: the showsheet\'s own NET EFF returns, even where it rounds its own way ($3,805)', () => {
    const unit = { ...OR_UNIT, netEff: 3805 };
    expect(typed(unit, '4000').netEff).toBe(3667);
    expect(typed(unit, '4150')).toEqual({ text: '1 Month Free', netEff: 3805 });
  });
  it('a dollar credit only, rent typed: no free months to work from, so the email leaves the net effective out', () => {
    expect(deskEmail(CREDIT_ONLY_UNIT)).toEqual({ text: '$1,500 move-in credit', netEff: 3875 });
    expect(typed(CREDIT_ONLY_UNIT, '3800')).toEqual({ text: '$1,500 move-in credit', netEff: null });
  });
  it('free months the incentive doesn\'t state in months ("6 Weeks Free"), rent typed: the net effective is left out', () => {
    const unit = { building: '2110 Tidemark Blvd', unit: '1507', monthly: 6000, netEff: 5654, incentive: '6 Weeks Free on 24-Month Lease' };
    expect(typed(unit, '5800').netEff).toBeNull();
  });
  it('a credit is never in the worked-out net: "Other concession" $600 credit on a rent typed as $4,000 → net $3,667', () => {
    expect(typed(OR_UNIT, '4000', { edit: { otherConc: true, otherFree: 0, otherOp: 0, otherCredit: '600' } })).toEqual({ text: '1 Month Free plus a $600 one-time credit', netEff: 3667 });
  });
  it('"Other concession" free months already work from the typed rent: ½ month free on $4,000 → $3,833', () => {
    expect(typed(OR_UNIT, '4000', { edit: { otherConc: true, otherFree: 0.5, otherOp: 0, otherTerm: 12 } })).toEqual({ text: '½ month free on a 12-month lease', netEff: 3833 });
  });
  it('broker on an OR unit, rent typed: still the OP only, no net effective (D19)', () => {
    expect(typed(OR_UNIT, '3995', { broker: true })).toEqual({ text: '1 Mo. OP', netEff: null });
  });
  it('… and if the broker waives the OP: the free month and the worked-out net, $3,662', () => {
    expect(typed(OR_UNIT, '3995', { broker: true, edit: { opOnly: false, showNetEff: true } })).toEqual({ text: '1 Month Free', netEff: 3662 });
  });
  it('broker on an AND unit, rent typed as $6,000: the free month and the OP, with the worked-out net $5,500', () => {
    expect(typed(AND_UNIT, '6000', { broker: true })).toEqual({ text: '1 Month Free and 1/2 Mo. OP', netEff: 5500 });
  });
  it('a unit with no NET EFF on the showsheet ("No Incentive"): a typed rent adds none', () => {
    expect(typed(NO_INCENTIVE_UNIT, '3500')).toEqual({ text: '', netEff: null });
  });
  it('"$1,500 move-in credit" has no free months: the "500 mo" in "$1,500 move-in" is not months', () => {
    expect(parseIncentive(CREDIT_ONLY_UNIT.incentive).freeMonths).toBe(0);
    expect(ipadQuote(CREDIT_ONLY_UNIT).line2).toBe('Net effective $3,875');
  });
});

describe('the worked-out net and the unit card note', () => {
  const sel = (unit, monthly, edit = {}) => deskSelection(unit, { edit: { monthly, ...edit } });

  it('rent not changed: undefined (the showsheet number stands); changed: the worked-out net; no free months: null (left out)', () => {
    expect(rentChangedNe(sel(OR_UNIT, '4150'))).toBeUndefined();
    expect(rentChangedNe(sel(OR_UNIT, '4000'))).toBe(3667);
    expect(rentChangedNe(sel(CREDIT_ONLY_UNIT, '3800'))).toBeNull();
  });
  it('a blank rent box, or a unit added by hand, has nothing to compare: undefined', () => {
    expect(rentChangedNe(sel(OR_UNIT, ''))).toBeUndefined();
    expect(rentChangedNe({ ...sel(OR_UNIT, '4000'), custom: true })).toBeUndefined();
  });
  it('the card says to use "Other concession" while a typed rent leaves the net out, and not once the rent is put back', () => {
    expect(neLeftOut(sel(CREDIT_ONLY_UNIT, '3800'))).toBe(true);
    expect(neLeftOut(sel(CREDIT_ONLY_UNIT, '4000'))).toBe(false);
  });
  it('no note when the net is worked out, when "Other concession" is already on, or when the net isn\'t shown anyway', () => {
    expect(neLeftOut(sel(OR_UNIT, '4000'))).toBe(false);
    expect(neLeftOut(sel(CREDIT_ONLY_UNIT, '3800', { otherConc: true }))).toBe(false);
    expect(neLeftOut(sel(CREDIT_ONLY_UNIT, '3800', { showNetEff: false }))).toBe(false);
  });
});

describe('Desk: a tour reopened from the queue whose rent was changed on the iPad', () => {
  it('the email shows the worked-out net, the same one the iPad quoted: $3,995 → $3,662', () => {
    expect(deskEmail(OR_UNIT, { stop: { rent: '3995' } })).toEqual({ text: '1 Month Free', netEff: 3662 });
    expect(ipadQuote(OR_UNIT, { stop: { rent: '3995' } }).line2).toBe('Net effective $3,662');
  });
  it('on a 24-month unit it works over the 24 months, matching the iPad: $8,500 → $7,792', () => {
    expect(deskEmail(LONG_LEASE_UNIT, { stop: { rent: '8500' } })).toEqual({ text: '2 Months Free on 24-Month Lease', netEff: 7792 });
    expect(ipadQuote(LONG_LEASE_UNIT, { stop: { rent: '8500' } }).line2).toBe('Net effective $7,792');
  });
  it('broker on an OR unit: still the OP only, no net effective (D19)', () => {
    expect(deskEmail(OR_UNIT, { broker: true, stop: { rent: '3995' } })).toEqual({ text: '1 Mo. OP', netEff: null });
  });
  it('a unit no longer on today\'s showsheet: there is no showsheet rent to compare with, so the net is left out', () => {
    const st = { ...OR_UNIT, rent: '3995', opMode: 'or', term: 12 };
    expect(resolveConcession(selectionFromStop(st, undefined, { broker: false, floorPlans: {}, now: 0 })).netEff).toBeNull();
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

// Production Desk v1.34: the Desk's unit list shows the net under the rent, like the iPad's lists. One rule for both apps.
describe('the unit lists: the showsheet\'s net under the rent (Desk and iPad)', () => {
  it('shown when the showsheet has a net other than the rent: "$4,150" with "Net $3,804" under it', () => {
    expect(listNet(OR_UNIT)).toBe('$3,804');
    expect(listNet(LONG_LEASE_UNIT)).toBe('$8,204');
    expect(listNet({ monthly: 3350, netEff: '3071' })).toBe('$3,071');
  });
  it('whole dollars, as the iPad shows it: a net with cents is rounded', () => {
    expect(listNet({ monthly: 3350, netEff: 3071.5 })).toBe('$3,072');
  });
  it('not shown with no net, a net equal to the rent, or a net that isn\'t a number', () => {
    expect([NO_INCENTIVE_UNIT, { monthly: 3295, netEff: null }, { monthly: 3295, netEff: 3295 }, { monthly: 3295, netEff: '$3,100' }, null].map(listNet)).toEqual(['', '', '', '', '']);
  });
  it('the showsheet\'s NET EFF as published, the figure the iPad quote and the Desk email give for the unit as it stands', () => {
    for (const u of [OR_UNIT, AND_UNIT, LONG_LEASE_UNIT, CREDIT_ONLY_UNIT]) {
      expect(ipadQuote(u).line2).toBe('Net effective ' + listNet(u));
      expect(money(deskEmail(u).netEff)).toBe(listNet(u));
    }
  });
});
