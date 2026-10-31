// "Did this tour start earlier?" (production D26). Start and Finish tapped together after the tour leave a tour length
// of under a minute, so when Finish comes within a minute of Start on a tour, the iPad asks when it really started.
// The chosen time becomes startedAtIso; the original Start tap is kept as startCorrectedFromIso.
import { isTodayIso } from './dates.js';

export const JUST_STARTED_MS = 60 * 1000;   // Finish this soon after Start → ask; a picked start must be at least this long ago
export const SET_UP_MIN_MS = 5 * 60 * 1000;   // "Started when it was set up" only when that was at least 5 minutes ago

// Finish tapped less than a minute after Start, on a tour (inspections run differently and always get the usual confirm)
export const startedJustNow = (r, now = Date.now()) =>
  r.kind !== 'inspection' && !!r.startedAtIso && now - new Date(r.startedAtIso).getTime() < JUST_STARTED_MS;

// The "Started when it was set up" choice: when the tour was created, if that was today and at least 5 minutes ago; else null
export function setUpStartIso(r, now = Date.now()) {
  const ok = r.createdAtIso && isTodayIso(r.createdAtIso, now) && now - new Date(r.createdAtIso).getTime() >= SET_UP_MIN_MS;
  return ok ? r.createdAtIso : null;
}

// Where the "Other time" picker starts ("HH:MM"): the set-up time when it's offered, otherwise half an hour ago
export function pickerStart(r, now = Date.now()) {
  const d = new Date(setUpStartIso(r, now) || now - 30 * 60 * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "Other time": the picked "HH:MM" today as an ISO time, or null when it isn't a time or isn't at least a minute before now
export function otherStartIso(hhmm, now = Date.now()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const d = new Date(now); d.setHours(+m[1], +m[2], 0, 0);
  return d.getTime() > now - JUST_STARTED_MS ? null : d.toISOString();
}

// The fields saved with Finish when a start was chosen
export const correctedStart = (r, startIso) => ({ startedAtIso: startIso, startCorrectedFromIso: r.startedAtIso });
