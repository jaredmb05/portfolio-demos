// Seasons on the Desk (production D47, D50). Dates and the treats are in apps/shared/seasons.js (`seasonNow`); staff only, never in
// emails, printouts or the database. Each one switches itself on and off by date (an open Desk re-checks every 10 minutes).
// - Halloween 2026, Oct 24–31: the 🎃 after "Leasing Desk" (CSS, from body.halloween) and one small bat across the top once a day.
// - Nov 1 until the Monday after Thanksgiving: a small turkey after the title that steps every few seconds (stands still with
//   reduced motion).
// - From that Monday to Mar 31: snow falling over the title area the whole time the Desk is on screen, at most 16 flakes; the ❄
//   after the title pauses it and starts it again, remembered on this computer (ld_snowOff). None with reduced motion or on a phone.
// The treats (🍬 / 🍭, 🦃, ❄️) go at the end of the Finish / Mark sent / check-in sent messages (queue.js).
import { prefersReducedMotion } from '../../shared/dom.js';
import { halloweenOn, seasonNow, watchSeasons } from '../../shared/seasons.js';

// The bat: once a day per computer (ld_batDay), only while the Desk is on screen and never with reduced motion. It flies
// for 7 seconds, can't be clicked, and is removed when its animation ends (hidden in print).
export function batFlyby() {
  if (!halloweenOn() || prefersReducedMotion() || document.visibilityState !== 'visible') return;
  const day = new Date().toDateString();
  try { if (localStorage.getItem('ld_batDay') === day) return; localStorage.setItem('ld_batDay', day); } catch (e) { return; }
  const b = document.createElement('div'); b.className = 'hw-bat'; b.setAttribute('aria-hidden', 'true'); b.textContent = '🦇';
  b.addEventListener('animationend', () => b.remove()); document.body.appendChild(b);
}

const TURKEY_SVG = '<svg viewBox="0 0 48 44" aria-hidden="true"><g class="turkey-walk">' +
  '<path d="M24 30 L6 12 A20 20 0 0 1 14 5Z" fill="#a8432a"/><path d="M24 30 L14 5 A20 20 0 0 1 24 3Z" fill="#c8742a"/><path d="M24 30 L24 3 A20 20 0 0 1 34 5Z" fill="#d4a63a"/>' +
  '<path d="M24 30 L34 5 A20 20 0 0 1 42 12Z" fill="#c8742a"/><path d="M24 30 L42 12 A20 20 0 0 1 45 22Z" fill="#a8432a"/><path d="M24 30 L3 22 A20 20 0 0 1 6 12Z" fill="#d4a63a"/>' +
  '<ellipse cx="24" cy="30" rx="10" ry="9" fill="#7a4a24"/><circle cx="24" cy="19" r="5" fill="#8a5a30"/><circle cx="22.5" cy="18" r="1" fill="#1a1a2e"/><circle cx="25.5" cy="18" r="1" fill="#1a1a2e"/>' +
  '<path d="M24 20 l2 1.5 -2 1z" fill="#d4a63a"/><path d="M24 22 q-1.5 3 0 4.5 q1.5 -1.5 0 -4.5z" fill="#b8322a"/><path d="M21 38 v4 M27 38 v4" stroke="#b8923a" stroke-width="1.6" stroke-linecap="round"/></g></svg>';
const SEASON_CLASSES = ['halloween', 'thanksgiving', 'snow'];
const FLAKE_MS = 450, MAX_FLAKES = 16;
let snowTimer = null;
function snowOff() { try { return localStorage.getItem('ld_snowOff') === '1'; } catch (e) { return false; } }
// The same test as the phone layer in styles.css (production D40)
function onPhone() { return !!(window.matchMedia && window.matchMedia('screen and (max-width: 600px), screen and (pointer: coarse) and (max-height: 500px)').matches); }

// Today's season on the page: the body class, the turkey or the ❄ button after the title, and the snow timer
export function applySeason() {
  const s = seasonNow(), h1 = document.querySelector('header h1'); if (!h1) return;
  SEASON_CLASSES.forEach(k => document.body.classList.toggle(k, s === k));
  const art = h1.querySelector('.season-art'), btn = h1.querySelector('.snow-toggle');
  if (s === 'thanksgiving' && !art) h1.insertAdjacentHTML('beforeend', `<span class="season-art" aria-hidden="true">${TURKEY_SVG}</span>`);
  if (s !== 'thanksgiving' && art) art.remove();
  if (s === 'snow' && !btn) h1.insertAdjacentHTML('beforeend', '<button class="snow-toggle" type="button" onclick="toggleSnow()">❄</button>');
  if (s !== 'snow' && btn) btn.remove();
  renderSnowToggle();
  if (s === 'snow' && !snowTimer) snowTimer = setInterval(snowFlake, FLAKE_MS);
  if (s !== 'snow' && snowTimer) { clearInterval(snowTimer); snowTimer = null; document.querySelectorAll('.season-snow').forEach(e => e.remove()); }
}
function renderSnowToggle() {
  const b = document.querySelector('.snow-toggle'); if (!b) return;
  const off = snowOff(); b.classList.toggle('is-off', off);
  b.title = off ? 'Let it snow' : 'Pause the snow'; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', String(!off));
}
// The ❄ button: pause the snow (the flakes already falling go at once) or let it snow again; this computer remembers
export function toggleSnow() {
  try { localStorage.setItem('ld_snowOff', snowOff() ? '0' : '1'); } catch (e) {}
  if (snowOff()) document.querySelectorAll('.season-snow i').forEach(f => f.remove());
  renderSnowToggle();
}
// One flake per tick, at most 16 at a time, only while the Desk is on screen; each one removes itself when it has fallen
function snowFlake() {
  if (snowOff() || prefersReducedMotion() || onPhone() || document.visibilityState !== 'visible') return;
  const hd = document.querySelector('header'); if (!hd) return;
  let box = hd.querySelector('.season-snow');
  if (!box) { box = document.createElement('div'); box.className = 'season-snow'; box.setAttribute('aria-hidden', 'true'); hd.appendChild(box); }
  if (box.childElementCount >= MAX_FLAKES) return;
  const f = document.createElement('i'); f.textContent = '❄';
  f.style.left = (Math.random() * 100).toFixed(1) + '%'; f.style.fontSize = (8 + Math.random() * 8).toFixed(0) + 'px';
  f.style.setProperty('--drift', (Math.random() * 60 - 30).toFixed(0) + 'px'); f.style.animationDuration = (6 + Math.random() * 4).toFixed(1) + 's';
  f.addEventListener('animationend', () => f.remove()); box.appendChild(f);
}

// On at load, re-checked every 10 minutes (so an open Desk changes season at midnight); the bat a few seconds in
export function startSeasons() { watchSeasons(batFlyby, applySeason); setTimeout(batFlyby, 6000); }
