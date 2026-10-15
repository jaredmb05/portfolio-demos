// Showsheet and floor plan master: Excel parsing, the status cards, and publishing to the iPads (newest publish wins, D7).
import { escapeHtml } from '../../shared/html.js';
import { saveFp, saveSs } from './browser-storage.js';
import { refreshUnavailablePicker, renderPreview } from './email-builder.js';
import { fbDb } from './firebase.js';
import { floorPlanMetaLine, isUnpublished, latestIso, shouldAdoptPublish } from './rules/publish.js';
import { parseFloorPlanRows, parseShowsheetRows } from './rules/showsheet-parse.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { renderUnitList } from './unit-list.js';
import { fpKey } from './units.js';

export function clearShowsheet() {
  if (!confirm('Clear today\'s showsheet from browser memory?')) return;
  state.units = [];
  state.ssMeta = null;
  state.selectedUnits = [];
  localStorage.removeItem('ld_showsheet');
  localStorage.removeItem('ld_ssMeta');
  updateStatus();
  renderUnitList();
  renderPreview();
  toast('Showsheet cleared');
}

// "Last loaded" date formatter — full ISO + relative if recent
function formatLoadedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = diffMs / (1000 * 60 * 60);
  const dateStr = d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
  const timeStr = d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
  if (diffH < 1) return `${Math.max(1, Math.round(diffMs/60000))} min ago`;
  if (diffH < 24) return `today at ${timeStr}`;
  if (diffH < 48) return `yesterday at ${timeStr}`;
  return `${dateStr} at ${timeStr}`;
}
function isStale(iso, hours) {
  if (!iso) return false;
  const diffH = (new Date() - new Date(iso)) / (1000 * 60 * 60);
  return diffH > (hours || 24);
}

export function updateStatus() {
  const ssCard = document.getElementById('ssCard');
  const ssValue = document.getElementById('ssValue');
  const ssMetaEl = document.getElementById('ssMeta');
  const ssClearBtn = document.getElementById('ssClearBtn');
  if (state.units.length) {
    const stale = state.ssMeta && isStale(state.ssMeta.loadedAt, 24), unpub = showsheetUnpublished();
    ssCard.className = stale || unpub ? 'status-card warn' : 'status-card ok';
    ssValue.textContent = `${state.units.length} units loaded`;
    const buildings = new Set(state.units.map(u => u.building));
    const fname = state.ssMeta && state.ssMeta.filename ? state.ssMeta.filename : '';
    const meta = state.ssMeta ? ` · ${formatLoadedAt(state.ssMeta.loadedAt)}${stale ? ' · <strong style="color:var(--red);">over a day old</strong>' : ''}` : '';
    const fnameLine = fname ? `<span class="meta-line" title="${escapeHtml(fname)}">${escapeHtml(fname)}</span>` : '';
    ssMetaEl.innerHTML = `${buildings.size} building${buildings.size===1?'':'s'}${meta}${fnameLine}${publishedLine()}`;
    if (ssClearBtn) ssClearBtn.style.display = 'block';
    const pb = document.getElementById('ssPublishBtn'); if (pb) { pb.style.display = 'block'; pb.classList.toggle('primary', unpub); }
  } else {
    ssCard.className = 'status-card warn';
    ssValue.textContent = 'No showsheet loaded';
    ssMetaEl.textContent = 'Upload the daily Excel file';
    const pb = document.getElementById('ssPublishBtn'); if (pb) pb.style.display = 'none';
    if (ssClearBtn) ssClearBtn.style.display = 'none';
  }

  const fpCard = document.getElementById('fpCard');
  const fpValue = document.getElementById('fpValue');
  const fpMetaEl = document.getElementById('fpMeta');
  const fpClearBtn = document.getElementById('fpClearBtn');
  const count = Object.keys(state.floorPlans).length;
  if (count > 0) {
    fpCard.className = 'status-card ok';
    fpValue.textContent = `${count.toLocaleString()} floor plans saved`;
    if (state.fpMeta) {
      fpMetaEl.textContent = floorPlanMetaLine(state.fpMeta, formatLoadedAt);
    }
    fpClearBtn.style.display = 'block';
  } else {
    fpCard.className = 'status-card warn';
    fpValue.textContent = 'Not loaded';
    fpMetaEl.textContent = 'Upload Floor_Plan_Links.xlsx';
    fpClearBtn.style.display = 'none';
  }
  // Show "Has Floor Plan" filter only when FP data is loaded
  const fpFilterBtn = document.querySelector('.qf-btn[data-filter="hasfp"]');
  if (fpFilterBtn) fpFilterBtn.style.display = count > 0 ? '' : 'none';
}

export function clearFloorPlans() {
  if (!confirm('Clear all saved floor plan links? You will need to re-upload Floor_Plan_Links.xlsx.')) return;
  state.floorPlans = {};
  state.fpMeta = null;
  localStorage.removeItem('ld_floorPlans');
  localStorage.removeItem('ld_fpMeta');
  state.selectedUnits.forEach(s => { if (!s.custom) { s.floorPlan = ''; s.autoLinked = false; } });
  updateStatus();
  renderUnitList();
  renderPreview();
  toast('Floor plan list cleared');
}
let lastPublished = null;   // { publishedAt, publishedBy, unitCount, filename }
// This Desk loaded a showsheet or floor plans after the last publish (newest-wins keeps them here), so the iPads are behind
function showsheetUnpublished() {
  if (!lastPublished) return false;
  let local = '', adopted = '';
  try { local = localStorage.getItem('ld_ssLocalIso') || ''; adopted = localStorage.getItem('ld_ssAdoptedIso') || ''; } catch (e) {}
  return isUnpublished(lastPublished.publishedAt, local, adopted);
}
function publishedLine() {
  if (!lastPublished) return '';
  const when = lastPublished.publishedAt ? formatLoadedAt(lastPublished.publishedAt) : '';
  if (showsheetUnpublished()) return `<span class="meta-line unpub">Not on the iPads yet: they still have the copy published ${when}${lastPublished.publishedBy ? ' by ' + escapeHtml(lastPublished.publishedBy) : ''}.</span>`;
  return `<span class="meta-line pub">Published to iPads ${when}${lastPublished.publishedBy ? ' by ' + escapeHtml(lastPublished.publishedBy) : ''} · ${lastPublished.unitCount} units</span>`;
}
// Every Desk follows the published showsheet live: when anyone publishes, this Desk loads those units and
// floor plan links — unless it already has something newer (a local upload that hasn't been published yet).
export async function loadPublishedMeta() {
  try {
    const db = fbDb(); if (!db) return;
    db.collection('showsheet').doc('current').onSnapshot(snap => {
      if (!snap.exists) return;
      const d = snap.data();
      lastPublished = { publishedAt: d.publishedAtIso, publishedBy: d.publishedBy, unitCount: d.unitCount, filename: d.filename };
      const pub = d.publishedAtIso || '';
      const have = latestIso(localStorage.getItem('ld_ssAdoptedIso') || '', localStorage.getItem('ld_ssLocalIso') || '');
      if (shouldAdoptPublish(pub, have, d.units)) {
        state.adoptingPublish = true;
        try {
          state.units = d.units;
          state.ssMeta = Object.assign({}, state.ssMeta || {}, { filename: d.filename || (state.ssMeta && state.ssMeta.filename) || 'Published showsheet', loadedAt: pub });
          if (Array.isArray(d.floorPlans) && d.floorPlans.length) {
            state.floorPlans = {}; d.floorPlans.forEach(f => { if (f && f.key && f.url) state.floorPlans[f.key] = f.url; });
            state.fpMeta = Object.assign({}, state.fpMeta || {}, { count: d.floorPlans.length, loadedAt: pub });
            saveFp();
          }
          saveSs();
          localStorage.setItem('ld_ssAdoptedIso', pub);
        } finally { state.adoptingPublish = false; }
        renderUnitList(); renderPreview();
        if (have) toast(`Showsheet updated — ${d.publishedBy || 'someone'}'s publish at ${new Date(pub).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
      }
      updateStatus();
    }, err => console.warn('Published showsheet listener failed', err));
  } catch (e) { console.warn('Published meta load failed', e); }
}
export async function publishShowsheet(auto) {
  if (!state.units.length) { if (!auto) toast('Load a showsheet first', true); return; }
  const db = fbDb();
  if (!db) { toast('Firebase failed to load — check connection', true); return; }
  let who = 'Dropbox sync';
  const fpCount = Object.keys(state.floorPlans || {}).length;
  if (!auto) {
    who = localStorage.getItem('ld_publisherName') || '';
    who = prompt('Your name (shown on the iPads as "Published by"):', who);
    if (who === null) return;
    who = who.trim(); localStorage.setItem('ld_publisherName', who);
    if (!confirm(`Publish ${state.units.length} units and ${fpCount} floor plan links to every iPad?\n\nThis replaces what the iPads show right now.`)) return;
  }
  const btn = document.getElementById('ssPublishBtn');
  btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    const fpList = Object.entries(state.floorPlans || {}).map(([key, url]) => ({ key, url: String(url) }));
    const payload = JSON.parse(JSON.stringify({
      units: state.units, floorPlans: fpList,
      unitCount: state.units.length, floorPlanCount: fpList.length,
      filename: state.ssMeta && state.ssMeta.filename || '',
      publishedBy: who,
      publishedAtIso: new Date().toISOString(),
      toolkitBuild: 'Build v1.21'
    }));
    payload.publishedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('showsheet').doc('current').set(payload);
    localStorage.setItem('ld_ssAdoptedIso', payload.publishedAtIso);
    // keep a small history for rollback (last N kept manually in console)
    await db.collection('showsheet_history').doc(payload.publishedAtIso).set(payload);
    lastPublished = { publishedAt: payload.publishedAtIso, publishedBy: who, unitCount: state.units.length, filename: payload.filename };
    updateStatus();
    toast(`Published ${state.units.length} units to the iPads`);
  } catch (e) {
    console.error(e);
    toast('Publish failed: ' + (e.message || e), true);
  } finally {
    btn.disabled = false; btn.textContent = 'Publish to iPads';
  }
}
// A showsheet workbook's rows, plus which rows have the red "app pending" fill on the unit cell (column B, D1)
function readShowsheetWorkbook(data) {
  const wb = XLSX.read(data, { type: 'array', cellStyles: true });
  const ws = wb.Sheets['Inventory'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const redRows = new Set(); const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
    if (cell && cell.s) {
      // SheetJS keeps the fill in fgColor or bgColor, sometimes nested. It returns 6-digit RGB ('FF0000');
      // some writers emit 8-digit ARGB ('FFFF0000'), so strip the alpha byte only when it's there.
      const cands = [cell.s.fgColor, cell.s.bgColor, cell.s.patternColor, cell.s.fill && cell.s.fill.fgColor, cell.s.fill && cell.s.fill.bgColor].filter(Boolean);
      for (const c of cands) { let rgb = (c.rgb || c.argb || '').toUpperCase(); if (rgb.length === 8) rgb = rgb.slice(2); if (rgb === 'FF0000') { redRows.add(R); break; } }
    }
  }
  return { rows, redRows };
}
// The first sheet's rows (the floor plan master)
function readFirstSheetRows(data) {
  const wb = XLSX.read(data, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}
// Units already picked in the Email Builder pick up their floor plan link from the master
function relinkSelectedFloorPlans() {
  state.selectedUnits.forEach(s => { const k = fpKey(s.building, s.unit); if (state.floorPlans[k] && (!s.custom || !s.floorPlan)) { s.floorPlan = state.floorPlans[k]; s.autoLinked = true; } });
}
export function loadShowsheetBuffer(buf, filename) {
  const { rows, redRows } = readShowsheetWorkbook(buf);
  const before = state.units; parseShowsheet(rows, redRows);
  if (!state.units.length) { state.units = before; throw new Error('no units found'); }
  state.ssMeta = { filename, count: state.units.length, loadedAt: new Date().toISOString() };
  saveSs(); renderUnitList(); return state.units.length;
}
export function loadFloorPlanBuffer(buf, filename) {
  const before = state.floorPlans; const result = parseFloorPlanSheet(readFirstSheetRows(buf));
  if (!result.added) { state.floorPlans = before; throw new Error('no floor plan links found'); }
  state.fpMeta = { filename, count: result.added, loadedAt: new Date().toISOString() }; saveFp();
  relinkSelectedFloorPlans();
  renderUnitList(); renderPreview(); return result.added;
}

export function handleShowsheet(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const { rows, redRows } = readShowsheetWorkbook(ev.target.result);
      parseShowsheet(rows, redRows);
      state.ssMeta = { filename: file.name, count: state.units.length, loadedAt: new Date().toISOString() };
      saveSs();
      toast(`Loaded ${state.units.length} units`);
      renderUnitList();
      refreshUnavailablePicker();
    } catch(err) {
      console.error(err);
      toast('Failed to parse showsheet', true);
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';
}


export function handleFloorPlanSheet(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const result = parseFloorPlanSheet(readFirstSheetRows(ev.target.result));
      if (result.added === 0) {
        toast('No valid rows found in Floor_Plan_Links file. Check column headers.', true);
        return;
      }
      state.fpMeta = { filename: file.name, count: result.added, loadedAt: new Date().toISOString() };
      saveFp();
      relinkSelectedFloorPlans();
      renderUnitList();
      renderPreview();
      toast(`Loaded ${result.added.toLocaleString()} floor plans${result.skipped ? ` (${result.skipped} skipped)` : ''}`);
    } catch(err) {
      console.error(err);
      toast('Failed to parse master sheet', true);
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';
}
export function parseShowsheet(rows, redRows) {
  state.units = parseShowsheetRows(rows, redRows);
  updateStatus();
}
export function parseFloorPlanSheet(rows) {
  const { links, added, skipped } = parseFloorPlanRows(rows);
  state.floorPlans = links;
  return { added, skipped };
}
