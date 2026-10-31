// Future Move-Ins → Add to Outlook: the calendar file for a lead's follow-up date (production D43). Every value it writes is
// cleaned, so a line break saved in a lead (anyone can write one, D4) can't add a line of its own. The leads are invented.
import { describe, expect, it } from 'vitest';
import { flShort, followUpIcs } from '../../apps/desk/js/rules/future-move-ins.js';

const NOW = new Date('2026-10-06T14:10:00');   // Tuesday, New York time
const toured = { id: 'tour-x-ana', source: 'tour', name: 'Ana P.', assistant: 'Nadia', tourDate: '2026-08-17', moveIn: '2026-10-16', followUpDate: '2026-09-16', criteria: '2 Bed · $0–$6,500', units: '#1901, #3601', status: 'open' };
const byHand = { id: 'm-jordan', source: 'manual', name: 'Jordan K.', assistant: '', tourDate: '2026-10-04', moveIn: '2027-03-05', followUpDate: '2027-02-03', criteria: '', units: '', status: 'open' };
const lines = ics => ics.split('\r\n');
const KNOWN = /^(BEGIN|END|VERSION|PRODID|UID|DTSTAMP|DTSTART|DTEND|SUMMARY|DESCRIPTION|TRIGGER|ACTION):/;

describe('Add to Outlook: the calendar file', () => {
  it('a toured lead: 9:30–9:45 AM on the follow-up date, a pop-up reminder, where to find their email; CRLF line ends', () => {
    expect(lines(followUpIcs(toured, NOW))).toEqual([
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leasing Desk Demo//Future Move-Ins//EN', 'BEGIN:VEVENT',
      'UID:tour-x-ana@leasing-desk.example', 'DTSTAMP:20261006T181000Z', 'DTSTART:20260916T093000', 'DTEND:20260916T094500',
      'SUMMARY:Follow up: Ana P. (toured Aug 17) — move-in Oct 16',
      'DESCRIPTION:Move-in: Oct 16\\nLooking for: 2 Bed · $0–$6\\,500\\nToured: #1901\\, #3601\\nLeasing assistant: Nadia\\nFind the original email in Outlook: search "Ana" around Aug 17.',
      'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Follow up: Ana P. (toured Aug 17) — move-in Oct 16', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
    ]);
  });
  it('a lead added by hand: "added" and the date, only the move-in in the description; a date in another year shows the year', () => {
    const l = lines(followUpIcs(byHand, NOW));
    expect(l).toContain('DTSTART:20270203T093000');
    expect(l).toContain('SUMMARY:Follow up: Jordan K. (added Oct 4) — move-in Mar 5\\, 2027');
    expect(l).toContain('DESCRIPTION:Move-in: Mar 5\\, 2027');
  });
  it('no valid follow-up date: no file', () => {
    for (const followUpDate of ['soon', '', undefined, null, '2026-9-16', '2026-09-16T09:30', '2026-09-16\nSUMMARY:x']) expect(followUpIcs({ ...toured, followUpDate }, NOW)).toBe('');
  });
  it('a line break saved in a lead (LF, CR or CRLF) adds no line of its own', () => {
    const ics = followUpIcs({ ...toured, name: 'Remy C.\rSUMMARY:Other', criteria: '1 Bed\nDTSTART:20300101T000000', units: '#714\r\nEND:VCALENDAR', assistant: 'Rosa\nACTION:AUDIO' }, NOW);
    expect(lines(ics).every(x => KNOWN.test(x))).toBe(true);
    expect(lines(ics).filter(x => /^(SUMMARY|DTSTART|END:VCALENDAR|ACTION)/.test(x))).toEqual(['DTSTART:20260916T093000', 'SUMMARY:Follow up: Remy C.\\nSUMMARY:Other (toured Aug 17) — move-in Oct 16', 'ACTION:DISPLAY', 'END:VCALENDAR']);
    expect(ics).not.toMatch(/[^\n]\r(?!\n)|[^\r]\n/);   // no lone CR or LF anywhere
  });
  it('the UID keeps only letters, digits, ".", "-" and "_"; an ID with none of them becomes "lead"', () => {
    expect(lines(followUpIcs({ ...toured, id: 'lead-cal\nSUMMARY:Other' }, NOW))).toContain('UID:lead-calSUMMARYOther@leasing-desk.example');
    expect(lines(followUpIcs({ ...toured, id: "tour-t-theo-d'angelo_2.b" }, NOW))).toContain('UID:tour-t-theo-dangelo_2.b@leasing-desk.example');
    expect(lines(followUpIcs({ ...toured, id: "'; \r\n" }, NOW))).toContain('UID:lead@leasing-desk.example');
  });
  it('backslashes, commas and semicolons in the text are escaped', () => {
    expect(lines(followUpIcs({ ...byHand, name: 'A\\B; C, D' }, NOW))).toContain('SUMMARY:Follow up: A\\\\B\\; C\\, D (added Oct 4) — move-in Mar 5\\, 2027');
  });
});

describe('dates on Future Move-Ins', () => {
  it('a date this year shows month and day; another year adds the year; none shows nothing', () => {
    expect(flShort('2026-12-16', NOW)).toBe('Dec 16');
    expect(flShort('2027-01-15', NOW)).toBe('Jan 15, 2027');
    expect(flShort('', NOW)).toBe('');
  });
});
