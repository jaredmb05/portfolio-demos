// Tour Companion (iPad) app screen capture — a Playwright CLI run-code function. Run it with tests/ipad_capture.sh (fills __ROOT__ / __OUT__).
// Loads Tour Companion UNMODIFIED from apps/ at https://ipad.test/tour-companion/ in WebKit (Safari's engine) with iPad touch emulation.
// Firebase is answered with apps/shared/demo/fake-firestore.js, the service worker is blocked (so no stale shell), everything else offline.
// Clock pinned to Tue Oct 6 2026, 2:10 PM New York time. Every screen at 820×1180 (portrait) and 1180×820 (landscape).
// Returns { shots, errors, targets, contrast }:
//   targets  = tappable things smaller than 44×44 pt, per screen
//   contrast = text/background pairs below WCAG AA, per screen
async page => {
  const ROOT = '__ROOT__', OUT = '__OUT__';
  const SIZES = [{ w: 820, h: 1180 }, { w: 1180, h: 820 }];
  const ctx = page.context();
  const errors = [], shots = [], targets = {}, contrast = {};
  let tag = '';
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  // Files under apps/, with the test config in place of the generated config.js
  const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css', webmanifest: 'application/manifest+json', png: 'image/png' };
  const serveApp = (route, p) => {
    if (p === '' || p.endsWith('/')) p += 'index.html';
    if (p === 'shared/config.js') return route.fulfill({ path: ROOT + '/tests/config.test.js', contentType: TYPES.js });
    return route.fulfill({ path: ROOT + '/apps/' + p, contentType: TYPES[p.split('.').pop()] }).catch(() => route.fulfill({ status: 404, body: '' }));
  };
  await ctx.route('**/*', route => {
    const u = route.request().url();
    const m = u.match(/^https:\/\/ipad\.test\/([^?#]*)/);   // https://ipad.test/<path> serves apps/<path>; the app is at /tour-companion/
    if (m) return m[1] === 'tour-companion/sw.js' ? route.abort() : serveApp(route, m[1]);
    if (u.includes('firebase-app-compat')) return route.fulfill({ path: ROOT + '/apps/shared/demo/fake-firestore.js', contentType: 'application/javascript' });
    if (u.includes('firebase-firestore-compat')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    return route.abort();
  });

  async function open(opts) {
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`${tag}: console: ${m.text().split('\n')[0]}`); });
    p.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
    p.on('dialog', d => d.accept(p.__answer !== undefined ? p.__answer : d.defaultValue()).catch(() => {}));
    await p.addInitScript(o => { window.__SEED_OPTS = o; try { localStorage.clear(); } catch (e) {} }, opts);
    await p.setViewportSize({ width: SIZES[0].w, height: SIZES[0].h });
    await p.goto('https://ipad.test/tour-companion/');
    await p.waitForTimeout(800);
    return p;
  }
  async function shot(p, name, full) {
    for (const s of SIZES) {
      await p.setViewportSize({ width: s.w, height: s.h });
      await p.waitForTimeout(220);
      try { await p.screenshot({ path: `${OUT}/${name}@${s.w}.png`, fullPage: !!full, animations: 'disabled', scale: 'css' }); shots.push(`${name}@${s.w}`); }
      catch (e) { errors.push(`${tag}: screenshot ${name}@${s.w} failed: ${e.message.split('\n')[0]}`); }
    }
    await p.setViewportSize({ width: SIZES[0].w, height: SIZES[0].h });
  }
  // Tappable elements under 44×44 (visible ones only), and text below AA contrast — measured in portrait
  const measure = async (p, screen) => {
    const r = await p.evaluate(() => {
      const small = [];
      document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [onclick]').forEach(el => {
        const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return;
        if (el.closest('[style*="display: none"], [style*="display:none"]')) return;
        if (b.width < 44 || b.height < 44) small.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} "${(el.innerText || el.value || el.placeholder || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 28)}" ${Math.round(b.width)}×${Math.round(b.height)}`);
      });
      const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const blend = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const bgOf = el => { const st = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let bg = { r: 243, g: 239, b: 230, a: 1 }; for (let i = st.length - 1; i >= 0; i--) bg = blend(st[i], bg); return bg; };
      const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      const bad = {};
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        const t = n.textContent.trim(); if (t.length < 2) continue; const el = n.parentElement; if (!el) continue;
        const bx = el.getBoundingClientRect(); if (!bx.width || !bx.height) continue;
        const cs = getComputedStyle(el); let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
        const fg0 = parse(cs.color), bg = bgOf(el); const fg = blend(Object.assign({}, fg0, { a: fg0.a * op }), bg);
        const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold);
        const cr = ratio(fg, bg); if (cr >= (large ? 3 : 4.5)) continue;
        const k = `${cr.toFixed(2)}:1 ${hex(fg)} on ${hex(bg)} · ${size}px`; bad[k] = bad[k] || []; if (bad[k].length < 2 && !bad[k].includes(t.slice(0, 40))) bad[k].push(t.slice(0, 40));
      }
      return { small, bad: Object.entries(bad).map(([k, v]) => `${k} — ${v.join(' | ')}`) };
    });
    targets[screen] = r.small; contrast[screen] = r.bad;
  };
  const tabTo = async (p, id) => { await p.click('#tab-' + id); await p.waitForTimeout(300); };

  // ===== A. A normal Tuesday afternoon (live) =====
  tag = 'A';
  let p = await open({});
  await shot(p, 'i01-availability-top');
  await measure(p, 'availability');
  await shot(p, 'i02-availability-full', true);
  await p.click('#chips .chip:has-text("2 Bed")'); await p.waitForTimeout(150);
  await shot(p, 'i03-availability-2bed');
  await p.click('#chips .chip:has-text("All")');
  await p.fill('#search', 'penthouse'); await p.waitForTimeout(150);
  await shot(p, 'i04-availability-no-match');
  await p.fill('#search', '');

  await tabTo(p, 'tour');
  await shot(p, 'i10-tour-home');
  await measure(p, 'tour-home');
  await shot(p, 'i11-tour-home-full', true);

  // New tour: empty guest card, then filled with a broker
  await p.click('button:has-text("New tour")'); await p.waitForTimeout(250);
  await shot(p, 'i12-new-tour');
  await p.fill('#tFirst', 'Karen'); await p.fill('#tProspect', 'M'); await p.fill('#tEmail', 'karen@example.com');
  await p.check('#tBroker'); await p.waitForTimeout(100); await p.fill('#tBrokerLast', 'Cohen');
  await p.click('#needBeds .chip:has-text("1 Bed")'); await p.fill('#needMin', '3800'); await p.fill('#needMax', '4500');
  await p.waitForTimeout(1100);   // autosave settles ("Saved 2:10 PM")
  await shot(p, 'i13-new-tour-filled');
  await measure(p, 'guest-card');
  // Assistant list (manager) — PIN gate bypassed in-page; no PIN typed
  await p.evaluate(() => { managerUnlocked = true; });
  await p.selectOption('#tAssistant', '__manage__'); await p.waitForTimeout(150);
  await shot(p, 'i14-assistant-list');
  await p.click('#assistantManage button:has-text("Done")');
  // Pick units
  await p.click('#guestDoneBtn'); await p.waitForTimeout(400);
  await p.click('#pickChips .chip:has-text("Fits needs")'); await p.waitForTimeout(150);
  await shot(p, 'i15-picker-fits-needs');
  await p.locator('#pickerList .pick', { hasText: '#1812' }).first().click(); await p.waitForTimeout(450);
  await p.locator('#pickerList .pick', { hasText: '#906' }).first().click(); await p.waitForTimeout(450);
  await p.evaluate(() => { const el = document.querySelector('.pick-added'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140); });
  await shot(p, 'i16-picker-units-open');
  await measure(p, 'picker');
  await shot(p, 'i17-active-tour-full', true);
  // Start with no assistant → validation message
  await p.evaluate(() => startTour()); await p.waitForTimeout(250);
  await shot(p, 'i18-start-without-assistant');
  // Custom unit form
  await p.click('#customBtn'); await p.waitForTimeout(150);
  await p.evaluate(() => { const el = document.getElementById('customForm'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200); });
  await shot(p, 'i19-custom-unit-form');
  await p.click('#customForm button:has-text("Cancel")');
  // Bottom of the active tour: building cards, talking points, sticky action bar
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(150);
  await shot(p, 'i20-tour-bottom');
  // Start the tour with an assistant → summary
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate(() => toggleGuest(true)); await p.waitForTimeout(100);
  await p.selectOption('#tAssistant', 'Rosa'); await p.waitForTimeout(150);
  await p.click('#tStart'); await p.waitForTimeout(600);
  await shot(p, 'i21-tour-started-summary');
  await measure(p, 'summary');
  await shot(p, 'i22-tour-started-full', true);
  await p.click('#tourFooter button:has-text("Back to tours")'); await p.waitForTimeout(300);
  await shot(p, 'i23-tour-home-after-start');
  // New inspection → started one-line bar
  await p.click('button:has-text("New inspection")'); await p.waitForTimeout(250);
  await shot(p, 'i24-new-inspection');
  await p.fill('#tFirst', 'Ruth'); await p.fill('#tProspect', 'K'); await p.selectOption('#insBldg', '2110 TIDEMARK BLVD'); await p.fill('#insUnit', '1201');
  await p.selectOption('#tAssistant', 'Tariq'); await p.waitForTimeout(150);
  await p.click('#tStart'); await p.waitForTimeout(600);
  await shot(p, 'i25-inspection-started');
  await p.click('#tourFooter button:has-text("Back to tours")'); await p.waitForTimeout(300);
  // Open a waiting tour from Today's tours
  await p.locator('#tourList .tourrow', { hasText: 'Daniel R.' }).locator('button:has-text("Open")').click(); await p.waitForTimeout(400);
  await shot(p, 'i26-open-waiting-tour');
  await p.click('#tourFooter button:has-text("Back to tours")'); await p.waitForTimeout(300);

  // Requirements
  await tabTo(p, 'req');
  await shot(p, 'i30-requirements');
  await measure(p, 'requirements');
  await p.click('.req button:has-text("Self-employed")'); await p.waitForTimeout(120);
  await shot(p, 'i31-requirements-self-employed', true);

  // More: menu, calculator, cheat sheet, quiz
  await tabTo(p, 'more');
  await shot(p, 'i40-more');
  await p.click('.more-item:has-text("Net Rent Calculator")'); await p.fill('#cRent', '4150'); await p.waitForTimeout(150);
  await shot(p, 'i41-calculator');
  await measure(p, 'calculator');
  await p.click('#moreCalc .back-link, #moreCalc button:has-text("Back to More")');
  await p.click('.more-item:has-text("Building Cheat Sheet")'); await p.waitForTimeout(200);
  await shot(p, 'i42-cheat-sheet');
  await shot(p, 'i43-cheat-sheet-full', true);
  await p.click('#moreCheat .back-link, #moreCheat button:has-text("Back to More")');
  await p.click('.more-item:has-text("Training Quiz")'); await p.waitForTimeout(150);
  await shot(p, 'i44-quiz-intro');
  await p.selectOption('#quizNameSel', 'Rosa'); await p.click('#quizIntro button:has-text("Begin")'); await p.waitForTimeout(200);
  await shot(p, 'i45-quiz-question');
  await measure(p, 'quiz');
  await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); const quiz = await imp('js/quiz.js'); while (quiz.quizActive) answerQuiz(Math.floor(Math.random() * 1.6)); }); await p.waitForTimeout(400);
  await shot(p, 'i46-quiz-result');
  await shot(p, 'i47-quiz-result-full', true);
  await p.close();

  // ===== B. Showsheet published two days ago (stale) =====
  tag = 'B';
  p = await open({ stale: true });
  await shot(p, 'i50-stale-showsheet');
  await p.close();

  // ===== C. Offline with the last showsheet cached on the iPad, and offline on first launch =====
  tag = 'C';
  p = await open({ offline: true, ipadCache: true });
  await shot(p, 'i51-offline-availability');
  await tabTo(p, 'tour');
  await shot(p, 'i52-offline-tour-home');
  await p.close();
  p = await open({ offline: true });
  await shot(p, 'i53-offline-first-launch');
  await p.close();

  // ===== D. Nothing published, no tours yet =====
  tag = 'D';
  p = await open({ empty: true });
  await shot(p, 'i54-empty-availability');
  await tabTo(p, 'tour');
  await shot(p, 'i55-empty-tour-home');
  await p.close();

  return { shots: shots.length, errors, targets, contrast };
}
