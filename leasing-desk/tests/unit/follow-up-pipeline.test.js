// The follow-up pipeline: Current Queue → Follow-Ups to Send → Leasing Manager Check-In, and Future Move-Ins.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInDueText, daysSinceFollowUp, queueBuckets, touredWhen } from '../../apps/desk/js/rules/queue.js';
import { flFollowUpYmd, leadIsDue, leadsToCapture } from '../../apps/desk/js/rules/future-move-ins.js';

const NOW = new Date('2026-10-06T14:10:00');   // Tuesday
const at = (hhmm, day = '2026-10-06') => new Date(`${day}T${hhmm}:00`).toISOString();
const ids = rows => rows.map(r => r.id);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('Tour Queue tabs', () => {
  const rows = [
    { id: 'waiting', queuedAtIso: at('14:00') },
    { id: 'on-tour', queuedAtIso: at('13:40'), startedAtIso: at('13:50') },
    { id: 'finished-late', startedAtIso: at('12:00'), finishedAtIso: at('13:00') },
    { id: 'finished-early', startedAtIso: at('10:00'), finishedAtIso: at('11:00') },
    { id: 'inspection', kind: 'inspection', startedAtIso: at('11:30'), finishedAtIso: at('12:00') },
    { id: 'fu-yesterday', finishedAtIso: at('16:00', '2026-10-05'), followUpSentAtIso: at('17:00', '2026-10-05') },
    { id: 'fu-earlier', finishedAtIso: at('15:00', '2026-10-02'), followUpSentAtIso: at('16:00', '2026-10-02') },
    { id: 'all-done', finishedAtIso: at('15:00', '2026-10-01'), followUpSentAtIso: at('16:00', '2026-10-01'), checkInSentAtIso: at('10:00', '2026-10-02') },
  ];
  const b = queueBuckets(rows);

  it('Current Queue: every tour not yet finished, waiting or started, in arrival order', () => {
    expect(ids(b.queue)).toEqual(['on-tour', 'waiting']);
  });
  it('a finished tour goes to Follow-Ups to Send, oldest first', () => {
    expect(ids(b.followup)).toEqual(['finished-early', 'finished-late']);
  });
  it('inspections never need a follow-up or a check-in', () => {
    expect([...ids(b.followup), ...ids(b.checkin)]).not.toContain('inspection');
  });
  it('once the follow-up is sent, the tour waits for the Leasing Manager check-in, oldest follow-up first', () => {
    expect(ids(b.checkin)).toEqual(['fu-earlier', 'fu-yesterday']);
  });
  it('after the check-in the tour leaves every tab', () => {
    expect([...b.queue, ...b.followup, ...b.checkin].map(r => r.id)).not.toContain('all-done');
  });
});

describe('when the check-in is due', () => {
  const due = followUpSent => checkInDueText(daysSinceFollowUp({ followUpSentAtIso: followUpSent }));

  it('follow-up sent today: check-in due tomorrow', () => {
    expect(due(at('09:00'))).toBe('due tomorrow');
  });
  it('follow-up sent yesterday evening: due today (calendar days, not hours)', () => {
    expect(due(at('18:00', '2026-10-05'))).toBe('due today');
  });
  it('follow-up sent two days ago: 1 day overdue', () => {
    expect(due(at('10:00', '2026-10-04'))).toBe('1 day overdue');
  });
  it('follow-up sent five days ago: 4 days overdue', () => {
    expect(due(at('10:00', '2026-10-01'))).toBe('4 days overdue');
  });
});

describe('how the check-in email refers to the tour', () => {
  const when = (hhmm, day) => touredWhen(new Date(`${day}T${hhmm}:00`));

  it('toured yesterday, even late in the evening: "yesterday"', () => {
    expect(when('23:30', '2026-10-05')).toBe('yesterday');
  });
  it('toured earlier this week: the weekday', () => {
    expect(when('23:59', '2026-10-04')).toBe('on Sunday');
    expect(when('10:00', '2026-10-02')).toBe('on Friday');
  });
  it('toured 7 to 13 days ago: "last week"', () => {
    expect(when('10:00', '2026-09-29')).toBe('last week');
    expect(when('10:00', '2026-09-23')).toBe('last week');
  });
  it('toured two weeks ago or more: the date', () => {
    expect(when('10:00', '2026-09-22')).toBe('on September 22');
  });
});

describe('Future Move-Ins', () => {
  const started = (id, moveIn, extra = {}) => ({
    id, prospect: 'Karen M.', assistant: 'Nadia', startedAtIso: at('10:00'),
    profile: { beds: ['1 Bed'], priceMax: 4500, moveIn }, stops: [{ unit: '1812' }, { unit: '714' }], ...extra,
  });
  const captured = rows => leadsToCapture(rows, new Set()).map(l => l.tourId);

  it('a toured prospect moving in more than 45 days out becomes a Future Move-In, follow-up 30 days before move-in', () => {
    const [lead] = leadsToCapture([started('t1', '2026-12-15')], new Set());
    expect(lead).toMatchObject({
      id: 'tour-t1', source: 'tour', tourId: 't1', name: 'Karen M.', assistant: 'Nadia', tourDate: '2026-10-06',
      moveIn: '2026-12-15', followUpDate: '2026-11-15', criteria: '1 Bed · up to $4,500', units: '#1812, #714', status: 'open',
    });
  });
  it('no contact info is kept on the lead (D14)', () => {
    const [lead] = leadsToCapture([started('t1', '2026-12-15', { prospectEmail: 'karen@example.com' })], new Set());
    expect(Object.keys(lead).filter(k => /mail|phone/i.test(k))).toEqual([]);
  });
  it('46 days out is captured; 44 days out is not', () => {
    expect(captured([started('t46', '2026-11-21'), started('t44', '2026-11-19')])).toEqual(['t46']);
  });
  it('exactly 45 days out is not captured, whatever time the tour started (B2)', () => {
    const at45 = ['09:00', '11:00', '13:00', '17:00'].map(t => started('t' + t, '2026-11-20', { startedAtIso: at(t) }));
    expect(captured(at45)).toEqual([]);
  });
  it('46 days out is captured, even for a tour started late in the evening', () => {
    expect(captured([started('late', '2026-11-21', { startedAtIso: at('23:30') })])).toEqual(['late']);
  });
  it('inspections, tours never started, and tours with no move-in date are skipped', () => {
    expect(captured([
      started('insp', '2027-01-15', { kind: 'inspection' }),
      started('queued', '2027-01-15', { startedAtIso: undefined, queuedAtIso: at('09:00') }),
      started('no-date', ''),
    ])).toEqual([]);
  });
  it('a tour already captured is not captured again', () => {
    expect(leadsToCapture([started('t1', '2026-12-15')], new Set(['tour-t1']))).toEqual([]);
  });
  it('follow-up date is move-in minus 30 days, across month ends and the clock change', () => {
    expect(flFollowUpYmd('2027-01-15')).toBe('2026-12-16');
    expect(flFollowUpYmd('2026-03-10')).toBe('2026-02-08');
    expect(flFollowUpYmd('2026-11-20')).toBe('2026-10-21');
  });
  it('a lead is due on its follow-up date and after, while it is open', () => {
    expect(leadIsDue({ status: 'open', followUpDate: '2026-10-06' }, '2026-10-06')).toBe(true);
    expect(leadIsDue({ status: 'open', followUpDate: '2026-10-07' }, '2026-10-06')).toBe(false);
    expect(leadIsDue({ status: 'contacted', followUpDate: '2026-10-01' }, '2026-10-06')).toBe(false);
  });
});
