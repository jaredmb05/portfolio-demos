// "Did this tour start earlier?" (production D26): when Finish comes within a minute of Start on a tour, the iPad asks
// when it really started, so a Start tapped only after the tour doesn't leave a tour length of under a minute.
import { describe, expect, it } from 'vitest';
import { correctedStart, otherStartIso, pickerStart, setUpStartIso, startedJustNow } from '../../apps/shared/start-time.js';

const at = (hhmm, day = '2026-10-06') => new Date(`${day}T${hhmm}`).getTime();
const iso = (hhmm, day) => new Date(at(hhmm, day)).toISOString();
const tour = (extra = {}) => ({ kind: 'tour', createdAtIso: iso('14:10'), startedAtIso: iso('14:40'), ...extra });

describe('when Finish asks "Did this tour start earlier?" instead of the usual confirm', () => {
  it('Finish 30 seconds after Start on a tour: ask', () => {
    expect(startedJustNow(tour(), at('14:40:30'))).toBe(true);
  });
  it('Finish in the same second as Start: ask', () => {
    expect(startedJustNow(tour(), at('14:40'))).toBe(true);
  });
  it('Finish exactly a minute after Start: the usual confirm', () => {
    expect(startedJustNow(tour(), at('14:41'))).toBe(false);
  });
  it('a tour that ran 35 minutes: the usual confirm', () => {
    expect(startedJustNow(tour({ startedAtIso: iso('14:10') }), at('14:45'))).toBe(false);
  });
  it('an inspection finished right after Start: the usual confirm (inspections are never asked)', () => {
    expect(startedJustNow(tour({ kind: 'inspection' }), at('14:40:10'))).toBe(false);
  });
  it('a tour with no Start: not asked', () => {
    expect(startedJustNow(tour({ startedAtIso: null }), at('14:40'))).toBe(false);
  });
});

describe('"Started when it was set up"', () => {
  it('set up at 2:10 PM, Finish at 2:40 PM: offered, with the time it was set up', () => {
    expect(setUpStartIso(tour(), at('14:40'))).toBe(iso('14:10'));
  });
  it('set up exactly 5 minutes before: offered', () => {
    expect(setUpStartIso(tour({ createdAtIso: iso('14:35') }), at('14:40'))).toBe(iso('14:35'));
  });
  it('set up under 5 minutes before (Start tapped right away): not offered', () => {
    expect(setUpStartIso(tour({ createdAtIso: iso('14:36') }), at('14:40'))).toBe(null);
  });
  it('set up on an earlier day: not offered', () => {
    expect(setUpStartIso(tour({ createdAtIso: iso('17:30', '2026-10-05') }), at('14:40'))).toBe(null);
  });
  it('no set-up time: not offered', () => {
    expect(setUpStartIso(tour({ createdAtIso: null }), at('14:40'))).toBe(null);
  });
});

describe('the "Other time" picker', () => {
  it('starts at the set-up time when that is offered', () => {
    expect(pickerStart(tour(), at('14:40'))).toBe('14:10');
  });
  it('starts half an hour ago when it is not', () => {
    expect(pickerStart(tour({ createdAtIso: iso('14:38') }), at('14:40'))).toBe('14:10');
    expect(pickerStart(tour({ createdAtIso: null }), at('09:05'))).toBe('08:35');
  });
});

describe('the time picked under "Other time"', () => {
  it('a time earlier today becomes the start', () => {
    expect(otherStartIso('13:55', at('14:40'))).toBe(iso('13:55'));
  });
  it('a time later than now is refused', () => {
    expect(otherStartIso('15:30', at('14:40'))).toBe(null);
  });
  it('a time less than a minute before now is refused; a minute before is allowed', () => {
    expect(otherStartIso('14:40', at('14:40:30'))).toBe(null);
    expect(otherStartIso('14:39', at('14:40'))).toBe(iso('14:39'));
  });
  it('an empty or broken time is refused', () => {
    for (const v of ['', null, undefined, '2pm', '14', '25:00', '13:75']) expect(otherStartIso(v, at('14:40'))).toBe(null);
  });
  it('the time is on today\'s date, also across the clock change', () => {
    expect(otherStartIso('00:30', at('03:00', '2026-11-01'))).toBe(iso('00:30', '2026-11-01'));
  });
});

describe('saving a chosen start', () => {
  it('the chosen time becomes the start; the original Start tap is kept as startCorrectedFromIso', () => {
    expect(correctedStart(tour(), iso('14:10'))).toEqual({ startedAtIso: iso('14:10'), startCorrectedFromIso: iso('14:40') });
  });
});
