// Lease Approval email: the pro-rata rent rider, the concession month, the security deposit, and typed dates.
import { describe, expect, it } from 'vitest';
import { apvAddMonths, defaultConcessionMonthIndex, leaseMonthCount, proRataSchedule, securityDeposit } from '../../apps/desk/js/rules/lease-approval.js';
import { parseTypedDate, parseWordDate } from '../../apps/desk/js/rules/date-input.js';

const rider = fields => proRataSchedule({ rent: 4150, frac: 0, concOtherAmount: 0, concKey: '', extra: 0, creditKey: '', ...fields });
const NOV_15 = { y: 2026, m: 10, d: 15 }, NOV_1 = { y: 2026, m: 10, d: 1 };

describe('pro-rata rider', () => {
  it('a mid-month start: pro-rata = rent ÷ days in the month × days left; the overpayment is credited to month 2', () => {
    const r = rider({ start: NOV_15 });
    expect(r).toMatchObject({ daysInMonth: 30, days: 16, proRata: 2213.33, credit: 1936.67 });
    expect(r.months).toEqual([{ y: 2026, m: 11, due: 2213.33, credits: [{ label: 'pro-rata credit', amt: 1936.67 }], carriedIn: 0, carried: 0 }]);
  });
  it('a start on the 1st with no concession or credit: no rider', () => {
    expect(rider({ start: NOV_1 })).toBeNull();
  });
  it('a concession of a fraction of a month lands on the chosen month: ½ month on month 2 → $2,075 due', () => {
    expect(rider({ start: NOV_1, frac: 0.5, concKey: '2026-12' }).months).toEqual([
      { y: 2026, m: 11, due: 2075, credits: [{ label: 'concession', amt: 2075 }], carriedIn: 0, carried: 0 },
    ]);
  });
  it('a concession bigger than the month\'s rent carries the rest into the next month', () => {
    expect(rider({ start: NOV_1, frac: 1.5, concKey: '2026-12' }).months).toEqual([
      { y: 2026, m: 11, due: 0, credits: [{ label: 'concession', amt: 6225 }], carriedIn: 0, carried: 2075 },
      { y: 2027, m: 0, due: 2075, credits: [], carriedIn: 2075, carried: 0 },
    ]);
  });
  it('a concession can be a dollar amount, rounded to the cent', () => {
    expect(rider({ start: NOV_1, frac: 'other', concOtherAmount: 1000.555, concKey: '2026-12' }).concAmt).toBe(1000.56);
  });
  it('an extra credit goes to month 2 unless another month is chosen', () => {
    expect(rider({ start: NOV_1, extra: 500 }).months[0]).toMatchObject({ y: 2026, m: 11, due: 3650 });
    expect(rider({ start: NOV_1, extra: 500, creditKey: '2027-02' }).months[0]).toMatchObject({ y: 2027, m: 1, due: 3650 });
  });
});

describe('concession month and deposit', () => {
  it('the lease runs start month through end month: Nov 2026 – Oct 2027 is 12 months; unknown end assumes 24', () => {
    expect(leaseMonthCount({ y: 2026, m: 10 }, { y: 2027, m: 9 })).toBe(12);
    expect(leaseMonthCount({ y: 2026, m: 10 }, null)).toBe(24);
  });
  it('the concession goes on month 2, or on the last month at a last-month building', () => {
    expect(defaultConcessionMonthIndex(false, 12)).toBe(1);
    expect(defaultConcessionMonthIndex(true, 12)).toBe(11);
  });
  it('the security deposit is the initial rent payment, or $2,000 when the reduced deposit was approved', () => {
    expect(securityDeposit('4,150.00', false)).toBe('4,150.00');
    expect(securityDeposit('4,150.00', true)).toBe('2000');
  });
  it('adding months rolls over the year in both directions', () => {
    expect(apvAddMonths(2026, 10, 3)).toEqual({ y: 2027, m: 1 });
    expect(apvAddMonths(2026, 0, -1)).toEqual({ y: 2025, m: 11 });
  });
});

describe('typed dates', () => {
  it('digits with or without separators become "Month D, YYYY"', () => {
    for (const typed of ['01232026', '1/23/2026', '01-23-26', '012326', '1.23.26']) expect(parseTypedDate(typed)).toBe('January 23, 2026');
  });
  it('anything it can\'t read confidently is left as typed (null)', () => {
    for (const typed of ['', 'next Friday', '13/01/2026', '1/32/2026', '1/23']) expect(parseTypedDate(typed)).toBeNull();
  });
  it('"January 23, 2026" reads back as year, month (0-based) and day; abbreviations don\'t', () => {
    expect(parseWordDate('January 23, 2026')).toEqual({ y: 2026, m: 0, d: 23 });
    expect(parseWordDate('january 23,2026')).toEqual({ y: 2026, m: 0, d: 23 });
    expect(parseWordDate('Jan 23, 2026')).toBeNull();
  });
});
