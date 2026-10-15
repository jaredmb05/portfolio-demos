// The published showsheet, live from Firestore, and the header status (live / offline / stale).
import { escapeHtml as esc } from '../../shared/html.js';
import { render } from './availability-list.js';
import { FB_CONFIG } from './firebase.js';
import { fmtWhen } from './format.js';
import { watchAssistants } from './staff.js';
import { watchQueue } from './tour-sync.js';
import { $ } from './ui.js';
import { renderPicker } from './unit-picker.js';

const BUILD = 'v1.19';

export let data = null;       // { units, floorPlans:[{key,url}], publishedAtIso, publishedBy, unitCount }
export let fpMap = {};
export let connected = false;

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
  window.addEventListener('online', status); window.addEventListener('offline', status);
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
function setBanner(text, off) { const b = $('banner'); b.textContent = text; b.classList.toggle('show', !!text); b.classList.toggle('is-off', !!off); }
export function setFooters() { const f = `Build ${BUILD}` + (data && data.filename ? ` · ${data.filename}` : ''); $('footer').textContent = f; const m = $('footerMore'); if (m) m.textContent = f; }
function status(msg) {
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
  if (!online || !connected) { cls += ' off'; off = true; txt.innerHTML = `Offline · last copy <strong>${when}</strong>`; b = b || 'Offline — showing the last showsheet this iPad received. It refreshes on its own when back online.'; }
  else {
    txt.innerHTML = `Published <strong>${when}</strong>${who}`;
    if (ageH > 24) { cls += ' stale'; b = b || `This showsheet was published ${Math.floor(ageH / 24)} day${Math.floor(ageH/24)===1?'':'s'} ago. Check the Leasing Desk for a newer one.`; }
  }
  dot.className = cls; setBanner(b, off);
}
// The search bar sticks right under the header (and building names under the search bar): measure their heights
export function trackStickyHeights() {
  const set = () => { const h = document.querySelector('header'), t = document.querySelector('#pageList .toolbar'), r = document.documentElement.style;
    r.setProperty('--hdr-h', (h ? h.offsetHeight : 53) + 'px'); if (t && t.offsetHeight) r.setProperty('--tb-h', t.offsetHeight + 'px'); };
  set();
  if (window.ResizeObserver) { const ro = new ResizeObserver(set); ro.observe(document.querySelector('header')); const t = document.querySelector('#pageList .toolbar'); if (t) ro.observe(t); }
  else window.addEventListener('resize', set);
}
