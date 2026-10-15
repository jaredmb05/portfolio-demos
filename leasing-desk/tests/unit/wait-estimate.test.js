// Return-time and wait estimates: tour length from units, buildings and walking time, then who frees up next.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateMinutes, estimateWait } from '../../apps/shared/wait-estimate.js';

const NOW = new Date('2026-10-06T14:10:00');
const at = (hhmm, day = '2026-10-06') => new Date(`${day}T${hhmm}:00`).toISOString();
const stops = (...buildings) => buildings.map(b => ({ building: `${b} Tidemark Blvd` }));
const minutesFromNow = t => Math.round((t - NOW.getTime()) / 60000);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('how long a tour takes', () => {
  it('one unit in the office building: 14 minutes, no walking', () => {
    expect(estimateMinutes({ stops: stops('2050') })).toBe(14);
  });
  it('a lighter building takes 9 minutes a unit, plus the walk there and back: 3 + 9 + 3', () => {
    expect(estimateMinutes({ stops: stops('2040') })).toBe(15);
  });
  it('three buildings: units plus each walk between them and back to the office: 14 + (6 + 14) + (5 + 9) + 3', () => {
    expect(estimateMinutes({ stops: stops('2050', '2230', '2120') })).toBe(51);
  });
  it('two units in the same building: no walk between them: 6 + 14 + 14 + 6', () => {
    expect(estimateMinutes({ stops: stops('2230', '2230') })).toBe(40);
  });
  it('a building pair with no walking time on file counts 4 minutes each way', () => {
    expect(estimateMinutes({ stops: [{ building: '2300 Larkspur Ave' }] })).toBe(17);
  });
  it('a tour with no units picked yet assumes 3 units: 3 × 14 + 8 + 3', () => {
    expect(estimateMinutes({ stops: [] })).toBe(53);
  });
  it('an inspection takes 25 minutes', () => {
    expect(estimateMinutes({ kind: 'inspection', stops: stops('2230') })).toBe(25);
  });
});

describe('the wait for the next walk-in', () => {
  const onTour = (assistant, startedAt) => ({ id: 'tour-' + assistant, assistant, startedAtIso: at(startedAt), stops: stops('2050', '2230', '2120') });
  const waiting = (id, queuedAt, extra = {}) => ({ id, queuedAtIso: at(queuedAt), ...extra });

  it('someone free: can start now, with the first person in', () => {
    expect(estimateWait([], ['Nadia', 'Tariq'], [], null, {})).toMatchObject({ waitMin: 0, waitLo: 0, waitHi: 5, nextFree: { name: 'Nadia' } });
  });
  it('everyone out: no estimate', () => {
    expect(estimateWait([], ['Nadia'], ['Nadia'], null, {})).toEqual({ none: true });
  });
  it('the only assistant is on a tour: the wait is the rest of that tour, ±20% (at least ±5)', () => {
    expect(estimateWait([onTour('Rosa', '13:50')], ['Rosa'], [], null, {})).toMatchObject({ waitMin: 31, waitLo: 25, waitHi: 37 });
  });
  it('walk-ins are taken in arrival order', () => {
    const rows = [waiting('second', '14:05'), waiting('first', '14:00')];
    const w = estimateWait(rows, ['Nadia'], [], 'second', {});
    expect(minutesFromNow(w.targetStart)).toBe(53);
    expect(w.targetLane).toBe('Nadia');
  });
  it('a booked appointment that has arrived goes before a waiting walk-in', () => {
    const rows = [onTour('Nadia', '13:50'), waiting('walkin', '14:05')];
    const w = estimateWait(rows, ['Nadia'], [], 'walkin', { '14.5': { tours: 1 } });
    expect(minutesFromNow(w.targetStart)).toBe(31 + 53);
  });
  it('a walk-in asking for someone waits for that person, even if someone else is free', () => {
    const rows = [onTour('Tariq', '13:50'), waiting('walkin', '14:05', { assistant: 'Tariq' })];
    const w = estimateWait(rows, ['Nadia', 'Tariq'], [], 'walkin', {});
    expect(w.targetLane).toBe('Tariq');
    expect(minutesFromNow(w.targetStart)).toBe(31);
  });
  it('appointments already over are ignored', () => {
    expect(estimateWait([], ['Nadia'], [], null, { 9: { tours: 2 } }).waitMin).toBe(0);
  });
});
