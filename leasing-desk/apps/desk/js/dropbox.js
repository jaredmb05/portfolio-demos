// Dropbox sync: every Desk checks the shared showsheet and floor plan links every 5 minutes and publishes when a file changes.
import { fbDb } from './firebase.js';
import { loadFloorPlanBuffer, loadShowsheetBuffer, publishShowsheet } from './showsheet.js';
import { toast } from './ui.js';

// ===== Dropbox sync: the showsheet + floor plan master are read straight from Dropbox shared links =====
// Links are shared by every Desk (Firestore settings/dropboxSync). Any open Desk checks every 5 minutes; a file is
// reloaded and published only when its contents changed (SHA-256), so Desks don't republish the same file.
let dbxCfg = {}; let dbxBusy = false; let dbxLastCheck = '';
function dbxCandidates(url) {
  const out = [];
  try {
    const u = new URL(String(url).trim());
    if (/dropbox\.com$/.test(u.hostname)) {
      const p = new URLSearchParams(u.search); p.delete('dl'); p.delete('raw'); p.delete('st');
      const q = p.toString();
      out.push(`https://dl.dropboxusercontent.com${u.pathname}${q ? '?' + q : ''}`);
      p.set('dl', '1'); out.push(`https://www.dropbox.com${u.pathname}?${p.toString()}`);
      p.delete('dl'); p.set('raw', '1'); out.push(`https://www.dropbox.com${u.pathname}?${p.toString()}`);
    } else out.push(u.toString());
  } catch (e) {}
  return out;
}
async function dbxFetch(url) {
  const errs = [];
  for (const c of dbxCandidates(url)) {
    try {
      const res = await fetch(c, { cache: 'no-store' });
      if (!res.ok) { errs.push(`${res.status}`); continue; }
      const ct = res.headers.get('content-type') || '';
      if (/text\/html/.test(ct)) { errs.push('login page'); continue; }
      return { buf: await res.arrayBuffer() };
    } catch (e) { errs.push('blocked'); }
  }
  const why = errs.includes('blocked') ? 'blocked' : errs.includes('login page') || errs.some(x => /^40[13]$/.test(x)) ? 'private' : 'failed';
  throw Object.assign(new Error(why), { why });
}
async function dbxHash(buf) { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
const dbxName = url => { try { return decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'Dropbox file'; } catch (e) { return 'Dropbox file'; } };
export async function dbxSync(manual) {
  if (dbxBusy || !(dbxCfg.showsheetUrl || dbxCfg.floorplanUrl)) return;
  dbxBusy = true; renderDbxLine();
  const db = fbDb(); const patch = {}; let changed = false; const notes = [];
  try {
    for (const [kind, urlKey, hashKey] of [['showsheet', 'showsheetUrl', 'ssHash'], ['floorplans', 'floorplanUrl', 'fpHash']]) {
      const url = dbxCfg[urlKey]; if (!url) continue;
      try {
        const { buf } = await dbxFetch(url); const h = await dbxHash(buf);
        if (h === dbxCfg[hashKey] && !manual) continue;
        if (h === dbxCfg[hashKey] && manual) { notes.push(`${kind === 'showsheet' ? 'Showsheet' : 'Floor plans'} unchanged`); continue; }
        const n = kind === 'showsheet' ? loadShowsheetBuffer(buf, dbxName(url)) : loadFloorPlanBuffer(buf, dbxName(url));
        patch[hashKey] = h; changed = true; notes.push(kind === 'showsheet' ? `${n} units` : `${n} floor plans`);
      } catch (e) { notes.push(`${kind === 'showsheet' ? 'Showsheet' : 'Floor plans'}: ${e.why === 'blocked' ? 'Dropbox blocked the download' : e.why === 'private' ? 'link is not public' : e.message}`); }
    }
    if (changed) await publishShowsheet(true);
    dbxLastCheck = new Date().toISOString();
    if (db) await db.collection('settings').doc('dropboxSync').set(Object.assign(patch, { lastCheckIso: dbxLastCheck }, changed ? { lastSyncIso: dbxLastCheck } : {}), { merge: true });
    if (manual || changed) toast(changed ? `Synced from Dropbox — ${notes.join(', ')}` : notes.some(n => /unchanged/.test(n)) && !notes.some(n => /blocked|public|found/.test(n)) ? 'No changes found in Dropbox yet. If you just edited, reload the file in Dropbox so it saves, then click Sync now again.' : (notes.join(' · ') || 'Nothing to sync'), notes.some(n => /blocked|public|found/.test(n)));
  } finally { dbxBusy = false; renderDbxLine(); }
}
function renderDbxLine() {
  // While Dropbox sync is on, Dropbox is the only way in: manual upload / publish / clear are hidden
  document.body.classList.toggle('dbx-ss-on', !!dbxCfg.showsheetUrl);
  document.body.classList.toggle('dbx-fp-on', !!dbxCfg.floorplanUrl);
  const sb = document.getElementById('dbxSyncBtn'); if (sb) { sb.disabled = dbxBusy; sb.textContent = dbxBusy ? 'Syncing…' : 'Sync now'; }
  const fm = document.getElementById('fpDbxNote'); if (fm) fm.innerHTML = dbxCfg.floorplanUrl ? 'Synced from Dropbox — edit the master file there, then Sync now on the showsheet card.' : '';
  const off = document.getElementById('dbxOffBtn'); if (off) off.style.display = (dbxCfg.showsheetUrl || dbxCfg.floorplanUrl) ? '' : 'none';
  const el = document.getElementById('dbxLine'); if (!el) return;
  const on = !!(dbxCfg.showsheetUrl || dbxCfg.floorplanUrl);
  const t = iso => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';
  el.innerHTML = on
    ? `Dropbox · last change ${t(dbxCfg.lastSyncIso)} · checked ${t(dbxLastCheck || dbxCfg.lastCheckIso)}${dbxBusy ? ' · <em>syncing…</em>' : ''} · <button class="link-btn" onclick="openDbxSettings()">Settings</button>`
    : `Dropbox sync is off · <button class="link-btn" onclick="openDbxSettings()">Set up</button>`;
}
export function openDbxSettings() {
  document.getElementById('dbxSs').value = dbxCfg.showsheetUrl || ''; document.getElementById('dbxFp').value = dbxCfg.floorplanUrl || '';
  document.getElementById('dbxSsTest').textContent = ''; document.getElementById('dbxFpTest').textContent = '';
  const off = document.getElementById('dbxOffBtn'); if (off) off.style.display = (dbxCfg.showsheetUrl || dbxCfg.floorplanUrl) ? '' : 'none';
  document.getElementById('dbxModal').classList.add('show');
}
// One click instead of emptying both boxes (same result as saving with both links blank)
export function turnOffDbx() {
  if (!confirm('Turn off Dropbox sync? Upload, Publish and Clear come back on both cards, and you load files by hand until it is set up again.')) return;
  document.getElementById('dbxSs').value = ''; document.getElementById('dbxFp').value = '';
  saveDbxSettings();
}
export async function testDbx(which) {
  const inp = document.getElementById(which === 'ss' ? 'dbxSs' : 'dbxFp'), out = document.getElementById(which === 'ss' ? 'dbxSsTest' : 'dbxFpTest');
  const url = inp.value.trim(); if (!url) { out.textContent = 'Paste a link first.'; return; }
  out.style.color = 'var(--ink-soft)'; out.textContent = 'Testing…';
  try {
    const { buf } = await dbxFetch(url);
    const wb = XLSX.read(buf, { type: 'array' }); const ws = wb.Sheets['Inventory'] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    out.style.color = 'var(--green)'; out.textContent = `✓ Works (direct) — read ${rows.length} rows from "${dbxName(url)}".`;
  } catch (e) {
    out.style.color = 'var(--red)';
    out.textContent = e.why === 'blocked' ? '✗ Dropbox blocked the browser from downloading it directly.'
      : e.why === 'private' ? '✗ The link is not public. In Dropbox: Share → link settings → "Anyone with the link".'
      : `✗ Couldn't read it as a spreadsheet (${e.message}).`;
  }
}
export async function saveDbxSettings() {
  const db = fbDb(); if (!db) { toast('Firebase not loaded', true); return; }
  const ss = document.getElementById('dbxSs').value.trim(), fp = document.getElementById('dbxFp').value.trim();
  try {
    await db.collection('settings').doc('dropboxSync').set({ showsheetUrl: ss, floorplanUrl: fp, ssHash: ss === dbxCfg.showsheetUrl ? (dbxCfg.ssHash || '') : '', fpHash: fp === dbxCfg.floorplanUrl ? (dbxCfg.fpHash || '') : '', updatedAtIso: new Date().toISOString() }, { merge: true });
    document.getElementById('dbxModal').classList.remove('show'); toast(ss || fp ? 'Dropbox sync saved — checking now' : 'Dropbox sync turned off');
    setTimeout(() => dbxSync(true), 500);
  } catch (e) { toast('Could not save: ' + (e.message || e), true); }
}
export function watchDropboxSync() {
  const db = fbDb(); if (!db) return;
  db.collection('settings').doc('dropboxSync').onSnapshot(snap => { dbxCfg = (snap.exists && snap.data()) || {}; renderDbxLine(); }, err => console.warn('dropboxSync', err));
  setInterval(() => { if (document.visibilityState === 'visible') dbxSync(false); }, 5 * 60 * 1000);
  setTimeout(() => dbxSync(false), 8000);
}
