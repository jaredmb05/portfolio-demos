// Lounge rental (Private Function Agreement): the fee and when the checks are due.
import { describe, expect, it } from 'vitest';
import { PFA_LOUNGE_RATES, pfaDueDate, pfaFee } from '../../apps/desk/js/rules/pfa.js';
import { ymd } from '../../apps/shared/dates.js';

describe('lounge rental', () => {
  it('the fee is hours × the lounge\'s hourly rate, in whole dollars', () => {
    expect(pfaFee(3, PFA_LOUNGE_RATES['2050'])).toBe(540);
    expect(pfaFee(2.5, PFA_LOUNGE_RATES['2230'])).toBe(300);
    expect(pfaFee(1.33, 120)).toBe(160);
  });
  it('no fee is filled in until both the hours and the rate are known', () => {
    expect(pfaFee(0, 180)).toBeNull();
    expect(pfaFee(3, undefined)).toBeNull();
  });
  it('checks are due 7 calendar days after signing, across month ends and the clock change', () => {
    expect(ymd(pfaDueDate(new Date(2026, 9, 28)))).toBe('2026-11-04');
    expect(ymd(pfaDueDate(new Date(2026, 11, 28)))).toBe('2027-01-04');
  });
});
