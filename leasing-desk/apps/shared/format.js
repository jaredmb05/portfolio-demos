// Number formatting shared by the email builder and the pricing rules.

export function formatRent(r) {
  if (r === null || r === undefined || r === '') return '?';
  return Number(r).toLocaleString('en-US');
}
