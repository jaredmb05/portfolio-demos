// Tours left open overnight: flagged on the Desk, and never counted as someone being busy or blocking a wait.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { splitCurrentQueue, startedOnEarlierDay } from '../../apps/desk/js/rules/queue.js';
import { isTodayIso } from '../../apps/shared/dates.js';
import { busyNow } from '../../apps/shared/rotation.js';
import { estimateWait } from '../../apps/shared/wait-estimate.js';

const NOW = new Date('2026-10-06T14:10:00');
const at = (hhmm, day = '2026-10-06') => new Date(`${day}T${hhmm}:00`).toISOString();
const leftOpen = { id: 'left-open', assistant: 'Rosa', startedAtIso: at('17:30', '2026-10-05'), stops: [{ building: '2230 Tidemark Blvd' }] };
const onTour = { id: 'on-tour', assistant: 'Tariq', startedAtIso: at('13:50') };
const waiting = { id: 'waiting', queuedAtIso: at('14:00') };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('a tour left open from an earlier day', () => {
  it('is flagged as started on an earlier day', () => {
    expect(startedOnEarlierDay(leftOpen)).toBe(true);
    expect(startedOnEarlierDay(onTour)).toBe(false);
    expect(startedOnEarlierDay(waiting)).toBe(false);
  });
  it('gets its own section in the Current Queue, apart from waiting and on-tour', () => {
    const s = splitCurrentQueue([waiting, onTour, leftOpen]);
    expect(s.waiting.map(r => r.id)).toEqual(['waiting']);
    expect(s.onTour.map(r => r.id)).toEqual(['on-tour']);
    expect(s.earlier.map(r => r.id)).toEqual(['left-open']);
  });
  it('doesn\'t make its assistant busy', () => {
    expect(Object.keys(busyNow([leftOpen, onTour]))).toEqual(['Tariq']);
  });
  it('doesn\'t block anyone in the wait estimate', () => {
    expect(estimateWait([leftOpen], ['Rosa'], [], null, {}).waitMin).toBe(0);
  });
  it('a tour started just after midnight today is today\'s, not a stale one', () => {
    expect(startedOnEarlierDay({ startedAtIso: at('00:05') })).toBe(false);
    expect(isTodayIso(at('00:05'))).toBe(true);
    expect(isTodayIso(at('23:59', '2026-10-05'))).toBe(false);
  });
});
