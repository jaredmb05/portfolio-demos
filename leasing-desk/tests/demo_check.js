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
    p.on('dialog', d => d.dismiss().catch(() => {}));
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
  await p.close();

  // ===== Tour Companion (iPad) =====
  tag = 'ipad';
  p = await open('tour-companion/demo/', { width: 1180, height: 820 });
  check('iPad: tour-companion/demo/ opens the app in demo mode', /\/tour-companion\/\?demo$/.test(p.url()), p.url());
  check('iPad: the "Demo: fictional data" banner shows', /Demo: fictional data/.test(await text(p, '.demo-banner')));
  check('iPad: Availability lists the published demo units', await p.locator('.unit:visible').count() >= 10, (await p.locator('.unit:visible').count()) + ' units');
  await p.click('#tab-tour'); await p.waitForTimeout(400);
  check('iPad: Today\'s tours shows the seeded tours', await p.locator('#tourList .tourrow').count() >= 3, (await p.locator('#tourList .tourrow').count()) + ' tours');
  await p.click('#tab-more'); await p.waitForTimeout(300);
  await p.click('.more-item:has-text("Training Quiz")'); await p.waitForTimeout(300);
  await p.selectOption('#quizNameSel', { index: 1 }); await p.click('#quizIntro button:has-text("Begin")'); await p.waitForTimeout(300);
  check('iPad: the training quiz starts', /Question 1 of 30/.test(await text(p, '#quizRun')), (await text(p, '#quizRun')).slice(0, 80));
  await p.close();

  check('No request left the demo\'s own address', blocked.length === 0, blocked.slice(0, 5).join(' | '));
  check('No console or page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const failed = steps.filter(s => !s.ok).length;
  return JSON.stringify({ passed: steps.length - failed, failed, steps, errors, blocked }, null, 1);
}
