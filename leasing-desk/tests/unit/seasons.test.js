// Seasons (apps/shared/seasons.js). Halloween on both apps (production Desk v1.34 / iPad v1.27, D47): Oct 24 to Oct 31, 2026,
// local time; a 🍬 or 🍭 at the end of a done message; switched off at midnight on Oct 31 even on a page left open.
// The Desk's other seasons (production Desk v1.36, D50), every year: a turkey from Nov 1 until the Monday after Thanksgiving,
// then snow until Mar 31, nothing from Apr 1 to Oct 23. The iPad keeps Halloween only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { halloweenOn, halloweenTreat, SEASON_RECHECK_MS, seasonNow, thanksgivingDay, treat, watchSeasons } from '../../apps/shared/seasons.js';

const local = s => new Date(s);   // no zone: New York time (vitest.config.js)
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('when it is Halloween', () => {
  it('from midnight on Oct 24 to the last second of Oct 31, 2026', () => {
    expect(['2026-10-24T00:00:00', '2026-10-30T14:10:00', '2026-10-31T23:59:59'].map(d => seasonNow(local(d)))).toEqual(['halloween', 'halloween', 'halloween']);
  });
  it('not the day before, and off at midnight on Oct 31 → Nov 1', () => {
    expect(['2026-10-23T23:59:59', '2026-11-01T00:00:00', '2026-11-01T14:10:00', '2026-10-06T14:10:00'].map(d => halloweenOn(local(d)))).toEqual([false, false, false, false]);
  });
  it('2026 only, as production has it (D47): not in 2025 or 2027, when late October has no season at all', () => {
    expect([halloweenOn(local('2025-10-30T12:00:00')), halloweenOn(local('2027-10-30T12:00:00'))]).toEqual([false, false]);
    expect([seasonNow(local('2025-10-30T12:00:00')), seasonNow(local('2027-10-30T12:00:00'))]).toEqual(['', '']);
  });
});

describe("Thanksgiving's day: the fourth Thursday of November, worked out each year", () => {
  it('Nov 26, 2026; Nov 25, 2027; Nov 23, 2028; Nov 22, 2029; Nov 28, 2030; Nov 27, 2025', () => {
    expect([2026, 2027, 2028, 2029, 2030, 2025].map(y => ymd(thanksgivingDay(y)))).toEqual(['2026-11-26', '2027-11-25', '2028-11-23', '2029-11-22', '2030-11-28', '2025-11-27']);
  });
  it('always a Thursday between Nov 22 and Nov 28', () => {
    for (let y = 2020; y <= 2060; y++) {
      const d = thanksgivingDay(y);
      expect([d.getDay(), d.getMonth(), d.getDate() >= 22 && d.getDate() <= 28]).toEqual([4, 10, true]);
    }
  });
});

describe('the turkey: Nov 1 until the Monday after Thanksgiving', () => {
  it('from midnight on Nov 1, 2026 through Thanksgiving Day and the weekend after it', () => {
    expect(['2026-11-01T00:00:00', '2026-11-15T09:00:00', '2026-11-26T14:10:00', '2026-11-29T23:59:59'].map(d => seasonNow(local(d))))
      .toEqual(['thanksgiving', 'thanksgiving', 'thanksgiving', 'thanksgiving']);
  });
  it('the Monday after Thanksgiving is snow from its first second (Nov 30, 2026)', () => {
    expect(seasonNow(local('2026-11-30T00:00:00'))).toBe('snow');
  });
  it('every year, with that year\'s Thanksgiving: in 2027 the turkey leaves at midnight on Nov 29; in 2030 on Dec 2', () => {
    expect([seasonNow(local('2027-11-28T23:59:59')), seasonNow(local('2027-11-29T00:00:00'))]).toEqual(['thanksgiving', 'snow']);
    expect([seasonNow(local('2030-12-01T23:59:59')), seasonNow(local('2030-12-02T00:00:00'))]).toEqual(['thanksgiving', 'snow']);
  });
  it('in years without Halloween it starts on Nov 1 just the same', () => {
    expect([seasonNow(local('2027-10-31T23:59:59')), seasonNow(local('2027-11-01T00:00:00'))]).toEqual(['', 'thanksgiving']);
  });
});

describe('snow: from that Monday to the last second of Mar 31', () => {
  it('through December, across New Year, and to 11:59:59 PM on Mar 31', () => {
    expect(['2026-12-15T14:10:00', '2026-12-31T23:59:59', '2027-01-01T00:00:00', '2027-02-14T12:00:00', '2027-03-31T23:59:59'].map(d => seasonNow(local(d))))
      .toEqual(['snow', 'snow', 'snow', 'snow', 'snow']);
  });
  it('the start of any year is snow (Jan 1, 2026 too, before the Desk had seasons)', () => {
    expect(seasonNow(local('2026-01-01T00:00:00'))).toBe('snow');
  });
});

describe('nothing from Apr 1 to Oct 23', () => {
  it('Apr 1 at midnight, the summer, and Oct 23 at 11:59:59 PM', () => {
    expect(['2027-04-01T00:00:00', '2027-07-04T12:00:00', '2026-10-06T14:10:00', '2026-10-23T23:59:59', '2027-10-23T23:59:59'].map(d => seasonNow(local(d))))
      .toEqual(['', '', '', '', '']);
  });
});

describe('the Desk treat at the end of a done message', () => {
  const msg = 'Finished Priya S. — now in Follow-Ups to Send';
  it('on Oct 30: a 🍬 or a 🍭 after a space', () => {
    expect(treat(msg, local('2026-10-30T14:10:00'), () => 0)).toBe(msg + ' 🍬');
    expect(treat(msg, local('2026-10-30T14:10:00'), () => 0.99)).toBe(msg + ' 🍭');
  });
  it('only ever one of those two at Halloween', () => {
    const ends = new Set(Array.from({ length: 200 }, () => treat(msg, local('2026-10-30T14:10:00')).slice(msg.length)));
    expect([...ends].sort()).toEqual([' 🍬', ' 🍭']);
  });
  it('a 🦃 from Nov 1 to the Monday after Thanksgiving, then a ❄️ until Mar 31', () => {
    expect([treat(msg, local('2026-11-01T00:00:00')), treat(msg, local('2026-11-29T23:59:59'))]).toEqual([msg + ' 🦃', msg + ' 🦃']);
    expect([treat(msg, local('2026-11-30T00:00:00')), treat(msg, local('2027-03-31T23:59:59'))]).toEqual([msg + ' ❄️', msg + ' ❄️']);
  });
  it('out of season (Apr 1 to Oct 23) the message is left exactly as it is', () => {
    expect(treat(msg, local('2027-04-01T00:00:00'))).toBe(msg);
    expect(treat(msg, local('2026-10-06T14:10:00'))).toBe(msg);
  });
});

describe('the iPad treat: Halloween only (production gave the iPad no turkey or snow)', () => {
  const msg = '✓ Finished Priya S. at 2:10 PM.';
  it('a 🍬 or 🍭 on Oct 30, 2026', () => {
    expect(halloweenTreat(msg, local('2026-10-30T14:10:00'), () => 0)).toBe(msg + ' 🍬');
    expect(halloweenTreat(msg, local('2026-10-30T14:10:00'), () => 0.99)).toBe(msg + ' 🍭');
  });
  it('nothing at Thanksgiving, in the snow, or out of season', () => {
    expect(['2026-11-01T00:00:00', '2026-11-26T14:10:00', '2026-12-15T14:10:00', '2026-10-06T14:10:00'].map(d => halloweenTreat(msg, local(d)))).toEqual([msg, msg, msg, msg]);
  });
});

describe('a page left open', () => {
  afterEach(() => { vi.useRealTimers(); delete globalThis.document; });
  it('re-checks every 10 minutes, so the pumpkin goes at midnight on Oct 31 without a reload', () => {
    vi.useFakeTimers(); vi.setSystemTime(local('2026-10-31T23:55:00'));
    const classes = new Set();
    globalThis.document = { body: { classList: { toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); } } } };
    const ran = [];
    watchSeasons(() => ran.push(new Date().toISOString()));
    expect(SEASON_RECHECK_MS).toBe(10 * 60 * 1000);
    expect(classes.has('halloween')).toBe(true);
    vi.advanceTimersByTime(SEASON_RECHECK_MS - 1);
    expect(classes.has('halloween')).toBe(true);
    vi.advanceTimersByTime(1);   // 12:05 AM, Nov 1
    expect([classes.has('halloween'), ran.length]).toEqual([false, 1]);
  });
  it('the Desk passes its own apply (turkey, snow): run at once and at every re-check, before the extra', () => {
    vi.useFakeTimers(); vi.setSystemTime(local('2026-11-29T23:55:00'));
    const seen = [];
    watchSeasons(() => seen.push('extra'), () => seen.push(seasonNow()));
    expect(seen).toEqual(['thanksgiving']);
    vi.advanceTimersByTime(SEASON_RECHECK_MS);   // 12:05 AM, the Monday after Thanksgiving
    expect(seen).toEqual(['thanksgiving', 'snow', 'extra']);
  });
});
