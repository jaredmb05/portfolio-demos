// Showsheet publishing (D7): every Desk and iPad follows the newest published copy.
import { describe, expect, it } from 'vitest';
import { floorPlanMetaLine, isUnpublished, latestIso, shouldAdoptPublish } from '../../apps/desk/js/rules/publish.js';

const UNITS = [{ building: '2050 Tidemark Blvd', unit: '1812' }];
const T = hhmm => `2026-10-06T${hhmm}:00.000Z`;

describe('taking a published showsheet', () => {
  it('a Desk takes a publish newer than anything it has', () => {
    expect(shouldAdoptPublish(T('13:05'), T('09:00'), UNITS)).toBe(true);
  });
  it('a Desk that has never loaded a showsheet takes any publish', () => {
    expect(shouldAdoptPublish(T('13:05'), '', UNITS)).toBe(true);
  });
  it('a publish the same age or older than what the Desk has is ignored', () => {
    expect(shouldAdoptPublish(T('13:05'), T('13:05'), UNITS)).toBe(false);
    expect(shouldAdoptPublish(T('09:00'), T('13:05'), UNITS)).toBe(false);
  });
  it('a publish with no units is ignored', () => {
    expect(shouldAdoptPublish(T('13:05'), T('09:00'), [])).toBe(false);
    expect(shouldAdoptPublish(T('13:05'), T('09:00'), undefined)).toBe(false);
  });
  it('nothing published yet: nothing to take', () => {
    expect(shouldAdoptPublish('', T('09:00'), UNITS)).toBe(false);
  });
  it('what the Desk "has" is the newer of the publish it last took and the file it last loaded', () => {
    expect(latestIso(T('09:00'), T('11:30'))).toBe(T('11:30'));
    expect(latestIso(T('11:30'), '')).toBe(T('11:30'));
  });
});

describe('the "not published yet" warning', () => {
  it('shows when this Desk loaded a file after the last publish', () => {
    expect(isUnpublished(T('09:00'), T('11:30'), '')).toBe(true);
  });
  it('shows when nothing has ever been published and this Desk loaded a file', () => {
    expect(isUnpublished(undefined, T('11:30'), '')).toBe(true);
  });
  it('doesn\'t show when the last publish is newer than the loaded file', () => {
    expect(isUnpublished(T('12:00'), T('11:30'), '')).toBe(false);
  });
  it('doesn\'t show when this Desk has since taken a newer publish', () => {
    expect(isUnpublished(T('09:00'), T('11:30'), T('12:00'))).toBe(false);
  });
  it('doesn\'t show when this Desk never loaded a file', () => {
    expect(isUnpublished(T('09:00'), '', '')).toBe(false);
  });
});

describe('the line under Floor Plan Links', () => {
  const when = iso => `at ${iso.slice(11, 16)}`;   // stands in for the Desk's "today at 9:12 AM"

  it('a file this Desk loaded: its name and when', () => {
    expect(floorPlanMetaLine({ filename: 'Floor_Plan_Links.xlsx', count: 2, loadedAt: T('09:12') }, when)).toBe('Floor_Plan_Links.xlsx · at 09:12');
  });
  it('links taken from a publish have no file name: only when, never "undefined" and no made-up name', () => {
    expect(floorPlanMetaLine({ count: 21, loadedAt: T('09:12') }, when)).toBe('at 09:12');
  });
  it('saved metadata with no time: the file name only', () => {
    expect(floorPlanMetaLine({ filename: 'Floor_Plan_Links.xlsx' }, when)).toBe('Floor_Plan_Links.xlsx');
  });
  it('nothing saved: an empty line', () => {
    expect(floorPlanMetaLine({}, when)).toBe('');
    expect(floorPlanMetaLine(null, when)).toBe('');
  });
});
