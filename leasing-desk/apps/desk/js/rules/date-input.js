// Dates typed into the email forms.
import { MONTHS } from '../../../shared/dates.js';

// "01232026", "1/23/2026", "01-23-26" → "January 23, 2026". Null if it can't confidently parse (free text is left as typed).
export function parseTypedDate(raw) {
  raw = String(raw || '').trim();
  if (!raw) return null;
  let mo, day, yr;
  const digits = raw.replace(/\D/g, '');
  if (/^\d+$/.test(raw.replace(/\s/g,'')) && (digits.length === 8 || digits.length === 6)) {
    mo = parseInt(digits.slice(0, 2), 10);
    day = parseInt(digits.slice(2, 4), 10);
    yr = parseInt(digits.slice(4), 10);
  } else {
    const parts = raw.split(/[\/\.\-]/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
      mo = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      yr = parseInt(parts[2], 10);
    } else {
      return null; // already words or unrecognized — leave as typed
    }
  }
  if (yr < 100) yr += 2000;
  if (!(mo >= 1 && mo <= 12) || !(day >= 1 && day <= 31) || !(yr >= 2000 && yr <= 2099)) return null;
  return `${MONTHS[mo - 1]} ${day}, ${yr}`;
}
// "January 23, 2026" → { y, m (0-based), d }, or null
export function parseWordDate(str) {
  const m = String(str || '').trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const mi = MONTHS.findIndex(n => n.toLowerCase() === m[1].toLowerCase());
  if (mi < 0) return null;
  const d = parseInt(m[2], 10), y = parseInt(m[3], 10);
  if (d < 1 || d > 31) return null;
  return { y, m: mi, d };  // m is 0-based
}
