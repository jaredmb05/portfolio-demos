// Unit types, views and bedroom sizes, the dropdowns built from them, and the one-line summary of a prospect's needs.

export const BED_OPTIONS = ['Studio','1 Bed','2 Bed','2 Bed/1 Bath','3 Bed'];
export function profileSummary(pr) {
  if (!pr) return '';
  const parts = [];
  if (pr.beds && pr.beds.length) parts.push(pr.beds.join(' / '));
  if (pr.priceMin || pr.priceMax) parts.push(pr.priceMin && pr.priceMax ? `$${pr.priceMin.toLocaleString()}–$${pr.priceMax.toLocaleString()}` : pr.priceMax ? `up to $${pr.priceMax.toLocaleString()}` : `from $${pr.priceMin.toLocaleString()}`);
  if (pr.moveIn) parts.push(`move-in ${new Date(pr.moveIn + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${pr.flexible ? ' (flexible)' : ''}`);
  else if (pr.flexible) parts.push('move-in flexible');
  if (pr.mustHaves) parts.push(pr.mustHaves);
  return parts.join(' · ');
}

const TYPE_OPTIONS = ['Studio, 1 Bath', '1 Bed, 1 Bath', '2 Bed, 1 Bath', '2 Bed, 2 Bath', '2 Bed, 3 Bath', '3 Bed, 2 Bath', '3 Bed, 3 Bath'];
export function typeSelectHtml(current, onchangeJs, escFn, id) {
  const cur = current || '';
  const known = TYPE_OPTIONS.includes(cur);
  return `<select ${id ? `id="${id}"` : ''} onchange="${onchangeJs}"><option value="">Select type…</option>${TYPE_OPTIONS.map(v => `<option value="${escFn(v)}" ${v === cur ? 'selected' : ''}>${escFn(v)}</option>`).join('')}${cur && !known ? `<option value="${escFn(cur)}" selected>${escFn(cur)}</option>` : ''}</select>`;
}
const VIEW_OPTIONS = [
  'Manhattan Skyline, River, Waterfront Park',
  'Manhattan Skyline, River, Harbor Bridge',
  'Manhattan Skyline, River',
  'Partial Manhattan Skyline, River, Waterfront Park',
  'Partial Manhattan Skyline, River, Harbor Bridge',
  'Partial Manhattan Skyline, River',
  'Tidemark Blvd',
  'Tidemark Harbor'
];
export function viewSelectHtml(current, onchangeJs, escFn, id) {
  const cur = current || '';
  const known = VIEW_OPTIONS.includes(cur);
  return `<select ${id ? `id="${id}"` : ''} onchange="${onchangeJs}"><option value="">Select a view…</option>${VIEW_OPTIONS.map(v => `<option value="${escFn(v)}" ${v === cur ? 'selected' : ''}>${escFn(v)}</option>`).join('')}${cur && !known ? `<option value="${escFn(cur)}" selected>${escFn(cur)} (from showsheet)</option>` : ''}</select>`;
}
// Does a showsheet unit fit the prospect's stated needs? (bedroom sizes and price range from the tour's criteria)
export function fitsNeeds(u, profile) {
  const pr = profile || {}; const beds = pr.beds || [];
  const type = String(u.type || '');
  if (beds.length) {
    const is = { 'Studio': /^studio/i.test(type), '1 Bed': /^1 bed/i.test(type), '2 Bed': /^2 b(ed|drm)/i.test(type) && !/1 bath/i.test(type), '2 Bed/1 Bath': /^2 b(ed|drm)/i.test(type) && /1 bath/i.test(type), '3 Bed': /^3 bed/i.test(type) };
    if (!beds.some(b => is[b])) return false;
  }
  const rent = Number(u.monthly) || 0;
  if (pr.priceMin && rent < pr.priceMin) return false;
  if (pr.priceMax && rent > pr.priceMax) return false;
  return true;
}
