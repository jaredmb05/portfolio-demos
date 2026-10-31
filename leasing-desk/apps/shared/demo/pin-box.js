// The demo's PIN box: a visitor doesn't know the manager PIN, so in the in-browser demo every PIN question opens this box,
// types the demo PIN in and presses OK by itself. Outside the demo the apps ask with the browser's own prompt (askPin in
// shared/dom.js). Resolves with what was "typed", or null when the visitor presses Cancel first.
(function () {
  document.write(`<style>
    .demo-pin { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;
      background: rgba(20, 28, 38, .45); font: 400 14px/1.4 Inter, system-ui, sans-serif;
      opacity: 0; transition: opacity 120ms ease-out; }
    .demo-pin.in { opacity: 1; transition-duration: 160ms; }
    .demo-pin-card { width: 100%; max-width: 340px; padding: 20px; border-radius: 12px; background: #fff; color: #1f2d3d;
      box-shadow: 0 12px 40px rgba(0, 0, 0, .25); transform: scale(.96); transition: transform 200ms cubic-bezier(.23, 1, .32, 1); }
    .demo-pin.in .demo-pin-card { transform: none; }
    .demo-pin-card h2 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
    .demo-pin-card p { margin: 0 0 12px; color: #4a5868; font-size: 13px; }
    .demo-pin-card input { box-sizing: border-box; width: 100%; height: 44px; padding: 0 12px; border: 1px solid #9aa6b2; border-radius: 8px;
      font: 600 20px/1 Inter, system-ui, sans-serif; letter-spacing: .3em; color: #1f2d3d; background: #f6f8fa; }
    .demo-pin-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .demo-pin-btns button { min-width: 72px; height: 44px; padding: 0 16px; border-radius: 8px; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer;
      transition: transform 160ms cubic-bezier(.23, 1, .32, 1), background-color 160ms ease-out; }
    .demo-pin-btns button:active { transform: scale(.97); }
    .demo-pin-cancel { border: 1px solid #9aa6b2; background: #fff; color: #1f2d3d; }
    .demo-pin-ok { border: 1px solid #1f2d3d; background: #1f2d3d; color: #fff; }
    .demo-pin-ok.pressed { transform: scale(.97); background: #3b4f66; }
    @media (prefers-reduced-motion: reduce) { .demo-pin-card, .demo-pin-btns button { transform: none !important; } }
  </style>`);
  const PIN = (window.APP_CONFIG && window.APP_CONFIG.managerPin) || '';
  window.demoPin = function (label) {
    return new Promise(resolve => {
      const quick = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const box = document.createElement('div');
      box.className = 'demo-pin';
      box.innerHTML = '<div class="demo-pin-card" role="dialog" aria-modal="true" aria-labelledby="demoPinTitle" aria-describedby="demoPinNote">'
        + '<h2 id="demoPinTitle"></h2><p id="demoPinNote">Demo: the PIN is filled in for you.</p>'
        + '<input id="demoPinInput" type="text" readonly aria-labelledby="demoPinTitle" autocomplete="off">'
        + '<div class="demo-pin-btns"><button type="button" class="demo-pin-cancel">Cancel</button><button type="button" class="demo-pin-ok">OK</button></div></div>';
      box.querySelector('h2').textContent = String(label || 'PIN').replace(/:\s*$/, '');
      const input = box.querySelector('input'), ok = box.querySelector('.demo-pin-ok');
      const timers = [];
      // Answers at once; the box fades out a beat faster than it came in, then goes
      const done = v => { timers.forEach(clearTimeout); box.classList.remove('in'); box.style.pointerEvents = 'none'; setTimeout(() => box.remove(), 140); resolve(v); };
      box.querySelector('.demo-pin-cancel').onclick = () => done(null);
      ok.onclick = () => done(PIN);
      document.body.appendChild(box);
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('in')));
      ok.focus();
      const step = quick ? 0 : 180;
      if (quick) input.value = PIN;
      else [...PIN].forEach((c, i) => timers.push(setTimeout(() => { input.value += c; }, 300 + step * i)));
      const at = quick ? 500 : 300 + step * PIN.length + 250;
      timers.push(setTimeout(() => ok.classList.add('pressed'), at));
      timers.push(setTimeout(() => done(PIN), at + 200));
    });
  };
})();
