// Leasing assistant contest (production Desk v1.29, D35): a showsheet NOTES cell that mentions a gift card flags the unit on
// the Desk's unit list (Tour and Inquiry follow-up) with the note as written, through the date in the note. Desk only: never
// in emails, not on the iPad, not in Reports.
import { ymd } from '../../../shared/dates.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const CONTEST_MAX = 120;

// The note kept on the unit: spaces and line breaks collapsed, at most 120 characters. '' unless it mentions a gift card
// ("gift card", "GIFT CARD", "giftcard").
export function contestNote(notes) {
  const n = String(notes ?? '').replace(/\s+/g, ' ').trim();
  return /gift\s*card/i.test(n) ? n.slice(0, CONTEST_MAX) : '';
}

// The note's date ("10/31", "10/31/26", "Oct 31") as YYYY-MM-DD. No year: this year, or next year when that date is more
// than two months gone (a January deadline written in December). No date: '' (shown until the note is removed).
export function contestDeadline(text, now = new Date()) {
  let m = String(text).match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/), mo, d, y = null;
  if (m) { mo = +m[1]; d = +m[2]; if (m[3]) y = +m[3]; }
  else if ((m = String(text).match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i))) { mo = MONTHS.indexOf(m[1].toLowerCase()) + 1; d = +m[2]; if (m[3]) y = +m[3]; }
  else return '';
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  if (y === null) { y = now.getFullYear(); if (new Date(y, mo - 1, d) < new Date(now.getFullYear(), now.getMonth() - 2, now.getDate())) y++; }
  else if (y < 100) y += 2000;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Shown through the deadline day, gone the day after
export function contestActive(u, now = new Date()) {
  if (!u || !u.contest) return false;
  return !u.contestUntil || ymd(now) <= u.contestUntil;
}
