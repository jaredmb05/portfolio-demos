// Tour times (managers only; production D24, D25): worked out from the stored Start and Finish, never saved.
// "Typical" is the median, so one bad tap barely moves it. Left out of tour times: tours finished on a later day,
// under 5 minutes (Start and Finish tapped together after the tour), over 2 hours, or left out by a manager (timeExcluded).
export const TREND_WEEKS = 8, TREND_MIN_MIN = 5, TREND_MAX_MIN = 120;

// Minutes from Start to Finish, or null when it isn't finished, the times are broken, or it finished on a later day
export function tourLengthMin(r) {
  if (!r || !r.startedAtIso || !r.finishedAtIso) return null;
  const s = new Date(r.startedAtIso), f = new Date(r.finishedAtIso);
  if (isNaN(s) || isNaN(f) || f < s || s.toDateString() !== f.toDateString()) return null;
  return Math.round((f - s) / 60000);
}

export function fmtMinutes(m) { return m < 1 ? 'under 1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; }

// Monday 00:00 of the week a date falls in (weeks run Monday to Sunday)
export function weekStartOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }

// Does this tour's length count toward tour times? why = the reason when it doesn't
export function tourTimeStatus(r) {
  const len = tourLengthMin(r);
  if (!r.finishedAtIso) return { len: null, ok: false, out: false, why: 'not finished' };
  if (r.timeExcluded) return { len, ok: false, out: true, why: 'left out by a manager' };
  if (len === null) return { len, ok: false, out: true, why: 'finished on a later day' };
  if (len < TREND_MIN_MIN) return { len, ok: false, out: true, why: `under ${TREND_MIN_MIN} minutes` };
  if (len > TREND_MAX_MIN) return { len, ok: false, out: true, why: `over ${TREND_MAX_MIN / 60} hours` };
  return { len, ok: true, out: false, why: '' };
}

// The typical length of the tours that count: the median, rounded to a whole minute
export function typicalMinutes(lens) {
  const s = lens.slice().sort((a, b) => a - b), m = s.length >> 1;
  return !s.length ? null : Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}
