// The in-browser demo as a visitor sees it — a Playwright CLI run-code function. Run it with tests/demo_check.sh.
// The demo is served by a plain static server at __BASE__ (no npm, no .env). Every request outside __BASE__ is blocked
// and recorded, so the check also proves the demo needs no network. Real clock and time zone, fresh browser.
// Returns { passed, failed, steps: [{ step, ok, detail }], errors, blocked }.
async page => {
  const BASE = '__BASE__';
  const ctx = page.context();
  const errors = [], steps = [], blocked = [];
  let tag = '';
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx.route('**/*', route => { const u = route.request().url(); if (u.startsWith(BASE)) return route.continue(); blocked.push(u); return route.abort(); });
  const check = (step, ok, detail) => steps.push({ step, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  const open = async (path, viewport) => {
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push(`${tag}: console: ${m.text().split('\n')[0]}`); });
    p.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
    p.on('dialog', d => (p.__answer !== undefined && d.type() === 'prompt' ? d.accept(p.__answer) : d.dismiss()).catch(() => {}));   // p.__answer: what to type into a prompt
    await p.setViewportSize(viewport);
    await p.goto(BASE + path); await p.waitForTimeout(1500);
    return p;
  };
  const text = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel).then(t => t.replace(/\s+/g, ' ').trim());

  // ===== Leasing Desk =====
  tag = 'desk';
  let p = await open('desk/demo/', { width: 1440, height: 900 });
  check('Desk: desk/demo/ opens the Desk in demo mode', /\/desk\/\?demo$/.test(p.url()), p.url());
  check('Desk: the "Demo: fictional data" banner shows', /Demo: fictional data/.test(await text(p, '.demo-banner')), await text(p, '.demo-banner'));
  await p.evaluate(() => { if (typeof endTour === 'function') endTour(); });   // first visit opens the guided tour
  await p.waitForTimeout(300);
  check('Desk: the showsheet is loaded from the published demo copy', await p.locator('.unit-row').count() >= 10, (await p.locator('.unit-row').count()) + ' unit rows');
  await p.evaluate(() => document.getElementById('queuePanel').classList.add('open')); await p.evaluate(() => setQueueTab('queue')); await p.waitForTimeout(300);
  const queue = await text(p, '#queueBody');
  check('Desk: the Tour Queue shows the seeded tours (waiting and on tour)', /Waiting/i.test(queue) && /On tour now/i.test(queue), queue.slice(0, 160));
  check('Desk: a wait estimate shows', /Estimated wait|Can start now|min/.test(queue) && await p.locator('#queueBody .wp, #queueBody .wp-toggle').count() > 0, queue.match(/Estimated wait[^·]{0,60}/)?.[0] || 'none');
  await p.evaluate(() => setQueueTab('followup')); await p.waitForTimeout(300);
  await p.locator('#queueBody .queue-row button:has-text("Open")').first().click(); await p.waitForTimeout(800);
  const email = await text(p, '#preview');
  check('Desk: opening a finished tour builds its follow-up email', /Thank you for touring/.test(email) && /Concession:/.test(email), email.slice(0, 160));

  // Missing fields must never print as "undefined": not in the status cards, the unit list or the email preview
  const undefinedOnPage = () => p.evaluate(() => (document.body.innerText.match(/.{0,50}\bundefined\b.{0,30}/gi) || []).join(' | '));
  const pick = async key => { await p.click(`.unit-row[data-key="${key}"] .unit-info`); await p.waitForTimeout(400); };
  // A fresh Desk takes its floor plan links from the publish, which carries no file name: show when, nothing invented
  const fpLine = await text(p, '#fpMeta');
  check('Desk: Floor Plan Links taken from a publish (no file name) shows only when, never "undefined"', /^(\d+ min ago|today at .+|yesterday at .+|\w{3} \d+ at .+)$/.test(fpLine) && !/undefined|xlsx/i.test(fpLine), fpLine);
  // A seeded unit with no floor plan link: listed with its rent and a "No floor plan" flag; in the email, the placeholder
  const noFp = '2050 TIDEMARK BLVD::2203';
  const noFpRow = await text(p, `.unit-row[data-key="${noFp}"]`);
  await pick(noFp);
  const noFpMail = await text(p, '#preview'), noFpHits = await undefinedOnPage();
  check('Desk: a unit with no floor plan link renders correctly (flagged in the list, placeholder in the email)',
    /\$4,495/.test(noFpRow) && /No floor plan/.test(noFpRow) && /#2203/.test(noFpMail) && /Floor plan link missing/i.test(noFpMail) && !noFpHits, noFpHits || noFpRow.slice(0, 120));
  // Someone publishes a showsheet with a unit that has only a building, a number and a rent
  await p.evaluate(async () => {
    const ref = firebase.firestore().collection('showsheet').doc('current');
    const d = (await ref.get()).data();
    const units = d.units.concat({ building: '2040 TIDEMARK BLVD', bedroomGroup: 'STUDIOS', unit: '905', monthly: 3100 });
    await ref.set({ units, floorPlans: d.floorPlans, unitCount: units.length, floorPlanCount: d.floorPlans.length, publishedAtIso: new Date().toISOString(), publishedBy: 'Alex' });
  });
  await p.waitForTimeout(800);
  const bareListed = await p.locator('.unit-row[data-key="2040 TIDEMARK BLVD::905"]').count() === 1;
  if (bareListed) await pick('2040 TIDEMARK BLVD::905');
  const bareHits = await undefinedOnPage();
  check('Desk: a published unit with only a building, number and rent shows no "undefined" (status cards, unit list, email)', bareListed && !bareHits && /#905/.test(await text(p, '#preview')), bareListed ? bareHits || 'none' : 'unit #905 not listed');
  // Reports (production Desk v1.28–v1.31), with six weeks of invented tours behind it. A visitor doesn't know the manager
  // PIN: the demo's PIN box types it in and presses OK by itself (no browser prompt)
  const dialogs = []; p.on('dialog', d => dialogs.push(d.type()));
  await p.click('#reportsToggle');
  const pinBox = await p.waitForSelector('.demo-pin', { timeout: 3000 }).then(() => true, () => false);
  await p.waitForFunction(() => (document.getElementById('demoPinInput') || {}).value === '1234', null, { timeout: 3000 }).catch(() => {});
  const pinTyped = await p.evaluate(() => (document.getElementById('demoPinInput') || {}).value || '');
  const pinGone = await p.waitForSelector('.demo-pin', { state: 'detached', timeout: 4000 }).then(() => true, () => false);
  await p.waitForTimeout(1500);
  check('Desk: Reports asks for the manager PIN in a box that fills in 1234 and presses OK by itself (no browser prompt)', pinBox && pinTyped === '1234' && pinGone && !dialogs.length && await p.locator('#reportsPanel.open').count() === 1,
    `box ${pinBox}, typed "${pinTyped}", closed ${pinGone}, prompts ${dialogs.length}`);
  const kpis = await p.evaluate(() => [...document.querySelectorAll('#reportsBody .rpt-kpi')].map(k => [k.querySelector('.rpt-kpi-l').textContent.trim(), k.querySelector('.rpt-kpi-v').textContent.trim()]));
  check('Desk: Reports opens with the demo PIN 1234 and shows its six numbers, each with a value', kpis.length === 6 && kpis.every(([, v]) => /^\d[\d,]*%?$|^\d+ min$|^\d+ h( \d+ min)?$/.test(v)) && +kpis[0][1].replace(/,/g, '') > 20 && await p.locator('#reportsBody svg.viz').count() >= 6,
    kpis.map(k => k.join(': ')).join(' · '));
  await p.close();

  // ===== Tour Companion (iPad) =====
  tag = 'ipad';
  p = await open('tour-companion/demo/', { width: 1180, height: 820 });
  check('iPad: tour-companion/demo/ opens the app in demo mode', /\/tour-companion\/\?demo$/.test(p.url()), p.url());
  check('iPad: the "Demo: fictional data" banner shows', /Demo: fictional data/.test(await text(p, '.demo-banner')));
  check('iPad: Availability lists the published demo units', await p.locator('.unit:visible').count() >= 10, (await p.locator('.unit:visible').count()) + ' units');
  const live = await text(p, '.live'), banner = await text(p, '#banner.show');
  check('iPad: the header shows the live showsheet ("Published …"), not "Connecting…" or "Offline", and no banner', /^Published /.test(live) && !banner, `${live}${banner ? ' · banner: ' + banner : ''}`);
  await p.click('#tab-tour'); await p.waitForTimeout(400);
  check('iPad: Today\'s tours shows the seeded tours', await p.locator('#tourList .tourrow').count() >= 3, (await p.locator('#tourList .tourrow').count()) + ' tours');
  await p.click('#tab-more'); await p.waitForTimeout(300);
  await p.click('.more-item:has-text("Training Quiz")'); await p.waitForTimeout(300);
  await p.selectOption('#quizNameSel', { index: 1 }); await p.click('#quizIntro button:has-text("Begin")'); await p.waitForTimeout(300);
  check('iPad: the training quiz starts', /Question 1 of 30/.test(await text(p, '#quizRun')), (await text(p, '#quizRun')).slice(0, 80));
  // Leaving the quiz early needs the PIN: the demo's box fills it in, and the quiz closes
  await p.click('#quizRun button:has-text("Exit quiz")');
  const quizPin = await p.waitForSelector('.demo-pin', { timeout: 3000 }).then(() => true, () => false);
  await p.waitForSelector('.demo-pin', { state: 'detached', timeout: 4000 }).catch(() => {}); await p.waitForTimeout(300);
  check('iPad: Exit quiz fills in the PIN by itself and closes the quiz', quizPin && await p.locator('#quizRun').isHidden() && await p.locator('#quizIntro').isVisible(), `box ${quizPin}`);
  await p.close();

  // ===== On a phone (390 × 844, touch): both demo links, as a visitor who taps through them gets them =====
  tag = 'phone';
  const phone = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await phone.route('**/*', route => { const u = route.request().url(); if (u.startsWith(BASE)) return route.continue(); blocked.push(u); return route.abort(); });
  const onPhone = async path => {
    const q = await phone.newPage();
    q.on('console', m => { if (m.type() === 'error') errors.push(`${tag}: console: ${m.text().split('\n')[0]}`); });
    q.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
    q.on('dialog', d => { errors.push(`${tag}: a browser ${d.type()} opened: ${d.message()}`); d.dismiss().catch(() => {}); });
    await q.goto(BASE + path); await q.waitForTimeout(1500);
    return q;
  };
  p = await onPhone('desk/demo/');
  const bannerH = Math.round(await p.evaluate(() => document.querySelector('.demo-banner').getBoundingClientRect().height));
  check('Phone: the demo banner is two short lines (Reset demo beside the label)', bannerH <= 90, bannerH + 'px tall');
  // The guided tour opens on a first visit. Each step: the card whole on screen, the highlighted part above it, a tap on Next
  const off = [];
  for (let i = 1; i <= 7; i++) {
    const shown = await p.waitForFunction(() => !document.getElementById('tourCard').classList.contains('tour-hidden'), null, { timeout: 4000 }).then(() => true, () => false);
    if (!shown) { off.push(`step ${i}: the card never showed`); break; }
    await p.waitForTimeout(300);   // its fade-in
    const g = await p.evaluate(() => {
      const c = document.getElementById('tourCard').getBoundingClientRect(), ring = document.getElementById('tourHighlightRect');
      return { top: c.top, bottom: c.bottom, left: c.left, right: c.right, ringY: +ring.getAttribute('y'), ringH: +ring.getAttribute('height'), vw: innerWidth, vh: innerHeight };
    });
    if (g.top < 0 || g.left < 0 || g.bottom > g.vh || g.right > g.vw) off.push(`step ${i}: card at ${Math.round(g.top)}–${Math.round(g.bottom)} of ${g.vh}`);
    if (g.ringH > 0 && (g.ringY < -20 || g.ringY > g.top - 40)) off.push(`step ${i}: highlight starts at ${Math.round(g.ringY)}, the card at ${Math.round(g.top)}`);
    await p.locator('#tourNext').tap();
  }
  await p.waitForTimeout(300);
  check('Phone: the guided tour\'s card is whole on screen at every step, with the highlighted part above it, and Next / Done take a tap', !off.length && !(await p.locator('#tourOverlay.active').count()), off.join(' | '));
  check('Phone: the Desk is no wider than the phone', await p.evaluate(() => document.documentElement.scrollWidth) <= 390, await p.evaluate(() => document.documentElement.scrollWidth) + 'px');
  await p.locator('#reportsToggle').scrollIntoViewIfNeeded(); await p.locator('#reportsToggle').tap();
  const phonePin = await p.waitForSelector('.demo-pin', { timeout: 3000 }).then(() => true, () => false);
  await p.waitForSelector('.demo-pin', { state: 'detached', timeout: 4000 }).catch(() => {}); await p.waitForTimeout(800);
  check('Phone: a tap on Reports fills in the PIN by itself and opens Reports', phonePin && await p.locator('#reportsPanel.open').count() === 1, `box ${phonePin}`);
  await p.close();
  p = await onPhone('tour-companion/demo/');
  const hdrH = Math.round(await p.evaluate(() => document.querySelector('.hdr-row').getBoundingClientRect().height));
  check('Phone: the iPad app is no wider than the phone, and its title and "Published …" share one line', await p.evaluate(() => document.documentElement.scrollWidth) <= 390 && hdrH <= 34, `header row ${hdrH}px`);
  await p.locator('#tab-tour').tap(); await p.waitForTimeout(400);
  const rowW = Math.round(await p.evaluate(() => document.querySelector('#tourList .tourrow > [role="button"]').getBoundingClientRect().width));
  check('Phone: each of Today\'s tours gets the full width, its buttons underneath', rowW >= 300, rowW + 'px of text');
  await phone.close();

  check('No request left the demo\'s own address', blocked.length === 0, blocked.slice(0, 5).join(' | '));
  check('No console or page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const failed = steps.filter(s => !s.ok).length;
  return JSON.stringify({ passed: steps.length - failed, failed, steps, errors, blocked }, null, 1);
}
