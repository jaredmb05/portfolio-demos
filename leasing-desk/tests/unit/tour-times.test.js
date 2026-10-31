// Tour times (production D24, D25): worked out from the stored Start and Finish, never saved; one bad tap barely moves them.
import { describe, expect, it } from 'vitest';
import { fmtMinutes, tourLengthMin, tourTimeStatus, typicalMinutes, weekStartOf } from '../../apps/desk/js/rules/tour-times.js';

const at = (hhmm, day = '2026-10-06') => new Date(`${day}T${hhmm}:00`).toISOString();
const tour = (start, finish, extra = {}) => ({ startedAtIso: start, finishedAtIso: finish, ...extra });

describe('how long a tour took', () => {
  it('finish minus start, in whole minutes', () => {
    expect(tourLengthMin(tour(at('13:45'), at('14:27')))).toBe(42);
  });
  it('not finished, or never started: no length', () => {
    expect(tourLengthMin(tour(at('13:45'), undefined))).toBe(null);
    expect(tourLengthMin(tour(undefined, at('14:27')))).toBe(null);
  });
  it('finished on a later day (a Finish tapped the next morning): no length', () => {
    expect(tourLengthMin(tour(at('17:30', '2026-10-02'), at('09:05', '2026-10-03')))).toBe(null);
  });
  it('a finish before the start: no length', () => {
    expect(tourLengthMin(tour(at('14:00'), at('13:00')))).toBe(null);
  });
});

describe('which tours count toward tour times', () => {
  const st = (start, finish, extra) => tourTimeStatus(tour(start, finish, extra));

  it('a normal tour counts', () => {
    expect(st(at('10:00'), at('10:45'))).toEqual({ len: 45, ok: true, out: false, why: '' });
  });
  it('a tour still running is neither counted nor left out', () => {
    expect(st(at('10:00'), undefined)).toMatchObject({ ok: false, out: false, why: 'not finished' });
  });
  it('under 5 minutes (Start and Finish tapped together after the tour) is left out', () => {
    expect(st(at('10:00'), at('10:04'))).toMatchObject({ len: 4, ok: false, out: true, why: 'under 5 minutes' });
    expect(st(at('10:00'), at('10:05'))).toMatchObject({ ok: true });
  });
  it('over 2 hours is left out; exactly 2 hours counts', () => {
    expect(st(at('10:00'), at('12:30'))).toMatchObject({ len: 150, ok: false, out: true, why: 'over 2 hours' });
    expect(st(at('10:00'), at('12:00'))).toMatchObject({ len: 120, ok: true });
  });
  it('finished on a later day is left out', () => {
    expect(st(at('17:30', '2026-10-02'), at('09:05', '2026-10-03'))).toMatchObject({ len: null, ok: false, out: true, why: 'finished on a later day' });
  });
  it('left out by a manager, whatever its length', () => {
    expect(st(at('10:00'), at('10:45'), { timeExcluded: true })).toMatchObject({ len: 45, ok: false, out: true, why: 'left out by a manager' });
  });
});

describe('the typical length', () => {
  it('is the middle tour (the median), so one late Finish barely moves it', () => {
    expect(typicalMinutes([40, 45, 50])).toBe(45);
    expect(typicalMinutes([40, 45, 50, 118])).toBe(48);
  });
  it('a next-day Finish and a 2½-hour tour are left out, a 2-hour tour is kept: the typical stays at 45 min', () => {
    const rows = [
      tour(at('10:00'), at('10:40')), tour(at('11:00'), at('11:45')), tour(at('13:00'), at('13:50')),
      tour(at('14:00'), at('16:00')),                                   // 2 hours: kept
      tour(at('15:00'), at('17:30')),                                   // 2½ hours: left out
      tour(at('17:30'), at('09:00', '2026-10-07')),                     // finished the next morning: left out
      tour(at('16:00'), at('16:30')),
    ];
    const lens = rows.map(tourTimeStatus).filter(s => s.ok).map(s => s.len);
    expect(lens).toEqual([40, 45, 50, 120, 30]);
    expect(typicalMinutes(lens)).toBe(45);
  });
  it('no timed tours: no typical length', () => {
    expect(typicalMinutes([])).toBe(null);
  });
});

describe('minutes as staff read them', () => {
  it('under a minute, minutes, then hours and minutes', () => {
    expect(fmtMinutes(0)).toBe('under 1 min');
    expect(fmtMinutes(42)).toBe('42 min');
    expect(fmtMinutes(60)).toBe('1 h');
    expect(fmtMinutes(135)).toBe('2 h 15 min');
  });
});

describe('weeks run Monday to Sunday', () => {
  it('any day maps to the Monday that starts its week, at midnight', () => {
    expect(weekStartOf(new Date('2026-10-06T14:10:00')).toDateString()).toBe('Mon Oct 05 2026');
    expect(weekStartOf(new Date('2026-10-11T23:30:00')).toDateString()).toBe('Mon Oct 05 2026');
    expect(weekStartOf(new Date('2026-10-12T00:05:00')).toDateString()).toBe('Mon Oct 12 2026');
    expect(weekStartOf(new Date('2026-10-12T00:05:00')).getHours()).toBe(0);
  });
  it('across the clock change: the Sunday it happens still belongs to its own week', () => {
    expect(weekStartOf(new Date('2026-11-01T12:00:00')).toDateString()).toBe('Mon Oct 26 2026');
    expect(weekStartOf(new Date('2026-11-02T08:00:00')).toDateString()).toBe('Mon Nov 02 2026');
  });
});
