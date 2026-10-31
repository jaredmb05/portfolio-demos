// Unit and building identifiers, and how unit types read in an email.

export function bldgNum(s) {
  if (!s) return '';
  const m = String(s).match(/\d{4}/);
  return m ? m[0] : String(s).trim().toUpperCase();
}
export function normUnit(u) {
  if (u === null || u === undefined) return '';
  return String(u).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
}
export function fpKey(building, unit) { return `${bldgNum(building)}|${normUnit(unit)}`; }

// Expand abbreviations in unit type strings (whole-word match only)
const TYPE_ABBREVIATIONS = [
  [/\bW\/D\b/g, 'In-Unit W/D'],
  [/\bWD\b/g, 'In-Unit W/D'],
  [/\bWIC\b/g, 'Walk-in-Closet'],
  [/\bBalc\b/g, 'Balcony'],
  [/\bTerr\b/g, 'Terrace'],
  [/\bAlc\b/g, 'Alcove'],
  [/\bDA\b/g, 'Dining Area'],
  [/\bHC\b/g, 'High Ceilings'],
];
export function expandType(s) {
  if (!s) return '';
  let out = String(s);
  for (const [pat, rep] of TYPE_ABBREVIATIONS) out = out.replace(pat, rep);
  return out;
}
export function bldgTitle(b) { return String(b||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

export function unitSelectKey(u) { return `${u.building}::${u.unit}`; }
