// Number formatting shared by the email builder and the pricing rules, and the price boxes on both apps.

export function formatRent(r) {
  if (r === null || r === undefined || r === '') return '?';
  return Number(r).toLocaleString('en-US');
}

// Price boxes take whole dollars (production D45): "$4,500" as you type; cents (anything after a ".") and letters are dropped.
// parseMoney gives the number, or null for empty, zero or no digits; moneyText gives "$4,500", or '' for those.
export function parseMoney(v) { return parseInt(String(v == null ? '' : v).split('.')[0].replace(/[^0-9]/g, ''), 10) || null; }
export function moneyText(n) { const v = parseMoney(n); return v ? '$' + v.toLocaleString('en-US') : ''; }
// A price box after a keystroke: what it shows, and where the cursor goes. `at` is the cursor in the typed text; the cursor
// stays right after the same digit it followed (the digits before it, up to any ".", are counted), so "$" and "," don't move it.
export function moneyTyped(raw, at) {
  const typed = String(raw == null ? '' : raw), digitsBefore = typed.slice(0, at).split('.')[0].replace(/[^0-9]/g, '').length;
  const value = moneyText(parseMoney(typed));
  let caret = 0; for (let seen = 0; caret < value.length && seen < digitsBefore; caret++) if (/\d/.test(value[caret])) seen++;
  return { value, caret };
}
