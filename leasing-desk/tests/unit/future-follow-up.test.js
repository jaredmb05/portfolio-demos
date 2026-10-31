// Future Move-Ins → Copy follow-up (production Desk v1.31, D39): the email to paste into a reply on the prospect's Outlook
// thread, built from the lead alone (no email address is stored, D14). The leads below are invented.
import { describe, expect, it } from 'vitest';
import { futureFollowUpHtml } from '../../apps/desk/js/rules/future-move-ins.js';

const toured = { id: 'tour-x-ana', source: 'tour', name: 'Ana P.', assistant: 'Nadia', tourDate: '2026-08-17', moveIn: '2026-10-16', followUpDate: '2026-09-16', criteria: '2 Bed · $0–$6,500', units: '#1901, #3601', status: 'open' };
const byHand = { id: 'm-jordan', source: 'manual', name: 'Jordan K.', assistant: '', tourDate: '2026-10-04', moveIn: '2027-03-05', followUpDate: '2027-02-03', criteria: '', units: '', status: 'open' };
const text = html => html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').split('\n').map(s => s.trim()).filter(Boolean);
const lead = extra => Object.assign({}, toured, extra);

describe('Copy follow-up: the email for a Future Move-Ins lead', () => {
  it('a toured prospect: first name, "When you toured with us on" the tour date, the move-in date and the size they asked for', () => {
    expect(text(futureFollowUpHtml(toured))).toEqual([
      'Hi Ana,',
      'I hope all is well! When you toured with us on August 17, you mentioned you were planning to move in around October 16.',
      "As your move-in date gets closer, I wanted to check in to see if you're still looking for a 2 bedroom. I'd be happy to send over current availability or set up a time for you to come back in.",
      'Please let me know if I can be of any further assistance.',
    ]);
  });
  it('built like the check-in email: Calibri 11pt, one <p> per line with a blank line between', () => {
    const p = t => `<p style="margin:0; padding:0;">${t}</p>`, gap = p('&nbsp;');
    expect(futureFollowUpHtml(toured)).toBe(`<div style="font-family:Calibri,Arial,sans-serif; font-size:11pt;">${p('Hi Ana,')}${gap}`
      + `${p('I hope all is well! When you toured with us on August 17, you mentioned you were planning to move in around October 16.')}${gap}`
      + `${p("As your move-in date gets closer, I wanted to check in to see if you're still looking for a 2 bedroom. I'd be happy to send over current availability or set up a time for you to come back in.")}${gap}`
      + `${p('Please let me know if I can be of any further assistance.')}</div>`);
  });
  it('a lead added by hand: "When we spoke on" the day it was added', () => {
    expect(text(futureFollowUpHtml(byHand))[1]).toBe('I hope all is well! When we spoke on October 4, you mentioned you were planning to move in around March 5.');
  });
  it('no size asked for: "still looking." with no size', () => {
    expect(text(futureFollowUpHtml(byHand))[2]).toMatch(/^As your move-in date gets closer, I wanted to check in to see if you're still looking\. I'd be happy/);
    expect(text(futureFollowUpHtml(lead({ criteria: undefined })))[2]).toMatch(/still looking\. I'd be happy/);
  });
  it('the size is read from the first part of the criteria, written the way a prospect would say it', () => {
    const sizeLine = criteria => text(futureFollowUpHtml(lead({ criteria })))[2].match(/still looking( for [^.]+)?\./)[0];
    expect(sizeLine('Studio · up to $3,300')).toBe('still looking for a studio.');
    expect(sizeLine('1 Bed · $3,800–$4,200 · W/D')).toBe('still looking for a 1 bedroom.');
    expect(sizeLine('2 Bed/1 Bath · up to $5,600')).toBe('still looking for a 2 bedroom.');
    expect(sizeLine('3 Bed · up to $9,800')).toBe('still looking for a 3 bedroom.');
  });
  it('two sizes asked for ("1 Bed / 2 Bed"): the first is named', () => {
    expect(text(futureFollowUpHtml(lead({ criteria: '1 Bed / 2 Bed · up to $6,000' })))[2]).toMatch(/still looking for a 1 bedroom\./);
  });
  it('criteria that don\'t start with a size (only a budget, notes first, a typo): no size, never a guess', () => {
    ['up to $5,000', 'W/D, high floor · 2 Bed', 'two bedroom-ish', '   ', '·'].forEach(criteria =>
      expect(text(futureFollowUpHtml(lead({ criteria })))[2]).toMatch(/still looking\. I'd be happy/));
  });
  it('never a price or a unit number, whatever the lead holds', () => {
    const html = futureFollowUpHtml(lead({ criteria: '2 Bed · $5,800–$6,400 · W/D · near the 2230 lobby', units: '#3107, #2608' }));
    expect(html).not.toMatch(/\$|#|3107|2608|5,800|6,400|2230/);
  });
  it('dates are month and day, also for a move-in next year, and never a day off across the clock change', () => {
    expect(text(futureFollowUpHtml(lead({ tourDate: '2026-11-01', moveIn: '2027-01-15' })))[1]).toBe('I hope all is well! When you toured with us on November 1, you mentioned you were planning to move in around January 15.');
  });
  it('no tour date on the lead: "When you toured with us," without a date', () => {
    expect(text(futureFollowUpHtml(lead({ tourDate: '' })))[1]).toBe('I hope all is well! When you toured with us, you mentioned you were planning to move in around October 16.');
  });
  it('only the first name is used, and it is escaped: markup stays text', () => {
    expect(text(futureFollowUpHtml(lead({ name: 'Rory O\'Shea' })))[0]).toBe('Hi Rory,');
    const html = futureFollowUpHtml(lead({ name: '<img/src=x/onerror=alert(1)> K.' }));
    expect(html).not.toContain('<img');
    expect(html).toContain('Hi &lt;img/src=x/onerror=alert(1)&gt;,');
    expect(futureFollowUpHtml(lead({ name: "D'Andre K." }))).toContain('Hi D&#39;Andre,');
  });
});
