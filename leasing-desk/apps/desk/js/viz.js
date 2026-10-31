// Reports charts (production Desk v1.28–v1.31, D33): hand-built inline SVG, no chart library. Every chart has a table view
// (in reports.js) and the same details on hover and on keyboard focus, through the one tooltip at the bottom of this file.
// Colors are the chart tokens on .reports (styles.css), never text colors: labels and values use the ink tokens.
import { escapeHtml } from '../../shared/html.js';
import { REPORT_DAYS, REPORT_FIT, rptHour, rptMoney, rptN, rptPct } from './rules/reports.js';

// A round gridline step for an axis that reaches max with about `ticks` lines: 1, 2 or 5 × a power of ten
export function niceStep(max, ticks) { const raw = Math.max(1, max) / ticks, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p); }
// Bars rounded only at the data end (top of a column, right of a bar); r = 0 for a segment under another one
function vbarPath(x, y, w, h, r) { r = Math.min(r, w / 2, h); if (h <= 0) return ''; if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`; return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; }
function hbarPath(x, y, w, h, r) { r = Math.min(r, h / 2, w); if (w <= 0) return ''; if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`; return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; }
// One hover / focus target: tip = { v: value (shown strong), l: what it is, rows: [[name, value, color token]] }
function vizHit(tip, aria, box, inner) { return `<g class="viz-hit" data-tip="${escapeHtml(JSON.stringify(tip))}" tabindex="0" role="img" aria-label="${escapeHtml(aria)}">${box}${inner || ''}</g>`; }
function vizBox(x, y, w, h) { return `<rect class="viz-hitbox" x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" rx="3"/>`; }
export function vizLegend(items) { return `<div class="viz-legend">${items.map(([name, v, shape]) => `<span><i class="${shape || ''}" style="background:var(${v})"></i>${escapeHtml(name)}</span>`).join('')}</div>`; }
function vizSvg(w, h, label, body, interactive) { return `<svg class="viz" viewBox="0 0 ${w} ${h}" width="${w}" style="max-width:100%" role="${interactive ? 'group' : 'img'}" aria-label="${escapeHtml(label)}">${body}</svg>`; }
function vizGridY(top, step, Y, x1, x2) { let g = ''; for (let t = 0; t <= top + 1e-9; t += step) g += `<line class="viz-grid${t ? '' : ' base'}" x1="${x1}" x2="${x2}" y1="${Y(t)}" y2="${Y(t)}"/><text class="viz-tick" x="${x1 - 7}" y="${Y(t) + 3.5}" text-anchor="end">${t.toLocaleString('en-US')}</text>`; return g; }
// A chart's table view: the first column is the row's name; foot = the totals row
export function vizTable(head, rows, foot) {
  const cells = (r, tag) => r.map((c, i) => i ? `<${tag} class="num">${escapeHtml(String(c))}</${tag}>` : `<th scope="row">${escapeHtml(String(c))}</th>`).join('');
  return `<div class="rpt-tablewrap"><table class="rpt-table"><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody>${foot ? `<tfoot><tr>${cells(foot, 'td')}</tr></tfoot>` : ''}</table></div>`;
}
// The small trend line on a summary number (full weeks only)
export function vizSpark(values, label) {
  if (values.length < 2) return '';
  const w = 84, h = 26, max = Math.max(1, ...values), X = i => 3 + i * (w - 6) / (values.length - 1), Y = v => h - 4 - v / max * (h - 8);
  return `<svg class="viz-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeHtml(label)}"><polyline points="${values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}"/><circle cx="${X(values.length - 1)}" cy="${Y(values[values.length - 1])}" r="3"/></svg>`;
}
// Stacked columns, one per week; sizes from the bottom (Studio) to the top (3 Bed); the total on the cap; size names
// beside the last column. Hovering or focusing a column lists every size for that week.
export function vizStackCols(cats, series, w, unitWord) {
  const H = 248, pl = 40, pt = 22, pb = 30, n = cats.length;
  const tot = cats.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
  const step = niceStep(Math.max(...tot), 4), top = Math.max(step, Math.ceil(Math.max(...tot) / step) * step), ph = H - pt - pb;
  const lastVals = series.map(s => s.values[n - 1] || 0).filter(v => v > 0), named = lastVals.length > 0 && lastVals.every(v => v / top * ph >= 14);
  const pr = named ? 84 : 16, pw = w - pl - pr, band = pw / n, bw = Math.min(24, Math.max(12, band * 0.4)), Y = v => pt + ph - v / top * ph;
  let g = vizGridY(top, step, Y, pl, w - pr + 10);
  cats.forEach((c, i) => {
    const x = pl + band * i + (band - bw) / 2, segs = series.map(s => ({ s, v: s.values[i] || 0 })).filter(z => z.v > 0);
    let marks = '', acc = 0;
    segs.forEach((z, j) => {
      const yb = Y(acc), yt = Y(acc + z.v), last = j === segs.length - 1, y1 = last ? yt : yt + 2;   // 2px surface gap between segments
      acc += z.v;
      if (yb - y1 >= 0.75) marks += `<path class="viz-mark" fill="var(${z.s.color})" d="${vbarPath(x, y1, bw, yb - y1, last ? 4 : 0)}"/>`;
      if (named && i === n - 1) g += `<text class="viz-dlabel" x="${x + bw + 8}" y="${(yb + yt) / 2 + 4}">${escapeHtml(z.s.name)}</text>`;
    });
    const rows = series.slice().reverse().map(s => [s.name, String(s.values[i] || 0), s.color]);
    g += vizHit({ v: `${tot[i]} ${unitWord}`, l: c.long, rows }, `${c.long}: ${tot[i]} ${unitWord}. ${rows.map(r => `${r[0]} ${r[1]}`).join(', ')}.`, vizBox(pl + band * i + 2, pt - 16, band - 4, ph + 16), marks);
    if (tot[i]) g += `<text class="viz-val" x="${x + bw / 2}" y="${Y(tot[i]) - 7}" text-anchor="middle">${tot[i]}</text>`;
    g += `<text class="viz-tick" x="${x + bw / 2}" y="${H - 9}" text-anchor="middle">${escapeHtml(c.label)}</text>`;
  });
  return vizSvg(w, H, `Apartments ${unitWord} by size, week by week`, g, true);
}
// Stacked bars, one per building, sizes in the same colors and order as the weekly chart; the total at the tip
export function vizStackBars(cats, series, w, unitWord) {
  const rh = 40, pl = 52, pr = 52, pt = 4, H = pt + cats.length * rh, pw = w - pl - pr;
  const tot = cats.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0)), max = Math.max(1, ...tot);
  let g = `<line class="viz-grid base" x1="${pl}" x2="${pl}" y1="${pt}" y2="${H}"/>`;
  cats.forEach((c, i) => {
    const y = pt + i * rh + 10, segs = series.map(s => ({ s, v: s.values[i] || 0 })).filter(z => z.v > 0);
    let x = pl + 1, marks = '';
    segs.forEach((z, j) => {
      const last = j === segs.length - 1, wFull = z.v / max * (pw - 1), wDraw = last ? wFull : wFull - 2;   // 2px surface gap between segments
      if (wDraw >= 0.75) marks += `<path class="viz-mark" fill="var(${z.s.color})" d="${hbarPath(x, y, wDraw, 20, last ? 4 : 0)}"/>`;
      x += wFull;
    });
    const rows = series.map(s => [s.name, String(s.values[i] || 0), s.color]);
    g += `<text class="viz-cat" x="${pl - 10}" y="${y + 14}" text-anchor="end">${escapeHtml(c.label)}</text>`;
    g += vizHit({ v: `${tot[i]} ${unitWord}`, l: c.long, rows }, `${c.long}: ${tot[i]} ${unitWord}. ${rows.map(r => `${r[0]} ${r[1]}`).join(', ')}.`, vizBox(2, y - 8, w - 4, 36), marks);
    g += `<text class="viz-val" x="${x + 6}" y="${y + 14}">${tot[i]}</text>`;
  });
  return vizSvg(w, H, `Apartments ${unitWord} by building and size`, g, true);
}
// Two bars per size: share asked for and share available now, values at the bar tips
export function vizPairBars(rows, w) {
  const rh = 46, pl = 64, pr = 104, pt = 4, H = pt + rows.length * rh, pw = w - pl - pr, max = Math.max(1, ...rows.flatMap(r => [r.a, r.b]));
  let g = `<line class="viz-grid base" x1="${pl}" x2="${pl}" y1="${pt}" y2="${H}"/>`;
  rows.forEach((r, i) => {
    const y = pt + i * rh + 7;
    let marks = '';
    [[r.a, r.aText, '--viz-1', 0], [r.b, r.bText, '--viz-2', 16]].forEach(([v, txt, col, dy]) => {
      const len = v / max * pw;
      if (len > 0.5) marks += `<path class="viz-mark" fill="var(${col})" d="${hbarPath(pl + 1, y + dy, len, 13, 4)}"/>`;
      marks += `<text class="viz-val" x="${pl + 1 + len + 6}" y="${y + dy + 10.5}">${escapeHtml(txt)}</text>`;
    });
    g += `<text class="viz-cat" x="${pl - 10}" y="${y + 18}" text-anchor="end">${escapeHtml(r.label)}</text>`;
    g += vizHit({ v: r.label, l: '', rows: [['Asked for at sign-in', r.aTip, '--viz-1'], ['Available today', r.bTip, '--viz-2']] }, `${r.label}: asked for at sign-in on ${r.aTip}; available today ${r.bTip}`, vizBox(2, y - 5, w - 4, 39), marks);
  });
  return vizSvg(w, H, 'Sizes asked for and sizes available now', g, true);
}
// Net rent of the apartments shown, per size: where most nets fell (band), the typical net (dot), the typical rent before
// the concession (diamond)
export function vizRanges(rows, w) {
  const vals = rows.flatMap(r => [r.p25, r.p75, r.med, r.rent]).filter(v => v != null);
  if (!vals.length) return '';
  const rh = 40, pl = 64, pr = 22, pt = 6, pb = 26, H = pt + rows.length * rh + pb, pw = w - pl - pr;
  const step = niceStep(Math.max(...vals) - Math.min(...vals) || 1000, 5);
  const lo = Math.floor(Math.min(...vals) / step) * step, hi = Math.max(lo + step, Math.ceil(Math.max(...vals) / step) * step), X = v => pl + (v - lo) / (hi - lo) * pw;
  let g = '';
  for (let t = lo; t <= hi + 1e-9; t += step) g += `<line class="viz-grid" x1="${X(t)}" x2="${X(t)}" y1="${pt}" y2="${H - pb}"/><text class="viz-tick" x="${X(t)}" y="${H - 9}" text-anchor="middle">${t >= 1000 ? '$' + +(t / 1000).toFixed(1) + 'K' : '$' + t}</text>`;
  rows.forEach((r, i) => {
    const cy = pt + i * rh + rh / 2;
    let marks = '';
    if (r.med != null) marks += `<rect class="viz-band" x="${X(r.p25)}" y="${cy - 6}" width="${Math.max(3, X(r.p75) - X(r.p25))}" height="12" rx="6"/>`;
    if (r.rent != null) marks += `<path class="viz-diamond" d="M${X(r.rent)},${cy - 7}l7,7l-7,7l-7,-7Z"/>`;
    if (r.med != null) marks += `<circle class="viz-dot" cx="${X(r.med)}" cy="${cy}" r="5.5"/>`;   // the net on top: it's the number that matters (D37)
    g += `<text class="viz-cat" x="${pl - 10}" y="${cy + 4}" text-anchor="end">${escapeHtml(r.size)}</text>`;
    const tipRows = [['Most were between', r.med != null ? `${rptMoney(r.p25)}–${rptMoney(r.p75)}` : '—'], ['Typical rent before the concession', rptMoney(r.rent), '--viz-2'], ['Apartments shown', String(r.n)]];
    if (r.med != null) g += vizHit({ v: `${rptMoney(r.med)} typical net`, l: r.size, rows: tipRows }, `${r.size}: typical net ${rptMoney(r.med)}, most between ${rptMoney(r.p25)} and ${rptMoney(r.p75)}; typical rent before the concession ${rptMoney(r.rent)}; ${rptN(r.n, 'apartment')} shown`, vizBox(2, cy - 16, w - 4, 32), marks);
  });
  return vizSvg(w, H, 'Net rent of the apartments shown by size, with the typical rent before the concession', g, true);
}
// Single-series columns with the value on the cap
export function vizCols(cats, w, unitWord, label) {
  const H = 214, pl = 40, pr = 10, pt = 22, pb = 30, n = Math.max(1, cats.length);
  const step = niceStep(Math.max(1, ...cats.map(c => c.n)), 4), top = Math.max(step, Math.ceil(Math.max(1, ...cats.map(c => c.n)) / step) * step);
  const ph = H - pt - pb, pw = w - pl - pr, band = pw / n, bw = Math.min(24, Math.max(12, band * 0.45)), Y = v => pt + ph - v / top * ph;
  let g = vizGridY(top, step, Y, pl, w - pr);
  cats.forEach((c, i) => {
    const x = pl + band * i + (band - bw) / 2;
    const mark = c.n ? `<path class="viz-mark" fill="var(--viz-1)" d="${vbarPath(x, Y(c.n), bw, Y(0) - Y(c.n), 4)}"/>` : '';
    g += vizHit({ v: `${c.n} ${unitWord}`, l: c.long, rows: c.rows }, `${c.long}: ${c.n} ${unitWord}${(c.rows || []).map(r => `; ${r[0]} ${r[1]}`).join('')}`, vizBox(pl + band * i + 2, pt - 16, band - 4, ph + 16), mark);
    if (c.n) g += `<text class="viz-val" x="${x + bw / 2}" y="${Y(c.n) - 7}" text-anchor="middle">${c.n}</text>`;
    g += `<text class="viz-tick" x="${x + bw / 2}" y="${H - 9}" text-anchor="middle">${escapeHtml(c.label)}</text>`;
  });
  return vizSvg(w, H, label, g, true);
}
// Within their price, per size: one 100% bar each (within · over), shares inside the segments that have room; the number
// of apartments at the right
export function vizFit(rows, w) {
  const rh = 36, pl = 64, pr = 52, pt = 20, H = pt + rows.length * rh, pw = w - pl - pr;
  let g = `<text class="viz-tick" x="${w - pr + 10}" y="12">Shown</text>`;
  rows.forEach((r, i) => {
    const y = pt + i * rh + 6, f = r.f, parts = REPORT_FIT.map(([k, name, col]) => ({ k, name, col, n: f[k] })).filter(p => p.n);
    let x = pl, marks = '';
    parts.forEach((p, j) => {
      const last = j === parts.length - 1, wFull = p.n / f.units * pw;
      marks += `<path class="viz-mark" fill="var(${p.col})" d="${hbarPath(x, y, last ? wFull : Math.max(0.5, wFull - 2), 20, last ? 4 : 0)}"/>`;
      if (wFull >= 40) marks += `<text class="viz-in${p.k === 'fits' ? ' on-dark' : ''}" x="${x + 7}" y="${y + 14}">${rptPct(p.n, f.units)}</text>`;
      x += wFull;
    });
    const tipRows = REPORT_FIT.map(([k, name, col]) => [name, `${rptPct(f[k], f.units)} · ${f[k]}`, col]);
    g += `<text class="viz-cat" x="${pl - 10}" y="${y + 14}" text-anchor="end">${escapeHtml(r.label)}</text>`;
    g += vizHit({ v: r.label, l: `${rptN(f.units, 'apartment')} shown to prospects who gave a price`, rows: tipRows }, `${r.label}: ${tipRows.map(t => `${t[0]} ${t[1]}`).join('; ')}`, vizBox(2, y - 6, w - 4, 32), marks);
    g += `<text class="viz-val" x="${w - pr + 10}" y="${y + 14}">${f.units}</text>`;
  });
  return vizSvg(w, H, 'Shown within the prospect’s price, by size', g, true);
}
// Weekday × hour grid, one hue (light = few, dark = many), with each day's total at the right. Hover shows a cell;
// the table view has every number.
export function vizHeat(m, w) {
  const pl = 40, pr = 46, pt = 22, ch = 27, cw = (w - pl - pr) / m.hours.length, H = pt + 7 * ch;
  let g = m.hours.map((h, i) => `<text class="viz-tick" x="${pl + cw * i + cw / 2}" y="${pt - 8}" text-anchor="middle">${h % 12 || 12}${h < 12 ? 'a' : 'p'}</text>`).join('') + `<text class="viz-tick" x="${w - pr + 8}" y="${pt - 8}">Total</text>`;
  m.grid.forEach((row, di) => {
    const y = pt + di * ch;
    g += `<text class="viz-cat" x="${pl - 8}" y="${y + ch / 2 + 4}" text-anchor="end">${REPORT_DAYS[di].slice(0, 3)}</text>`;
    row.forEach((v, hi) => {
      const k = v ? 1 + Math.min(4, Math.floor(v / Math.max(1, m.heatMax) * 4.999)) : 0;
      g += `<rect class="viz-cell" x="${pl + cw * hi + 1}" y="${y + 1}" width="${Math.max(1, cw - 2)}" height="${ch - 2}" rx="3" fill="var(${k ? '--heat-' + k : '--bg-soft'})"${v ? ` data-tip="${escapeHtml(JSON.stringify({ v: rptN(v, 'arrival'), l: `${REPORT_DAYS[di]}, ${rptHour(m.hours[hi])}–${rptHour(m.hours[hi] + 1)}` }))}"` : ''}/>`;
    });
    g += `<text class="viz-val" x="${w - pr + 8}" y="${y + ch / 2 + 4}">${m.dayTotals[di]}</text>`;
  });
  return vizSvg(w, H, `Arrivals by day and hour. Busiest: ${m.top ? `${REPORT_DAYS[m.top.day]} ${rptHour(m.top.hour)}` : 'none'}`, g, false);
}

// ---------- hover and focus details: one tooltip for every chart; text goes in with textContent ----------
let vizTipEl = null;
export function vizTipHideNow() { if (vizTipEl) { vizTipEl.style.display = 'none'; vizTipEl._for = null; } }
function vizTipShow(e) {
  const t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null, root = document.getElementById('reportsBody');
  if (!t || !root || !root.contains(t)) { vizTipHideNow(); return; }
  if (!vizTipEl) { vizTipEl = document.createElement('div'); vizTipEl.className = 'viz-tip'; vizTipEl.setAttribute('role', 'tooltip'); document.body.appendChild(vizTipEl); }
  if (vizTipEl._for !== t) {
    let d = null; try { d = JSON.parse(t.getAttribute('data-tip')); } catch (err) { d = { v: t.getAttribute('data-tip') }; }
    vizTipEl.textContent = '';
    const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
    vizTipEl.appendChild(el('strong', '', d.v || ''));
    if (d.l) vizTipEl.appendChild(el('span', 'viz-tip-l', d.l));
    (d.rows || []).forEach(([name, val, col]) => {
      const row = el('div', 'viz-tip-row'), key = el('i');
      if (col && /^--[a-z0-9-]+$/.test(col)) key.style.background = `var(${col})`; else key.className = 'none';
      row.append(key, el('span', '', name), el('b', '', val)); vizTipEl.appendChild(row);
    });
    vizTipEl._for = t;
  }
  vizTipEl.style.display = 'block';
  const r = t.getBoundingClientRect(), tw = vizTipEl.offsetWidth, th = vizTipEl.offsetHeight, kb = e.type === 'focusin';
  const x = kb ? r.left + r.width / 2 : e.clientX, y = kb ? r.top : e.clientY;
  vizTipEl.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, x - tw / 2)) + 'px';
  vizTipEl.style.top = (y - th - 14 < 8 ? Math.min(window.innerHeight - th - 8, (kb ? r.bottom : y) + 14) : y - th - 14) + 'px';
}
document.addEventListener('pointermove', vizTipShow);
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') vizTipShow(e); });   // phones and tablets: a tap shows the details, a tap elsewhere hides them (production D40)
document.addEventListener('focusin', vizTipShow);
document.addEventListener('pointerout', e => { if (!e.relatedTarget && e.pointerType !== 'touch') vizTipHideNow(); });   // the pointer left the window (a lifted finger isn't leaving)
document.addEventListener('focusout', e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('[data-tip]')) vizTipHideNow(); });
window.addEventListener('scroll', vizTipHideNow, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') vizTipHideNow(); });
