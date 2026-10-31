// Live / Offline indicator: the same states and words as the iPad header.
import { fbDb } from './firebase.js';
import { queueRows } from './queue.js';

// ===== Live / offline — the same states and words as the iPad's header dot =====
export var deskConn = { state: 'connecting', liveAt: null, queueDown: false };
// No tours loaded and no connection: the wait estimate and "next up" would be made up, so they show a dash instead
export function queueUnknown() { return !queueRows.length && (deskConn.queueDown || deskConn.state === 'off' || navigator.onLine === false); }
export function setConn(state) { if (state === 'live') deskConn.liveAt = new Date().toISOString(); deskConn.state = state; renderConn(); }
export function renderConn() {
  const pill = document.getElementById('connPill'); if (!pill) return;
  const off = deskConn.state === 'off' || navigator.onLine === false;
  const t = deskConn.liveAt ? new Date(deskConn.liveAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  pill.className = 'conn' + (off ? ' off' : deskConn.state === 'live' ? ' live' : '');
  pill.textContent = off ? 'Offline' : deskConn.state === 'live' ? 'Live' : 'Connecting…';
  const ban = document.getElementById('connBanner');
  if (ban) { ban.textContent = off ? (t ? `Offline — showing what this Desk last received at ${t}. It refreshes on its own when the connection is back.` : 'Offline — the queue can’t load until the connection is back.') : ''; ban.classList.toggle('show', off); }
  const asof = document.getElementById('waitAsOf'); if (asof) asof.textContent = off ? (t ? `as of ${t}` : 'not available offline') : '';
}
export function watchConnection() {
  const db = fbDb(); if (!db) return;
  // A listener used only for connection state (Firestore shares this document's read with loadPublishedMeta)
  try { db.collection('showsheet').doc('current').onSnapshot({ includeMetadataChanges: true }, snap => setConn(snap && snap.metadata && snap.metadata.fromCache ? 'off' : 'live'), () => setConn('off')); } catch (e) {}
  window.addEventListener('online', renderConn); window.addEventListener('offline', () => setConn('off'));
}
