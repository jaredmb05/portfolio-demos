// Lease Approval money rules: the owning LLC, the security deposit, and the pro-rata rent rider; how long an assignment runs.
import { MONTHS } from '../../../shared/dates.js';
import { bldgNum } from '../units.js';
import { parseTypedDate, parseWordDate } from './date-input.js';

export function apvLLC(building) {
  const num = bldgNum(building);
  if (num === '2120') return '2120 Tidemark Owner LLC';
  return `${num} Tidemark LLC`;
}
// Security deposit = the initial rent payment, unless the reduced deposit was approved
export const securityDeposit = (initialRent, reduced) => reduced ? '2000' : initialRent;

export const apvMonthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
export const apvMonthLabel = (y, m) => `${MONTHS[m]} ${y}`;
export function apvAddMonths(y, m, n) { const t = m + n; return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; }
export const apvMoney = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const apvRound2 = (n) => Math.round(n * 100) / 100;
// Months in the lease (start through end, inclusive); 24 when the end date isn't known yet
export const leaseMonthCount = (start, end) => start && end ? Math.max(1, (end.y - start.y) * 12 + (end.m - start.m) + 1) : 24;
// The concession lands on the lease's 2nd month by default, at every building (2110 no longer puts it on the last month:
// production D29). It can still be changed.
export const DEFAULT_CONCESSION_MONTH_INDEX = 1;

// Rider math: daily rate = rent ÷ days in the start month; pro-rata = daily rate × days from the start through month-end.
// The tenant pays a full month up front, so the overpayment is credited to month 2. A concession (fraction of a month, or
// dollars when frac is 'other') lands on concKey; an extra dollar credit on creditKey (default month 2). A month that goes
// negative carries the rest forward. Returns null when there is nothing to say.
export function proRataSchedule({ rent, start, frac, concOtherAmount, concKey, extra, creditKey }) {
  const daysInMonth = new Date(start.y, start.m + 1, 0).getDate();
  const days = daysInMonth - start.d + 1;
  const proRata = apvRound2(rent / daysInMonth * days);
  const credit = start.d === 1 ? 0 : apvRound2(rent - proRata);
  const concAmt = frac === 'other' ? apvRound2(concOtherAmount) : apvRound2(rent * frac);
  const m2 = apvAddMonths(start.y, start.m, 1);
  creditKey = creditKey || apvMonthKey(m2.y, m2.m);
  if (credit === 0 && concAmt === 0 && extra === 0) return null;

  const byMonth = {};
  const add = (key, label, amt) => { if (amt > 0) (byMonth[key] = byMonth[key] || []).push({ label, amt }); };
  add(apvMonthKey(m2.y, m2.m), 'pro-rata credit', credit);
  add(creditKey, 'credit', extra);
  if (concAmt > 0 && concKey) add(concKey, 'concession', concAmt);

  // Waterfall from month 2 forward: a month is listed if it has a credit or receives a carry-over.
  const scheduled = Object.keys(byMonth).sort();
  const lastKey = scheduled[scheduled.length - 1];
  const months = [];
  let carry = 0;
  for (let i = 1; i < 60; i++) {
    const mm = apvAddMonths(start.y, start.m, i);
    const key = apvMonthKey(mm.y, mm.m);
    const credits = byMonth[key] || [];
    const carriedIn = carry;
    const total = credits.reduce((a, c) => a + c.amt, 0) + carriedIn;
    let due = apvRound2(rent - total);
    carry = due < 0 ? apvRound2(-due) : 0;
    if (due < 0) due = 0;
    if (credits.length || carriedIn > 0) months.push({ y: mm.y, m: mm.m, due, credits, carriedIn, carried: carry });
    if (carry === 0 && key >= lastKey) break;
  }
  return { months, proRata, credit, days, daysInMonth, start, rent, concAmt, frac, extra };
}

// ===== Lease assignments (production D32): App Confirmation and Lease Approval =====
// An assignment usually runs to the end of the current lease. Under a year (end before the start + 12 months − 1 day,
// e.g. Nov 1 → Oct 31 is a year) the apartment is delivered "as is"; a year or more and it must be prepped, so the agent
// is reminded (on screen and after copying, never in the email) to confirm the current tenant leaves early enough.
export const AS_IS_LINE = 'Please note: the apartment is delivered "as is".';   // the same words in both emails
export const ASSIGN_PREP_NOTE = 'One-year assignment: the unit must be prepped. Confirm the current tenant is vacating at least 5 days before their surrender date, so there is enough time to prep the apartment.';
// 'under' | 'year' | 'before' (end before start) | null (a date can't be read). Dates as typed (05312027) or as words.
export function assignmentTerm(startStr, endStr) {
  const read = x => parseWordDate(parseTypedDate(x) || x);
  const s = read(startStr), e = read(endStr);
  if (!s || !e) return null;
  const start = new Date(s.y, s.m, s.d), end = new Date(e.y, e.m, e.d), year = new Date(s.y, s.m + 12, s.d - 1);
  return end < start ? 'before' : end < year ? 'under' : 'year';
}
// The note under the dates: the prep reminder at a year or more (shown amber), what the email does under a year,
// otherwise what to fix. startWord names the start field ('move-in', 'lease start').
export function assignmentNote(term, startWord, underMsg) {
  return term === 'year' ? ASSIGN_PREP_NOTE : term === 'under' ? underMsg
    : term === 'before' ? `The lease end date is before the ${startWord} date.` : `Enter the ${startWord} and lease end dates to see whether the assignment is under a year.`;
}
// After Copy for Outlook: the prep reminder again, for a ticked assignment of a year or more
export const assignmentPrepDue = (isAssign, startStr, endStr) => !!isAssign && assignmentTerm(startStr, endStr) === 'year';
// Lease Approval's "Delivered as-is": ticked under a year, unticked at a year or more, until it is changed by hand.
// Dates it can't judge (blank, unreadable, end before start) leave it as it is.
export function asIsFromDates(term, checked, touchedByHand) {
  if (touchedByHand || (term !== 'under' && term !== 'year')) return checked;
  return term === 'under';
}
