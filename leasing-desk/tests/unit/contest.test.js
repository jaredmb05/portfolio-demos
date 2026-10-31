// Leasing assistant contest (production Desk v1.29, D35): a showsheet NOTES cell that mentions a gift card flags the unit on
// the Desk's unit list, through the date in the note. The notes below are invented.
import { describe, expect, it } from 'vitest';
import { CONTEST_MAX, contestActive, contestDeadline, contestNote } from '../../apps/desk/js/rules/contest.js';

const day = (ymd, hm = '14:10') => new Date(`${ymd}T${hm}:00`);   // local time (New York, vitest.config.js)
const OCT_6 = day('2026-10-06');

describe('which notes count as a contest note', () => {
  it('a note with "gift card" in any capitals is kept as written', () => {
    expect(contestNote('$150 gift card for a lease by 11/15')).toBe('$150 gift card for a lease by 11/15');
    expect(contestNote('GIFT CARD $100 - ends Nov 15')).toBe('GIFT CARD $100 - ends Nov 15');
    expect(contestNote('Gift Card: $75')).toBe('Gift Card: $75');
  });
  it('"giftcard" written as one word, or with a line break between the words, still counts', () => {
    expect(contestNote('$150 giftcard 11/15')).toBe('$150 giftcard 11/15');
    expect(contestNote('$150 gift\ncard 11/15')).toBe('$150 gift card 11/15');
  });
  it('spaces and line breaks inside the note collapse to one space, and the ends are trimmed', () => {
    expect(contestNote('  $150   gift card\n\nfor a lease by 11/15  ')).toBe('$150 gift card for a lease by 11/15');
  });
  it('any other note, or none, is not a contest note', () => {
    expect(['Keys at the front desk', 'Occupied', 'Reno: new floors', 'gift', 'card', '', null, undefined].map(contestNote)).toEqual(['', '', '', '', '', '', '', '']);
  });
  it('a long note is cut at 120 characters', () => {
    const long = '$150 gift card for a lease by 11/15. ' + 'Show the terrace first and mention the new gym. '.repeat(4);
    expect(CONTEST_MAX).toBe(120);
    expect(contestNote(long)).toBe(long.slice(0, 120));
    expect(contestNote(long)).toHaveLength(120);
  });
});

describe('the deadline written in a contest note', () => {
  it('"10/31": month and day, this year', () => {
    expect(contestDeadline('$250 gift card, deadline 10/31', OCT_6)).toBe('2026-10-31');
  });
  it('"10/31/26": a two-digit year is 20xx', () => {
    expect(contestDeadline('Gift card $250 through 10/31/26', OCT_6)).toBe('2026-10-31');
  });
  it('"1/5/2027": a four-digit year as written', () => {
    expect(contestDeadline('Gift card $250 through 1/5/2027', OCT_6)).toBe('2027-01-05');
  });
  it('"Oct 31", "Nov. 15", "november 15" and "December 1, 2026": a month name, any capitals, short or long, with or without a year', () => {
    expect(contestDeadline('$250 gift card, ends Oct 31', OCT_6)).toBe('2026-10-31');
    expect(contestDeadline('$250 gift card, ends Nov. 15', OCT_6)).toBe('2026-11-15');
    expect(contestDeadline('$250 gift card, ends november 15', OCT_6)).toBe('2026-11-15');
    expect(contestDeadline('$250 gift card until December 1, 2026', OCT_6)).toBe('2026-12-01');
  });
  it('a one-digit month and day are padded: "1/5" is 01-05', () => {
    expect(contestDeadline('$100 gift card 1/5', day('2026-12-20'))).toBe('2027-01-05');
  });
  it('no year: this year while that date is less than two months gone (a deadline already past stays past)', () => {
    expect(contestDeadline('$100 gift card, 10/5', OCT_6)).toBe('2026-10-05');
    expect(contestDeadline('$100 gift card, Sep 1', OCT_6)).toBe('2026-09-01');
  });
  it('no year: next year when that date is more than two months gone (a January deadline written in December)', () => {
    expect(contestDeadline('$100 gift card through 1/15', day('2026-12-10'))).toBe('2027-01-15');
    expect(contestDeadline('$100 gift card through Jan 15', day('2026-12-10'))).toBe('2027-01-15');
  });
  it('exactly two months gone is still this year; one day more is next year', () => {
    const OCT_30 = day('2026-10-30');
    expect(contestDeadline('gift card 8/30', OCT_30)).toBe('2026-08-30');
    expect(contestDeadline('gift card 8/29', OCT_30)).toBe('2027-08-29');
  });
  it('a note with no date has no deadline', () => {
    expect(contestDeadline('$125 gift card', OCT_6)).toBe('');
    expect(contestDeadline('$100 gift card on a 13-month lease', OCT_6)).toBe('');
  });
  it('a month over 12 or a day over 31 is not a date', () => {
    expect(contestDeadline('gift card 13/5', OCT_6)).toBe('');
    expect(contestDeadline('gift card 10/32', OCT_6)).toBe('');
    expect(contestDeadline('gift card 0/12', OCT_6)).toBe('');
  });
  it('a note with two dates: the first number date is read', () => {
    expect(contestDeadline('$250 gift card 10/31 (was 10/15)', OCT_6)).toBe('2026-10-31');
  });
});

describe('when the flag shows', () => {
  const unit = { building: '2230 TIDEMARK BLVD', unit: '3107', contest: '$250 gift card, deadline 10/31', contestUntil: '2026-10-31' };
  it('before the deadline: shown', () => {
    expect(contestActive(unit, OCT_6)).toBe(true);
  });
  it('on the deadline day, up to midnight: shown', () => {
    expect(contestActive(unit, day('2026-10-31', '00:00'))).toBe(true);
    expect(contestActive(unit, day('2026-10-31', '23:59'))).toBe(true);
  });
  it('the day after the deadline: gone', () => {
    expect(contestActive(unit, day('2026-11-01', '00:00'))).toBe(false);
    expect(contestActive(unit, day('2027-01-15'))).toBe(false);
  });
  it('a note with no date stays until it is taken off the showsheet', () => {
    const noDate = { unit: '2608', contest: '$125 gift card' };
    expect(contestActive(noDate, OCT_6)).toBe(true);
    expect(contestActive(noDate, day('2028-06-01'))).toBe(true);
  });
  it('a unit with no contest note, or no unit: no flag', () => {
    expect(contestActive({ unit: '714' }, OCT_6)).toBe(false);
    expect(contestActive({ unit: '714', contest: '' }, OCT_6)).toBe(false);
    expect(contestActive(null, OCT_6)).toBe(false);
  });
  it('a note read in December with a January deadline stays shown through January', () => {
    const DEC_10 = day('2026-12-10');
    const jan = { contest: '$100 gift card through 1/15', contestUntil: contestDeadline('$100 gift card through 1/15', DEC_10) };
    expect(contestActive(jan, DEC_10)).toBe(true);
    expect(contestActive(jan, day('2027-01-15'))).toBe(true);
    expect(contestActive(jan, day('2027-01-16'))).toBe(false);
  });
});
