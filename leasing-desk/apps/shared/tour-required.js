// What a prospect tour needs before it goes in the queue or starts (production D45), the same on the Desk (Plan a tour: Send
// to queue, Send & pick units, Start tour now) and the iPad (New tour: Send to queue, Start tour): the first name; the broker's
// last name when there's a broker; at least one size; the most they'd pay per month, or the price's Flexible box; a move-in
// date, or the date's Flexible box; and on the iPad at least one unit. A resident inspection needs only the name here (its
// unit is asked for where it's typed). Each missing item names the field it belongs to (each app maps it to its own box), the
// words for the message, and the note shown under the field.
import { parseMoney } from './format.js';

export function tourMissing(t, { needUnit = false } = {}) {
  const tour = t || {}, pr = tour.profile || {}, miss = [];
  const insp = tour.kind === 'inspection';
  if (!String(tour.prospectFirst || '').trim()) miss.push({ field: 'first', name: 'first name', note: insp ? "Enter the resident's first name." : "Enter the prospect's first name." });
  if (insp) return miss;
  if (tour.broker && !String(tour.brokerLast || '').trim()) miss.push({ field: 'brokerLast', name: "the broker's last name", note: "Enter the broker's last name." });
  if (!(pr.beds || []).length) miss.push({ field: 'beds', name: 'size', note: 'Pick at least one size.' });
  if (!parseMoney(pr.priceMax) && !pr.priceFlexible) miss.push({ field: 'max', name: "the most they'd pay (or Flexible)", note: "Enter the most they'd pay per month, or tick Flexible." });
  if (!pr.moveIn && !pr.flexible) miss.push({ field: 'moveIn', name: 'move-in date (or Flexible)', note: 'Pick a move-in date, or tick Flexible.' });
  if (needUnit && !(tour.stops || []).length) miss.push({ field: 'units', name: 'at least one unit', note: '' });
  return miss;
}
// The details alone, without the unit (production iPad v1.28, D48): what the iPad asks for at "Done — pick units ↓" and before a
// unit is added, since the units are the next step
export const detailsMissing = t => tourMissing(t).filter(m => m.field !== 'units');
// One message naming everything missing: "Still needed: size and move-in date (or Flexible)."; '' when nothing is
export function stillNeeded(miss) {
  const names = (miss || []).map(m => m.name);
  if (!names.length) return '';
  return 'Still needed: ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + '.';
}
