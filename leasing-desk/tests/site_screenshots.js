// Screenshots of the in-browser demo for the README / site — a Playwright CLI run-code function. Run tests/site_screenshots.sh.
// Clock pinned to Tue Oct 6 2026, 2:10 PM New York time (the seeded scene). Every image is 1440 px wide: the Desk at a
// 1440 px window, the Tour Companion in iPad landscape (1180 px) at 1440/1180 scale.
async page => {
  const BASE = '__BASE__', OUT = '__OUT__';
  const browser = page.context().browser();
  const errors = [];
  async function app(path, viewport, scale) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, timezoneId: 'America/New_York' });
    await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text() + ' @ ' + (m.location() || {}).url); }); p.on('pageerror', e => errors.push(e.message));
    p.on('dialog', d => d.dismiss().catch(() => {})); p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    await p.addInitScript(() => { try { localStorage.setItem('ld_tourSeen', '1'); } catch (e) {} });
    await p.goto(BASE + path); await p.waitForTimeout(1500);
    return p;
  }
  const shot = async (p, name) => {   // after any message at the bottom of the screen has gone
    await p.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 10000 }).catch(() => {});
    await p.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
  };
  const top = (p, sel, off = 0) => p.evaluate(([s, o]) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, off]);

  // Desk: Tour Queue with the first waiting prospect's wait estimate open
  let p = await app('desk/?demo', { width: 1440, height: 1000 }, 1);
  await p.evaluate(() => { document.getElementById('queuePanel').classList.add('open'); setQueueTab('queue'); });
  await p.waitForTimeout(400); await top(p, '#queuePanel', 12); await p.waitForTimeout(200);
  await shot(p, 'desk-queue-wait-estimate');
  // Desk: a finished tour (no broker) opened from Follow-Ups → its follow-up email built
  await p.evaluate(() => setQueueTab('followup')); await p.waitForTimeout(300);
  await p.locator('#queueBody .queue-row', { hasText: 'Grace' }).locator('button:has-text("Open")').click(); await p.waitForTimeout(900);
  await p.evaluate(() => document.getElementById('queuePanel').classList.remove('open')); await p.waitForTimeout(300);
  await top(p, '.panel-header', 12); await p.waitForTimeout(200);
  await shot(p, 'desk-email-follow-up');
  // Desk: Rotation tab with the manager PIN unlocked (Today's totals, team schedule)
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; document.getElementById('queuePanel').classList.add('open'); setQueueTab('rotation'); });
  await p.setViewportSize({ width: 1440, height: 1500 });   // tall enough for Today's totals
  await p.waitForTimeout(400); await top(p, '#queuePanel', 12); await p.waitForTimeout(200);
  await shot(p, 'desk-rotation-unlocked');
  await p.context().close();

  // Tour Companion (iPad, landscape)
  p = await app('tour-companion/?demo', { width: 1180, height: 820 }, 1440 / 1180);
  await shot(p, 'ipad-availability');
  await p.click('#tab-tour'); await p.waitForTimeout(400);
  await p.locator('#tourList .tourrow', { hasText: 'Daniel R.' }).locator('button:has-text("Open")').click(); await p.waitForTimeout(700);
  await shot(p, 'ipad-tour-planner-quote');
  await p.click('#tab-more'); await p.waitForTimeout(300);
  await p.click('.more-item:has-text("Training Quiz")'); await p.waitForTimeout(300);
  await p.selectOption('#quizNameSel', 'Rosa'); await p.click('#quizIntro button:has-text("Begin")'); await p.waitForTimeout(400);
  await shot(p, 'ipad-quiz');
  await p.context().close();
  return JSON.stringify({ errors });   // expected: none
}
