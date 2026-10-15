// Leasing Desk screen capture — a Playwright CLI run-code function. Run it with tests/desk_capture.sh (fills __ROOT__ / __OUT__).
// Loads the Desk UNMODIFIED from apps/ at https://desk.test/desk/ — the two Firebase CDN scripts are answered with
// apps/shared/demo/fake-firestore.js (+ an empty file); fonts and SheetJS are served from apps/shared; Dropbox / everything else is offline.
// Clock pinned to Tue Oct 6 2026, 2:10 PM New York time so waits, "today" and due dates are the same on every run.
// Every screen is saved at 1440 and 1280 wide. Returns { shots, errors, emails, focus }:
//   emails = the exact Preview & Copy HTML per template (compare before/after byte for byte)
//   focus  = the first tab stops with their computed focus styles
async page => {
  const ROOT = '__ROOT__', OUT = '__OUT__';
  const WIDTHS = [1440, 1280], H = 900;
  const ctx = page.context();
  const errors = [], shots = [], emails = {}, focus = [];
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
    const app = u.match(/^https:\/\/desk\.test\/([^?#]*)/);   // https://desk.test/<path> serves apps/<path>; the Desk is at /desk/
    if (app) return serveApp(route, app[1]);
    if (u.includes('firebase-app-compat')) return route.fulfill({ path: ROOT + '/apps/shared/demo/fake-firestore.js', contentType: 'application/javascript' });
    if (u.includes('firebase-firestore-compat')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    return route.abort();
  });

  async function open(opts) {
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push(`${tag}: console: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
    p.on('dialog', d => d.accept(p.__answer !== undefined ? p.__answer : d.defaultValue()).catch(() => {}));
    await p.addInitScript(o => { window.__SEED_OPTS = o; try { localStorage.clear(); if (!o.firstVisit) localStorage.setItem('ld_tourSeen', '1'); } catch (e) {} }, opts);
    await p.setViewportSize({ width: WIDTHS[0], height: H });
    await p.goto('https://desk.test/desk/');
    await p.waitForTimeout(700);
    return p;
  }
  // A hidden toast is parked just below the viewport; tall element shots would otherwise capture it (screenshot-only CSS)
  const TOAST_PARKED = '.toast:not(.show){visibility:hidden !important}';
  const settle = p => p.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 5000 }).catch(() => {});
  const scrollTo = (p, sel, off) => p.evaluate(([s, o]) => { const el = document.querySelector(s); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o); }, [sel, off || 16]);
  async function shot(p, name, target, keepToast) {
    if (!keepToast) await settle(p);
    for (const w of WIDTHS) {
      await p.setViewportSize({ width: w, height: H });
      await p.waitForTimeout(180);
      const o = { path: `${OUT}/${name}@${w}.png`, animations: 'disabled', style: TOAST_PARKED };
      try {
        if (target === 'full') await p.screenshot(Object.assign(o, { fullPage: true }));
        else if (!target || target === 'viewport') await p.screenshot(o);
        else await p.locator(target).first().screenshot(o);
        shots.push(`${name}@${w}`);
      } catch (e) { errors.push(`${tag}: screenshot ${name}@${w} failed: ${e.message.split('\n')[0]}`); }
    }
    await p.setViewportSize({ width: WIDTHS[0], height: H });
  }
  const openQueue = p => p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } }).then(() => p.waitForTimeout(250));
  const tab = async (p, label) => { await p.click(`#queueTabs button:has-text("${label}")`); await p.waitForTimeout(350); };

  // ===== A. A normal Tuesday afternoon: showsheet loaded, Dropbox sync off =====
  tag = 'A';
  let p = await open({ seedLocal: true });
  await shot(p, '01-page-top', 'viewport');
  await shot(p, '02-page-full', 'full');
  await shot(p, '03-status-cards-dbx-off', '.status-strip');
  await openQueue(p);
  await shot(p, '04-queue-current', '#queuePanel');
  for (let guard = 0; guard < 6; guard++) { const open = p.locator('.wp-toggle', { hasText: 'Hide wait estimate' }); if (await open.count() <= 1) break; await open.nth(1).click(); await p.waitForTimeout(120); }
  await shot(p, '05-queue-current-one-panel-open', '#queuePanel');
  await tab(p, 'Follow'); await shot(p, '06-queue-followups', '#queuePanel');
  await tab(p, 'Leasing Manager Check-In'); await shot(p, '07-queue-checkin', '#queuePanel');
  await tab(p, 'Future Move-Ins'); await shot(p, '08-queue-future', '#queuePanel');
  await p.click('#queueBody button:has-text("+ Add future lead")'); await p.waitForTimeout(150);
  await shot(p, '09-queue-future-add-form', '#queuePanel');
  await p.click('#queueBody .fl-form button:has-text("Cancel")');
  await tab(p, 'Rotation'); await shot(p, '10-queue-rotation', '#queuePanel');
  await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); (await imp('js/state.js')).state.trainingUnlocked = true; renderTourQueue(); });
  await shot(p, '11-queue-rotation-unlocked', '#queuePanel');
  await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); (await imp('js/state.js')).state.trainingUnlocked = false; renderTourQueue(); });
  await tab(p, 'History'); await p.waitForTimeout(300); await shot(p, '12-queue-history', '#queuePanel');
  await p.locator('#queueBody button:has-text("Details")').first().click(); await p.waitForTimeout(100);
  await shot(p, '13-queue-history-details', '#queuePanel');
  // History search: does the box keep focus while typing?
  const hs = p.locator('#queueBody input[placeholder^="Search prospect"]');
  await hs.click(); await p.keyboard.type('Om', { delay: 60 });
  focus.push({ check: 'history-search-after-typing-Om', value: await hs.inputValue().catch(() => '?'), activeIsSearch: await p.evaluate(() => !!(document.activeElement && /^Search prospect/.test(document.activeElement.placeholder || ''))) });
  await tab(p, 'Current Queue');

  // Plan Tour modal
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(150);
  focus.push({ check: 'plan-tour-initial-focus', value: await p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)) });
  await shot(p, '14-plan-tour', 'viewport');
  await p.check('#planBroker'); await p.waitForTimeout(80);
  await shot(p, '15-plan-tour-broker', 'viewport');
  await p.click('#planKindInsp'); await p.waitForTimeout(80);
  await shot(p, '16-plan-inspection', 'viewport');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  focus.push({ check: 'plan-modal-closes-on-escape', value: await p.evaluate(() => !document.getElementById('planModal').classList.contains('show')) });
  await p.click('#planModal button:has-text("Cancel")').catch(() => {});

  // Dropbox Settings (sync off)
  await p.click('#dbxLine .link-btn'); await p.waitForTimeout(120);
  await shot(p, '17-dropbox-settings-off', 'viewport');
  await p.click('#dbxModal button:has-text("Cancel")');

  // Training Quiz Results (PIN gate bypassed in-page; no PIN typed)
  await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); (await imp('js/state.js')).state.trainingUnlocked = true; await toggleTraining(); }); await p.waitForTimeout(250);
  await shot(p, '18-training-results', '#trainingPanel');
  await p.locator('#trainingBody button:has-text("Details")').nth(1).click(); await p.waitForTimeout(100);
  await shot(p, '19-training-results-details', '#trainingPanel');
  await p.evaluate(() => lockManager());

  // Email Builder — Tour follow-up with two showsheet units
  await p.selectOption('#greeting', 'Good afternoon');
  await p.fill('#prospectName', 'Karen');
  await p.click('.unit-row[data-key="2050 TIDEMARK BLVD::1812"] .unit-info');
  await p.click('.unit-row[data-key="2110 TIDEMARK BLVD::2305"] .unit-info');
  await p.waitForTimeout(600);
  await scrollTo(p, '.grid');
  await shot(p, '20-email-tour-viewport', 'viewport');
  await shot(p, '21-email-tour', '.grid');
  // + custom unit
  await p.click('button:has-text("+ Add Custom Unit")'); await p.waitForTimeout(600);
  const ed = p.locator('.inline-editor').last();
  await ed.locator('select').nth(0).selectOption('2230 TIDEMARK BLVD');
  await ed.locator('input[type=text]').nth(0).fill('1203');
  await ed.locator('select').nth(1).selectOption('1 Bed, 1 Bath');
  await ed.locator('input[type=text]').nth(1).fill('702');
  await ed.locator('select').nth(2).selectOption('Tidemark Harbor');
  await ed.locator('input[type=text]').nth(2).fill('3950');
  await p.waitForTimeout(200);
  await shot(p, '22-email-custom-unit', '.grid');
  await scrollTo(p, '.custom-row', 120);
  await shot(p, '23-email-custom-unit-viewport', 'viewport');
  // Unit no longer available
  await p.check('#unavailableToggle'); await p.selectOption('#unavailablePick', '2050 TIDEMARK BLVD::2203'); await p.waitForTimeout(150);
  await scrollTo(p, '.grid');
  await shot(p, '24-email-unavailable-viewport', 'viewport');
  await p.uncheck('#unavailableToggle');
  // Inquiry
  await p.click('#modeInquiryBtn'); await p.waitForTimeout(200);
  await shot(p, '25-email-inquiry', '.grid');
  // Welcome
  await p.click('#modeWelcomeBtn'); await p.selectOption('#welcomeBuilding', '2230'); await p.fill('#prospectName', 'Sarah'); await p.waitForTimeout(150);
  await shot(p, '26-email-welcome', '.grid');
  // PFA step 1 and step 2
  await p.click('#modePfaBtn'); await p.click('#pfaSubInfoBtn'); await p.waitForTimeout(150);
  await shot(p, '27-email-pfa-info', '.grid');
  await p.click('#pfaSubSignedBtn'); await p.selectOption('#pfaLounge', '2230'); await p.fill('#pfaSignedDate', '2026-10-05'); await p.fill('#pfaHours', '3'); await p.waitForTimeout(150);
  await shot(p, '28-email-pfa-signed', '.grid');
  // Application Confirmation
  await p.click('#modeAppConfBtn'); await p.fill('#prospectName', 'Medina'); await p.selectOption('#appConfBuilding', '2050 Tidemark Blvd');
  await p.fill('#appConfUnit', '1812'); await p.fill('#appConfRent', '4150'); await p.fill('#appConfMoveIn', '11012026'); await p.press('#appConfMoveIn', 'Tab');
  await p.fill('#appConfDeadline', 'tomorrow 10:00 AM'); await p.check('#appConfIncentiveToggle'); await p.fill('#appConfIncentive', '1 month free (applied to December 2026)');
  await p.check('#appConfFloorPlanToggle'); await p.waitForTimeout(150);
  await shot(p, '29-email-appconf', '.grid');
  // Lease Approval
  await p.click('#modeApprovalBtn'); await p.selectOption('#apvBuilding', '2110 Tidemark Blvd'); await p.fill('#apvUnit', '2305'); await p.fill('#apvRent', '6150');
  await p.fill('#apvLeaseStart', '11152026'); await p.press('#apvLeaseStart', 'Tab'); await p.fill('#apvLeaseEnd', '11142027'); await p.press('#apvLeaseEnd', 'Tab');
  await p.check('#apvNextRentToggle'); await p.selectOption('#apvConcFrac', '1'); await p.waitForTimeout(150);
  await shot(p, '30-email-approval', '.grid');
  // Picking-units mode (Plan tour → Send to queue & pick units now)
  await p.click('#modeTourBtn'); await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(150);
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(150);
  await p.fill('#planFirst', 'Karen'); await p.fill('#planProspect', 'M');
  await p.check('#planBeds input[value="1 Bed"]'); await p.fill('#planMin', '3800'); await p.fill('#planMax', '4500');
  await p.click('#planSubmitPick'); await p.waitForTimeout(900);
  await p.click('.unit-row[data-key="2050 TIDEMARK BLVD::1812"] .unit-info'); await p.waitForTimeout(600);
  await scrollTo(p, '#planStrip', 8);
  await shot(p, '31-email-picking-viewport', 'viewport');
  await shot(p, '32-email-picking', '.grid');
  await p.click('#planStrip button:has-text("✕")');
  // Help, template editor, guided tour
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('header button:has-text("Help")'); await p.waitForTimeout(120); await shot(p, '33-help', 'viewport');
  await p.click('#helpModal button:has-text("Close")');
  await p.click('header button:has-text("Edit Email Template")'); await p.waitForTimeout(120); await shot(p, '34-template-editor', 'viewport');
  await p.click('#templateModal button:has-text("Close")');
  // Keyboard: first 40 tab stops from the top of the page, with their focus styling
  await p.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
  for (let i = 1; i <= 40; i++) {
    await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el);
      return { tag: el.tagName.toLowerCase(), text: (el.innerText || el.value || el.placeholder || el.id || '').trim().replace(/\s+/g, ' ').slice(0, 40), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, shadow: cs.boxShadow, border: cs.borderColor, bg: cs.backgroundColor }; });
    focus.push(Object.assign({ stop: i }, f));
    if (i === 3) await shot(p, '35-keyboard-focus-header', 'viewport');
  }
  // Toasts: an error (Start with no units) and a success (Mark Sent)
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate(() => queueStart('t-elena')); await p.waitForTimeout(350);   // a waiting tour with no units yet
  await shot(p, '36-toast-error', 'viewport', true);
  await settle(p);
  await tab(p, 'Follow');
  await p.locator('#queueBody button:has-text("Mark Sent")').first().click(); await p.waitForTimeout(350);
  await shot(p, '37-toast-success', 'viewport', true);
  await p.close();

  // ===== B. Dropbox sync on =====
  tag = 'B';
  p = await open({ seedLocal: true, dbx: true });
  await shot(p, '40-page-top-dbx-on', 'viewport');
  await shot(p, '41-status-cards-dbx-on', '.status-strip');
  await p.click('#dbxLine .link-btn'); await p.waitForTimeout(120);
  await shot(p, '42-dropbox-settings-on', 'viewport');
  await p.close();

  // ===== C. Empty / brand-new Desk (no showsheet, no tours) + true first visit =====
  tag = 'C';
  p = await open({ empty: true });
  await shot(p, '50-empty-page-top', 'viewport');
  await openQueue(p);
  await shot(p, '51-empty-queue', '#queuePanel');
  await tab(p, 'Follow'); await shot(p, '52-empty-followups', '#queuePanel');
  await tab(p, 'Future Move-Ins'); await shot(p, '53-empty-future', '#queuePanel');
  await tab(p, 'History'); await p.waitForTimeout(300); await shot(p, '54-empty-history', '#queuePanel');
  await shot(p, '55-empty-email-builder', '.grid');
  await p.close();
  p = await open({ empty: true, firstVisit: true }); await p.waitForTimeout(1200);
  await shot(p, '56-first-visit-guided-tour', 'viewport');
  await p.close();

  // ===== D. Firebase unreachable =====
  tag = 'D';
  p = await open({ seedLocal: true, offline: true });
  await openQueue(p);
  await shot(p, '60-offline-page-top', 'viewport');
  await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); (await imp('js/state.js')).state.trainingUnlocked = true; await toggleTraining(); }); await p.waitForTimeout(250);
  await shot(p, '61-offline-training', '#trainingPanel');
  await p.close();

  // ===== E. Exact Preview & Copy HTML for every template (fresh page, fixed inputs) =====
  tag = 'E';
  p = await open({ seedLocal: true });
  const grab = async key => { await p.waitForTimeout(80); emails[key] = await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); return (await imp('js/email-builder.js')).buildEmailHTML(); }); };
  await p.selectOption('#greeting', 'Good afternoon'); await p.fill('#prospectName', 'Karen');
  await grab('tour-empty');
  await p.click('.unit-row[data-key="2050 TIDEMARK BLVD::1812"] .unit-info');
  await p.click('.unit-row[data-key="2110 TIDEMARK BLVD::2305"] .unit-info');
  await p.click('.unit-row[data-key="2230 TIDEMARK BLVD::4201"] .unit-info');
  await p.check('#incParking'); await p.check('#incShuttle');
  await grab('tour-3-units-parking-shuttle');
  await p.uncheck('#incParking'); await p.uncheck('#incShuttle');
  await p.click('button:has-text("+ Add Custom Unit")'); await p.waitForTimeout(400);
  const ce = p.locator('.inline-editor').last();
  await ce.locator('select').nth(0).selectOption('2230 TIDEMARK BLVD'); await ce.locator('input[type=text]').nth(0).fill('1203');
  await ce.locator('select').nth(1).selectOption('1 Bed, 1 Bath'); await ce.locator('input[type=text]').nth(2).fill('3950');
  await ce.locator('input[type=text]').nth(5).fill('1 month free OR 1 Mo. OP');
  await grab('tour-with-custom-unit');
  await p.check('#unavailableToggle'); await p.selectOption('#unavailablePick', '2050 TIDEMARK BLVD::2203');
  await grab('tour-unavailable');
  await p.uncheck('#unavailableToggle');
  await p.click('#modeInquiryBtn'); await grab('inquiry');
  for (const b of ['2040', '2050', '2110', '2120', '2230']) { await p.click('#modeWelcomeBtn'); await p.selectOption('#welcomeBuilding', b); await p.fill('#prospectName', 'Sarah'); await grab('welcome-' + b); }
  await p.click('#modePfaBtn'); await p.click('#pfaSubInfoBtn'); await grab('pfa-info');
  await p.click('#pfaSubSignedBtn'); await p.selectOption('#pfaLounge', '2230'); await p.fill('#pfaSignedDate', '2026-10-05'); await p.fill('#pfaHours', '3'); await grab('pfa-signed');
  await p.click('#modeAppConfBtn'); await p.fill('#prospectName', 'Medina'); await p.selectOption('#appConfBuilding', '2050 Tidemark Blvd');
  await p.fill('#appConfUnit', '1812'); await p.fill('#appConfRent', '4150'); await p.fill('#appConfMoveIn', '11012026'); await p.press('#appConfMoveIn', 'Tab');
  await p.fill('#appConfDeadline', 'tomorrow 10:00 AM'); await grab('appconf-basic');
  await p.check('#appConfIncentiveToggle'); await p.fill('#appConfIncentive', '1 month free (applied to December 2026)'); await p.check('#appConfFloorPlanToggle'); await p.check('#appConfStudent');
  await grab('appconf-incentive-floorplan-student');
  await p.click('#modeApprovalBtn'); await p.selectOption('#apvBuilding', '2110 Tidemark Blvd'); await p.fill('#apvUnit', '2305'); await p.fill('#apvRent', '6150');
  await p.fill('#apvLeaseStart', '11152026'); await p.press('#apvLeaseStart', 'Tab'); await p.fill('#apvLeaseEnd', '11142027'); await p.press('#apvLeaseEnd', 'Tab');
  await grab('approval-basic');
  await p.check('#apvNextRentToggle'); await p.selectOption('#apvConcFrac', '1'); await p.check('#apvCheckToggle'); await grab('approval-nextrent-check');
  emails['checkin'] = await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); const q = await imp('js/queue.js'); return q.checkInHtml(q.queueRows.find(r => r.id === 't-omar')); });
  emails['headsup'] = await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); const q = await imp('js/queue.js'); return q.headsUpHtml(q.queueRows.find(r => r.id === 't-daniel')); });
  await p.close();

  return { shots: shots.length, errors, emails, focus };
}
