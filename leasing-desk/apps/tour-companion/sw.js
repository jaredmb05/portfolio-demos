// Tour Companion — service worker
// Caches the app shell so the iPad opens even with no signal. Data (showsheet, tours) comes from Firestore,
// which keeps its own offline copy. Bump CACHE whenever any shell file changes so old shells are dropped.
const CACHE = 'tour-companion-v1.19';
// Every file the page loads: the HTML, styles, config, and each module main.js imports (directly or not).
// Keep it in step with the modules main.js loads; a module missing here breaks offline start.
const SHELL = ['./', './index.html', './styles.css', '../shared/tokens.css', '../shared/boot.js', '../shared/config.js',
  '../shared/fonts/fonts.css', '../shared/fonts/inter-latin.woff2', '../shared/fonts/inter-latin-ext.woff2',
  '../shared/fonts/fraunces-latin.woff2', '../shared/fonts/fraunces-latin-ext.woff2',
  './js/availability-list.js', './js/buildings.js', './js/calculator.js', './js/cheat-sheet.js', './js/firebase.js', './js/format.js',
  './js/main.js', './js/navigation.js', './js/quiz.js', './js/requirements.js', './js/showsheet-feed.js',
  './js/staff.js', './js/state.js', './js/todays-tours.js', './js/tour-planner.js', './js/tour-summary.js', './js/tour-sync.js',
  './js/ui.js', './js/unit-picker.js',
  '../shared/dates.js', '../shared/dom.js', '../shared/format.js', '../shared/html.js',
  '../shared/pricing.js', '../shared/requirements.js', '../shared/team.js', '../shared/unit-options.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const fromNetwork = req => fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase and Dropbox: straight to the network
  // Page loads: network first so a new deploy shows up immediately; fall back to the cached shell offline
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(fromNetwork(req).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // Code and styles: network first too, so a new page never runs against old cached modules
  if (/\.(js|css)$/.test(url.pathname)) {
    e.respondWith(fromNetwork(req).catch(() => caches.match(req)));
    return;
  }
  // Icons / manifest: cache first
  e.respondWith(caches.match(req).then(r => r || fromNetwork(req)));
});
