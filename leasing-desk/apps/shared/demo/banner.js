// The demo's banner: the data is fictional, and a way to start over. Hides what needs a real server. (No PIN here: the demo's
// PIN box, demo/pin-box.js, fills it in.) On a phone it's two short lines, the label and Reset demo, then the details.
(function () {
  document.write(`<style>
    .demo-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 14px; padding: 7px 14px;
      background: #1f2d3d; color: #fff; font: 600 13px/1.4 Inter, system-ui, sans-serif; position: relative; z-index: 50; }
    .demo-banner span + span { font-weight: 400; opacity: .9; }
    .demo-banner button { font: inherit; padding: 3px 10px; border: 1px solid rgba(255,255,255,.6); border-radius: 6px; background: transparent; color: #fff; cursor: pointer;
      transition: transform 160ms cubic-bezier(.23, 1, .32, 1); }
    .demo-banner button:active { transform: scale(.97); }
    .dbx-line { display: none !important; }
    @media (max-width: 600px) {
      .demo-banner { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 12px; text-align: left;
        padding: 0 max(12px, env(safe-area-inset-right)) 8px max(12px, env(safe-area-inset-left)); }
      .demo-banner span:first-child { grid-area: 1 / 1; align-self: center; }
      .demo-banner span + span { grid-area: 2 / 1 / 3 / 3; font-size: 12px; opacity: .82; }
      /* 44px to tap, a 32px outline to see */
      .demo-banner button { grid-area: 1 / 2; position: relative; min-height: 44px; min-width: 44px; padding: 0 14px; border: none; }
      .demo-banner button::before { content: ""; position: absolute; inset: 6px 0; border: 1px solid rgba(255,255,255,.6); border-radius: 6px; pointer-events: none; }
    }
  </style>`);
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.className = 'demo-banner'; b.setAttribute('role', 'note');
    b.innerHTML = '<span>Demo: fictional data</span><span>Changes last until you reload · Dropbox sync is production-only</span>'
      + '<button type="button">Reset demo</button>';
    b.querySelector('button').onclick = () => { try { localStorage.clear(); } catch (e) {} location.reload(); };
    document.body.prepend(b);
  });
})();
