// The demo's banner: the data is fictional, the manager PIN, and a way to start over. Hides what needs a real server.
(function () {
  document.write(`<style>
    .demo-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 14px; padding: 7px 14px;
      background: #1f2d3d; color: #fff; font: 600 13px/1.4 Inter, system-ui, sans-serif; position: relative; z-index: 50; }
    .demo-banner span + span { font-weight: 400; opacity: .9; }
    .demo-banner button { font: inherit; padding: 3px 10px; border: 1px solid rgba(255,255,255,.6); border-radius: 6px; background: transparent; color: #fff; cursor: pointer; }
    .dbx-line { display: none !important; }
  </style>`);
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.className = 'demo-banner'; b.setAttribute('role', 'note');
    b.innerHTML = '<span>Demo: fictional data</span><span>Changes last until you reload · Manager PIN 1234 · Dropbox sync is production-only</span>'
      + '<button type="button">Reset demo</button>';
    b.querySelector('button').onclick = () => { try { localStorage.clear(); } catch (e) {} location.reload(); };
    document.body.prepend(b);
  });
})();
