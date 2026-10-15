// Rotation: who takes the next walk-in, who is busy, and who is out today.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { busyLabel, busyNow, rotationStats, suggestNext } from '../../apps/shared/rotation.js';
import { outOn, toggledAvailability } from '../../apps/shared/availability.js';
import { todayTotals } from '../../apps/desk/js/rules/queue.js';

const NOW = new Date('2026-10-06T14:10:00');   // a Tuesday, New York time
const at = (hhmm, day = '2026-10-06') => new Date(`${day}T${hhmm}:00`).toISOString();
const tour = (assistant, startedAt, extra = {}) => ({ id: assistant + startedAt, assistant, startedAtIso: startedAt, ...extra });
const ROSTER = ['Nadia', 'Tariq', 'Rosa'];
const orderOf = (rows, out = []) => rotationStats(rows, ROSTER, out).order.map(p => p.name);
const label = b => busyLabel(b).replace(/\s/g, ' ');   // ICU puts a narrow no-break space before PM

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('who goes next', () => {
  it('fewest tours started today goes first', () => {
    const rows = [tour('Nadia', at('09:00')), tour('Nadia', at('11:00')), tour('Tariq', at('10:00'))];
    expect(orderOf(rows)).toEqual(['Rosa', 'Tariq', 'Nadia']);
  });
  it('inspections count toward the day\'s total', () => {
    const rows = [tour('Tariq', at('09:00'), { kind: 'inspection' }), tour('Nadia', at('10:00'))];
    expect(orderOf(rows)[0]).toBe('Rosa');
  });
  it('a tie goes to whoever started longest ago', () => {
    const rows = [tour('Nadia', at('10:00')), tour('Tariq', at('09:00')), tour('Rosa', at('11:30'))];
    expect(orderOf(rows)).toEqual(['Tariq', 'Nadia', 'Rosa']);
  });
  it('a tie between people with no tours today keeps roster order', () => {
    expect(orderOf([])).toEqual(['Nadia', 'Tariq', 'Rosa']);
  });
  it('tours from earlier days don\'t count today', () => {
    const rows = [tour('Nadia', at('10:00', '2026-10-05')), tour('Nadia', at('11:00', '2026-10-05')), tour('Tariq', at('09:00'))];
    expect(orderOf(rows)).toEqual(['Nadia', 'Rosa', 'Tariq']);
  });
  it('anyone out today goes to the end of the order', () => {
    expect(orderOf([], ['Nadia'])).toEqual(['Tariq', 'Rosa', 'Nadia']);
  });
  it('the suggestion skips anyone out or on a tour right now', () => {
    const rot = rotationStats([], ROSTER, ['Nadia']);
    expect(suggestNext(rot, { Tariq: { back: 0 } })).toBe('Rosa');
    expect(suggestNext(rot, { Tariq: { back: 0 }, Rosa: { back: 0 } })).toBe('');
  });
});

describe('who is busy right now', () => {
  // 2050 → 2230 → 2120 and back: 14 + (6 + 14) + (5 + 9) + 3 = 51 minutes
  const THREE_STOPS = [{ building: '2050 Tidemark Blvd' }, { building: '2230 Tidemark Blvd' }, { building: '2120 Tidemark Blvd' }];

  it('a tour started today and not finished makes its assistant busy until about its estimated end', () => {
    const busy = busyNow([tour('Rosa', at('13:50'), { stops: THREE_STOPS, prospect: 'Daniel R.' })]);
    expect(Object.keys(busy)).toEqual(['Rosa']);
    expect(label(busy.Rosa)).toBe('back ~2:41 PM');
    expect(busy.Rosa).toMatchObject({ prospect: 'Daniel R.', kind: 'tour' });
  });
  it('a tour running past its estimate still counts at least 5 more minutes', () => {
    expect(label(busyNow([tour('Rosa', at('12:00'), { stops: THREE_STOPS })]).Rosa)).toBe('back ~2:15 PM');
  });
  it('an inspection is busy for 25 minutes', () => {
    const busy = busyNow([tour('Jun', at('14:00'), { kind: 'inspection' })]);
    expect(busy.Jun.kind).toBe('inspection');
    expect(label(busy.Jun)).toBe('back ~2:25 PM');
  });
  it('a finished tour doesn\'t make anyone busy', () => {
    expect(busyNow([tour('Rosa', at('13:50'), { finishedAtIso: at('14:05') })])).toEqual({});
  });
  it('the tour being edited is left out', () => {
    expect(busyNow([tour('Rosa', at('13:50'), { id: 't1' })], 't1')).toEqual({});
  });
});

describe('Out today / Back in', () => {
  const TUESDAY = 2;
  const base = { names: ROSTER, schedule: {}, marked: [], back: [], weekday: TUESDAY };

  it('anyone marked out today is out', () => {
    expect(outOn({ ...base, marked: ['Rosa'] })).toEqual(['Rosa']);
  });
  it('anyone not on today\'s weekly schedule is out, and no schedule means always in', () => {
    expect(outOn({ ...base, schedule: { Tariq: [1, 3, 5], Rosa: [2, 4] } })).toEqual(['Tariq']);
  });
  it('"Back in" overrides the weekly schedule for the day', () => {
    expect(outOn({ ...base, schedule: { Tariq: [1, 3, 5] }, back: ['Tariq'] })).toEqual([]);
  });
  it('someone who is only on the schedule still counts', () => {
    expect(outOn({ ...base, schedule: { Jun: [1] } })).toEqual(['Jun']);
  });

  const day = '2026-10-06';
  it('Mark out adds the name to today\'s out list', () => {
    expect(toggledAvailability({ outByDate: {}, inByDate: {}, name: 'Rosa', day, isOut: false, scheduled: true }).byDate[day]).toEqual(['Rosa']);
  });
  it('Back in clears a manual out', () => {
    const r = toggledAvailability({ outByDate: { [day]: ['Rosa'] }, inByDate: {}, name: 'Rosa', day, isOut: true, scheduled: true });
    expect(r.byDate[day]).toEqual([]);
    expect(r.inByDate[day]).toEqual([]);
  });
  it('Back in on a day someone isn\'t scheduled marks them in for that day', () => {
    expect(toggledAvailability({ outByDate: {}, inByDate: {}, name: 'Tariq', day, isOut: true, scheduled: false }).inByDate[day]).toEqual(['Tariq']);
  });
  it('only the 14 most recent days are kept', () => {
    const outByDate = {};
    for (let d = 1; d <= 14; d++) outByDate[`2026-09-${String(d).padStart(2, '0')}`] = ['Nadia'];
    const kept = Object.keys(toggledAvailability({ outByDate, inByDate: {}, name: 'Rosa', day, isOut: false, scheduled: true }).byDate);
    expect(kept).toHaveLength(14);
    expect(kept).not.toContain('2026-09-01');
    expect(kept).toContain(day);
  });
});

describe("Today's totals (Rotation tab, managers only)", () => {
  const rows = [
    tour('Nadia', at('10:00'), { finishedAtIso: at('10:40') }),
    tour('Nadia', at('13:30'), { kind: 'inspection' }),
    tour('Tariq', at('13:50')),
    tour('Kai', at('09:00'), { finishedAtIso: at('09:45') }),      // not on the roster, but started a tour today
    tour('Rosa', at('16:00', '2026-10-05'), { finishedAtIso: at('16:40', '2026-10-05') }),   // yesterday
    { id: 'q', queuedAtIso: at('14:00') },                             // waiting, not started
  ];
  const t = todayTotals(rows, ['Nadia', 'Tariq', 'Rosa', 'Jun'], ['Jun'], NOW);

  it('counts tours and inspections started today per assistant, and how many are on one now or finished', () => {
    expect(t.list.find(p => p.name === 'Nadia')).toEqual({ name: 'Nadia', tours: 1, insp: 1, now: 1, done: 1 });
    expect(t.list.find(p => p.name === 'Tariq')).toEqual({ name: 'Tariq', tours: 1, insp: 0, now: 1, done: 0 });
  });
  it('lists everyone in today (even with nothing yet) and anyone who started something, busiest first, then by name', () => {
    expect(t.list.map(p => p.name)).toEqual(['Nadia', 'Kai', 'Tariq', 'Rosa']);
  });
  it('leaves out someone who is out today and started nothing', () => {
    expect(t.list.map(p => p.name)).not.toContain('Jun');
  });
  it('adds up a team row', () => {
    expect(t.team).toEqual({ tours: 3, insp: 1, now: 2, done: 2 });
  });
});
