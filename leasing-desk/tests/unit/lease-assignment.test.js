// Lease assignments (production D32): under a year the apartment is delivered "as is"; a year or more it must be prepped.
import { describe, expect, it } from 'vitest';
import { AS_IS_LINE, ASSIGN_PREP_NOTE, asIsFromDates, assignmentNote, assignmentPrepDue, assignmentTerm } from '../../apps/desk/js/rules/lease-approval.js';

describe('how long an assignment runs (move-in or lease start → lease end)', () => {
  it('under a year: delivered "as is" (Nov 1, 2026 → May 31, 2027)', () => {
    expect(assignmentTerm('November 1, 2026', 'May 31, 2027')).toBe('under');
  });
  it('exactly one year (Nov 1, 2026 → Oct 31, 2027): no "as is"; the unit must be prepped', () => {
    expect(assignmentTerm('November 1, 2026', 'October 31, 2027')).toBe('year');
    expect(assignmentTerm('November 1, 2026', 'October 30, 2027')).toBe('under');
  });
  it('more than a year counts as a year', () => {
    expect(assignmentTerm('November 1, 2026', 'December 31, 2027')).toBe('year');
  });
  it('a lease end on the start date itself is under a year', () => {
    expect(assignmentTerm('November 1, 2026', 'November 1, 2026')).toBe('under');
  });
  it('an end date before the start is neither (the note says so)', () => {
    expect(assignmentTerm('November 1, 2026', 'October 31, 2026')).toBe('before');
  });
  it('a leap year: Mar 1, 2027 → Feb 29, 2028 is a year, Feb 28 is under; Feb 29, 2028 → Feb 28, 2029 is a year', () => {
    expect(assignmentTerm('March 1, 2027', 'February 29, 2028')).toBe('year');
    expect(assignmentTerm('March 1, 2027', 'February 28, 2028')).toBe('under');
    expect(assignmentTerm('February 29, 2028', 'February 28, 2029')).toBe('year');
    expect(assignmentTerm('February 29, 2028', 'February 27, 2029')).toBe('under');
  });
  it('a move-in at month end: Jan 31, 2027 → Jan 30, 2028 is a year, Jan 29 is under', () => {
    expect(assignmentTerm('January 31, 2027', 'January 30, 2028')).toBe('year');
    expect(assignmentTerm('January 31, 2027', 'January 29, 2028')).toBe('under');
  });
  it('dates still as typed (11012026, 5/31/2027) read the same as the words they become', () => {
    expect(assignmentTerm('11012026', '05312027')).toBe('under');
    expect(assignmentTerm('11/1/2026', '10312027')).toBe('year');
  });
  it('a blank or unreadable date gives no answer', () => {
    expect(assignmentTerm('', 'May 31, 2027')).toBeNull();
    expect(assignmentTerm('November 1, 2026', '')).toBeNull();
    expect(assignmentTerm('next month', 'May 31, 2027')).toBeNull();
  });
});

describe('what the forms and emails say about an assignment', () => {
  it('both emails use the same as-is sentence', () => {
    expect(AS_IS_LINE).toBe('Please note: the apartment is delivered "as is".');
  });
  it('a year or more: the note under the dates is the prep reminder, word for word', () => {
    expect(assignmentNote('year', 'move-in', 'Under a year…')).toBe(ASSIGN_PREP_NOTE);
    expect(ASSIGN_PREP_NOTE).toBe('One-year assignment: the unit must be prepped. Confirm the current tenant is vacating at least 5 days before their surrender date, so there is enough time to prep the apartment.');
  });
  it('under a year the note says what the email does; a reversed or missing date says what to fix', () => {
    expect(assignmentNote('under', 'move-in', 'Under a year: the email says so.')).toBe('Under a year: the email says so.');
    expect(assignmentNote('before', 'move-in', '')).toBe('The lease end date is before the move-in date.');
    expect(assignmentNote(null, 'lease start', '')).toBe('Enter the lease start and lease end dates to see whether the assignment is under a year.');
  });
  it('the prep reminder after copying: only for a ticked assignment of a year or more', () => {
    expect(assignmentPrepDue(true, 'November 1, 2026', 'October 31, 2027')).toBe(true);
    expect(assignmentPrepDue(true, 'November 1, 2026', 'May 31, 2027')).toBe(false);
    expect(assignmentPrepDue(false, 'November 1, 2026', 'October 31, 2027')).toBe(false);
    expect(assignmentPrepDue(true, 'November 1, 2026', '')).toBe(false);
  });
});

describe('Lease Approval: "Delivered as-is" follows the dates', () => {
  it('ticks itself under a year and unticks at a year or more', () => {
    expect(asIsFromDates('under', false, false)).toBe(true);
    expect(asIsFromDates('year', true, false)).toBe(false);
  });
  it('once changed by hand, the dates leave it alone', () => {
    expect(asIsFromDates('year', true, true)).toBe(true);
    expect(asIsFromDates('under', false, true)).toBe(false);
  });
  it('dates it can\'t judge (blank, unreadable, end before start) leave it as it is', () => {
    for (const term of [null, 'before']) {
      expect(asIsFromDates(term, true, false)).toBe(true);
      expect(asIsFromDates(term, false, false)).toBe(false);
    }
  });
});
