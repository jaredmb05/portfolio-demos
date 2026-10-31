// Formatting and unit / building identifiers.

export const bnum = b => (String(b||'').match(/\d{4}/) || [''])[0];
export const normUnit = u => String(u ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^0+/,'');
export const fpKey = (b,u) => `${bnum(b)}|${normUnit(u)}`;
export function bldgTitle(b) { return String(b||'').split(/\s+[-•]\s+/)[0].replace(/\s+/g,' ').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
export function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `today ${t}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${t}`;
}
export const stopKey = u => `${bnum(u.building)}|${normUnit(u.unit)}`;
