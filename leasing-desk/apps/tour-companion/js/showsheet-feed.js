// The published showsheet, live from Firestore, and the header status (live / connecting / offline / stale), with reconnecting.
import { CONNECT_GRACE_MS, connectionStatus, reconnectOnReturn } from '../../shared/connection.js';
import { escapeHtml as esc } from '../../shared/html.js';
import { render } from './availability-list.js';
import { FB_CONFIG } from './firebase.js';
import { fmtWhen } from './format.js';
import { watchAssistants } from './staff.js';
import { watchQueue } from './tour-sync.js';
import { $ } from './ui.js';
import { renderPicker } from './unit-picker.js';

const BUILD = 'v1.29';

export let data = null;       // { units, floorPlans:[{key,url}], publishedAtIso, publishedBy, unitCount }
export let fpMap = {};
export let connected = false;
// Opening, coming back on screen and Reconnect start a wait for the database's first answer: "Connecting…" for
// CONNECT_GRACE_MS, then "Offline" (production D44). The library itself stops waiting after 10 seconds.
export const conn = { since: Date.now(), hiddenAt: 0, reconnecting: false };

// ---------- Firestore live feed ----------
export function start() {
  try { const c = localStorage.getItem('showsheet_cache'); if (c) { apply(JSON.parse(c), true); } } catch (e) {}
  firebase.initializeApp(FB_CONFIG);
  const db = firebase.firestore();
  try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}
  db.collection('showsheet').doc('current').onSnapshot(
    { includeMetadataChanges: true },
    snap => {
      connected = !snap.metadata.fromCache;
      if (snap.exists) {
        const d = snap.data();
        delete d.publishedAt;   // server timestamp object; we use publishedAtIso
        apply(d, snap.metadata.fromCache);
        try { localStorage.setItem('showsheet_cache', JSON.stringify(d)); } catch (e) {}
      } else {
        noPublish = true;
        $('list').innerHTML = '<div class="empty">No showsheet has been published yet. Publish one from the Leasing Desk.</div>';
      }
      status();
    },
    err => { console.error(err); connected = false; status('Can\'t reach the showsheet service — showing the last copy on this iPad.'); }
  );
  // Not status itself: it would take the event for a message ("[object Event]" in the banner before production v1.26)
  window.addEventListener('online', () => { conn.since = Date.now(); status(); setTimeout(() => status(), CONNECT_GRACE_MS + 100); });
  window.addEventListener('offline', () => status());
  watchWake(); setTimeout(() => status(), CONNECT_GRACE_MS + 100);
  watchQueue(); watchAssistants();   // who's in, the schedule and the Outlook answers are the Desk's (D20)
  setInterval(status, 60000);
}
function apply(d, fromCache) {
  data = d;
  fpMap = {}; (d.floorPlans || []).forEach(f => { fpMap[f.key] = f.url; });
  render(); renderPicker();
  status();
}
var noPublish = false;
function setBanner(text, off, act) {
  const b = $('banner'); b.textContent = text; b.classList.toggle('show', !!text); b.classList.toggle('is-off', !!off);
  b.classList.toggle('has-act', !!(text && act));
  if (text && act) { const r = document.createElement('button'); r.type = 'button'; r.className = 'btn sec'; r.textContent = 'Reconnect'; r.onclick = () => reconnect(); b.appendChild(r); }
}
export function setFooters() { const f = `Build ${BUILD}` + (data && data.filename ? ` · ${data.filename}` : ''); $('footer').textContent = f; const m = $('footerMore'); if (m) m.textContent = f; }
export function status(msg) {
  const dot = $('dot'), txt = $('liveText');
  const online = navigator.onLine !== false;
  setFooters();
  if (!data) {   // nothing on this iPad yet: never a green "live" dot
    if (!online || msg) { dot.className = 'dot off'; txt.textContent = 'Offline'; setBanner('Offline — no showsheet on this iPad yet. It loads as soon as the iPad is back online.', true); }
    else if (noPublish) { dot.className = 'dot wait'; txt.textContent = 'No showsheet published yet'; setBanner(''); }
    else { dot.className = 'dot wait'; txt.textContent = 'Connecting…'; setBanner(''); }
    return;
  }
  const ageH = (Date.now() - new Date(data.publishedAtIso).getTime()) / 36e5;
  const when = esc(fmtWhen(data.publishedAtIso)), who = data.publishedBy ? ` by ${esc(data.publishedBy)}` : '';
  let cls = 'dot', b = msg || '', off = false;
  // Just opened, back on screen or Reconnect tapped: "Connecting…" while waiting for the first answer, not "Offline"
  const st = connectionStatus({ online, connected, failed: !!msg, since: conn.since });
  if (st.state === 'connecting') { cls += ' wait'; txt.innerHTML = `Connecting… · last copy <strong>${when}</strong>`; }
  else if (st.state === 'offline') { cls += ' off'; off = true; txt.innerHTML = `Offline · last copy <strong>${when}</strong>`; b = b || 'Offline — showing the last showsheet this iPad received. It refreshes on its own when back online.'; }
  else {
    txt.innerHTML = `Published <strong>${when}</strong>${who}`;
    if (ageH > 24) { cls += ' stale'; b = b || `This showsheet was published ${Math.floor(ageH / 24)} day${Math.floor(ageH/24)===1?'':'s'} ago. Check the Leasing Desk for a newer one.`; }
  }
  dot.className = cls; setBanner(b, off, st.reconnect);
}
// Reconnect now (production D44). While an iPad sleeps its database connection drops, and the library then retries on a timer
// that grows to about a minute (up to 90 s); coming back on screen doesn't cut that short. Turning the library's network off
// and on again does: it's what the library does itself when the iPad reports a network change. Saves made meanwhile are queued.
function reconnect() {
  if (conn.reconnecting || !window.firebase || !firebase.apps.length) return;
  const db = firebase.firestore(); if (!db.disableNetwork) return;
  conn.reconnecting = true; connected = false; conn.since = Date.now(); status(); setTimeout(() => status(), CONNECT_GRACE_MS + 100);
  db.disableNetwork().then(() => db.enableNetwork())
    .catch(e => { console.warn('reconnect', e); return db.enableNetwork().catch(() => {}); })   // never leave the network off
    .then(() => { conn.reconnecting = false; });
}
// Back on screen after 30 seconds or more away (locked, or in another app), or from the back-forward cache: reconnect at once
function watchWake() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { conn.hiddenAt = Date.now(); return; }
    if (reconnectOnReturn(conn.hiddenAt)) reconnect();
    conn.hiddenAt = 0;
  });
  window.addEventListener('pageshow', e => { if (e.persisted) reconnect(); });
}
// The search bar sticks right under the header (and building names under the search bar): measure their heights
export function trackStickyHeights() {
  const set = () => { const h = document.querySelector('header'), t = document.querySelector('#pageList .toolbar'), r = document.documentElement.style;
    r.setProperty('--hdr-h', (h ? h.offsetHeight : 53) + 'px'); if (t && t.offsetHeight) r.setProperty('--tb-h', t.offsetHeight + 'px'); };
  set();
  if (window.ResizeObserver) { const ro = new ResizeObserver(set); ro.observe(document.querySelector('header')); const t = document.querySelector('#pageList .toolbar'); if (t) ro.observe(t); }
  else window.addEventListener('resize', set);
}
