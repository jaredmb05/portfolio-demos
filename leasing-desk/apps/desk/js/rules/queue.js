// Which tours sit in which Tour Queue tab, when a check-in is due, and how the check-in email refers to the tour.

const isInspection = r => r.kind === 'inspection';

// Current Queue: not finished, and waiting (sent to the queue) or started, in arrival order.
// Follow-Ups to Send: finished tours (not inspections) with no follow-up sent, oldest first.
// Leasing Manager Check-In: follow-up sent, check-in not yet, oldest follow-up first.
export function queueBuckets(rows) {
  const queue = rows.filter(r => !r.finishedAtIso && (r.queuedAtIso || r.startedAtIso)).sort((a,b) => (a.queuedAtIso || a.startedAtIso) < (b.queuedAtIso || b.startedAtIso) ? -1 : 1);
  const followup = rows.filter(r => !isInspection(r) && r.finishedAtIso && !r.followUpSentAtIso).sort((a,b) => a.finishedAtIso < b.finishedAtIso ? -1 : 1);
  const checkin = rows.filter(r => !isInspection(r) && r.followUpSentAtIso && !r.checkInSentAtIso).sort((a,b) => a.followUpSentAtIso < b.followUpSentAtIso ? -1 : 1);
  return { queue, followup, checkin };
}

// A tour started on an earlier calendar day and never finished: flagged, and it doesn't make anyone "busy"
export const startedOnEarlierDay = (r, today = new Date().toDateString()) => !!r.startedAtIso && new Date(r.startedAtIso).toDateString() !== today;

// The Current Queue in three sections: waiting, on a tour now, and still open from an earlier day
export function splitCurrentQueue(queue, today = new Date().toDateString()) {
  return {
    waiting: queue.filter(r => !r.startedAtIso),
    onTour: queue.filter(r => r.startedAtIso && new Date(r.startedAtIso).toDateString() === today),
    earlier: queue.filter(r => startedOnEarlierDay(r, today)),
  };
}

// Calendar days since the follow-up went out (0 = today). The check-in is due the day after.
export const daysSinceFollowUp = (r, now = new Date()) => Math.floor((new Date(new Date(now).toDateString()) - new Date(new Date(r.followUpSentAtIso).toDateString())) / 864e5);
export const checkInDueText = days => days <= 0 ? 'due tomorrow' : days === 1 ? 'due today' : `${days - 1} day${days - 1 === 1 ? '' : 's'} overdue`;

// "Thank you for coming in ___": by calendar days since the tour, not hours
export function touredWhen(toured, now = new Date()) {
  const days = Math.round((new Date(new Date(now).toDateString()).getTime() - new Date(toured.toDateString()).getTime()) / 864e5);
  return days <= 1 ? 'yesterday' : days < 7 ? `on ${toured.toLocaleDateString('en-US', { weekday: 'long' })}` : days < 14 ? 'last week' : `on ${toured.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
}

// Today's tours and inspections per assistant, with a team row (Rotation tab, managers only). Lists everyone in today, plus
// anyone out or off the roster who still started something; busiest first, then by name.
export function todayTotals(rows, names, out, now = new Date()) {
  const start = new Date(new Date(now).toDateString()).getTime(), by = {};
  rows.filter(r => r.assistant && r.startedAtIso && new Date(r.startedAtIso).getTime() >= start).forEach(r => {
    const p = by[r.assistant] = by[r.assistant] || { tours: 0, insp: 0, now: 0, done: 0 };
    if (r.kind === 'inspection') p.insp++; else p.tours++;
    if (r.finishedAtIso) p.done++; else p.now++;
  });
  const zero = { tours: 0, insp: 0, now: 0, done: 0 };
  const shown = names.filter(n => by[n] || !out.includes(n)).concat(Object.keys(by).filter(n => !names.includes(n)));
  const list = shown.map(name => ({ name, ...(by[name] || zero) })).sort((a, b) => (b.tours + b.insp) - (a.tours + a.insp) || a.name.localeCompare(b.name));
  const team = list.reduce((t, p) => ({ tours: t.tours + p.tours, insp: t.insp + p.insp, now: t.now + p.now, done: t.done + p.done }), { ...zero });
  return { list, team };
}
