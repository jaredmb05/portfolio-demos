// Loads what each app needs before its modules run.
// Normal use: the config written from .env (scripts/write-config.mjs) and the Firebase SDK.
// With ?demo in the URL: the in-browser demo instead. A fake Firestore seeded with fictional data (demo/fake-firestore.js),
// a built-in config and a banner; no network, no .env, nothing saved anywhere. document.write keeps it all in order,
// before the page's modules run.
(function () {
  const shared = document.currentScript.src.replace(/boot\.js(\?.*)?$/, '');
  const add = src => document.write(`<script src="${src}"><\/script>`);
  if (/[?&]demo\b/.test(location.search)) {
    window.APP_CONFIG = {
      demo: true, managerPin: '1234',
      firebase: { apiKey: 'demo', authDomain: 'demo.invalid', projectId: 'demo', storageBucket: 'demo.invalid', messagingSenderId: '0', appId: 'demo' },
    };
    window.__SEED_OPTS = { demo: true };
    add(shared + 'demo/fake-firestore.js');
    add(shared + 'demo/banner.js');
  } else {
    add(shared + 'config.js');
    add('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    add('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
  }
})();
