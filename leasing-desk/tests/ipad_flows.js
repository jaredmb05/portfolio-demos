// Tour Companion (iPad) click-through of the TESTING.md iPad checklist — a Playwright CLI run-code function.
// Run it with tests/ipad_flows.sh (fills __ROOT__ / __OUT__). Same setup as ipad_capture.js: the UNMODIFIED page at
// https://ipad.test/ in WebKit with iPad touch emulation, seeded fake Firestore, clock pinned to Tue Oct 6 2026, 2:10 PM New York time.
// The manager / quiz PIN is never typed: the quiz-exit check only cancels the PIN prompt.
// Returns { passed, failed, steps: [{ step, ok, detail }], errors }.
async page => {
  const ROOT = '__ROOT__', OUT = '__OUT__';
  const ctx = page.context();
  const errors = [], steps = [];
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
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`${tag}: console: ${m.text().split('\n')[0]}`); });
  p.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
  let dismissNext = false;   // the quiz-exit PIN prompt is cancelled, never answered
  const dialogs = [];
  p.on('dialog', d => { dialogs.push(d.message()); (dismissNext ? d.dismiss() : d.accept()).catch(() => {}); });
  await p.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await p.setViewportSize({ width: 820, height: 1180 });
  await p.goto('https://ipad.test/tour-companion/');
  await p.waitForTimeout(900);

  const check = (step, ok, detail) => steps.push({ step, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  const tabTo = async id => { await p.click('#tab-' + id); await p.waitForTimeout(300); };
  const stored = name => p.evaluate(n => Object.values(window.__STORE.tours).find(t => (t.prospect || '').startsWith(n)) || null, name);
  const homeNote = () => p.evaluate(() => { const n = document.getElementById('homeNote'); return n && n.offsetParent ? n.textContent.trim() : ''; });

  // ===== 1. Version + Availability search =====
  tag = 'load';
  check('Footer shows Build v1.19', /^Build v1\.19/.test(await p.textContent('#footer')), await p.textContent('#footer'));
  check('Header says the showsheet is live', /Published/.test(await p.textContent('header')), (await p.textContent('header')).replace(/\s+/g, ' ').trim());
  await p.fill('#search', '1812'); await p.waitForTimeout(200);
  const hits = await p.locator('.unit:visible').count();
  check('Availability search finds #1812', hits >= 1 && /#1812/.test(await p.locator('.unit:visible').first().textContent()), hits + ' row(s)');
  await p.fill('#search', '');
  await tabTo('req');
  const rules = (await p.textContent('#reqRules')).replace(/\s+/g, ' ').trim();
  check('Requirements tab shows the 45× / 75× / $20 rules from shared/requirements.js', /^Tenant income: 45× the monthly rent Guarantor income: 75× the monthly rent Application fee: \$20 per person /.test(rules), rules);

  // ===== 2. New tour → pick units → remove + Undo → take it → Start → Finish =====
  tag = 'tour';
  await tabTo('tour');
  await p.click('button:has-text("New tour")'); await p.waitForTimeout(250);
  await p.fill('#tFirst', 'Testy'); await p.fill('#tProspect', 'Q');
  await p.click('#needBeds .chip:has-text("1 Bed")');
  await p.click('#guestDoneBtn'); await p.waitForTimeout(400);
  await p.locator('#pickerList .pick', { hasText: '#1812' }).first().click(); await p.waitForTimeout(400);
  await p.locator('#pickerList .pick', { hasText: '#906' }).first().click(); await p.waitForTimeout(400);
  check('Picking two units adds both to the tour', await p.evaluate(async () => (await (async () => { const imp = f => import(new URL(f, location.href).href); return (await imp('js/state.js')).state.tour; })()).stops.map(s => s.unit).join(',')) === '1812,906', await p.evaluate(async () => (await (async () => { const imp = f => import(new URL(f, location.href).href); return (await imp('js/state.js')).state.tour; })()).stops.map(s => s.unit).join(',')));
  await p.locator('.pick-editor.open .stop-remove').last().click(); await p.waitForTimeout(250);
  const undoShown = await p.locator('#undoBar').isVisible();
  check('Removing a unit offers Undo', undoShown, undoShown ? (await p.textContent('#undoBar')).trim() : 'no bar');
  if (undoShown) { await p.click('#undoBar button:has-text("Undo")'); await p.waitForTimeout(300); }
  check('Undo puts the unit back', await p.evaluate(async () => (await (async () => { const imp = f => import(new URL(f, location.href).href); return (await imp('js/state.js')).state.tour; })()).stops.map(s => s.unit).sort().join(',')) === '1812,906');
  check('"Who\'s taking" row offers the assistants', await p.locator('#takeRow button').count() >= 2, await p.locator('#takeRow').textContent().then(s => s.replace(/\s+/g, ' ').trim()));
  await p.click('#takeRow button:has-text("Rosa")'); await p.waitForTimeout(300);
  check('Tapping a name assigns the tour', await p.evaluate(async () => (await (async () => { const imp = f => import(new URL(f, location.href).href); return (await imp('js/state.js')).state.tour; })()).assistant) === 'Rosa');
  dialogs.length = 0;
  await p.click('#tStart'); await p.waitForTimeout(900);
  let t = await stored('Testy');
  check('Start goes straight through, even if that assistant is on another tour (the iPad doesn\'t track who\'s busy, D20)', t && t.startedAtIso && t.assistant === 'Rosa' && dialogs.length === 0, t && `${t.assistant} · ${dialogs.join(' | ')}`);
  check('Start tour saves the start time and units', t && t.startedAtIso && (t.stops || []).length === 2, t && `${t.assistant} · ${(t.stops || []).length} units`);
  check('Started tour shows the summary + building card', await p.locator('.sum-head').first().isVisible() && await p.locator('text=where things are').first().isVisible());
  await p.click('#tFinish'); await p.waitForTimeout(900);
  t = await stored('Testy');
  check('Finish tour saves finishedAtIso and returns home', t && t.finishedAtIso && /Finished Testy/.test(await homeNote()), await homeNote());
  check('Today\'s tours lists it under Finished', await p.locator('#tourList .tourrow', { hasText: 'Testy' }).count() > 0);

  // ===== 3. New inspection → Start → Finish from Today's tours =====
  tag = 'inspection';
  await p.click('button:has-text("New inspection")'); await p.waitForTimeout(250);
  await p.fill('#tFirst', 'Inspo'); await p.fill('#tProspect', 'R'); await p.selectOption('#insBldg', '2110 TIDEMARK BLVD'); await p.fill('#insUnit', '1201');
  await p.selectOption('#tAssistant', 'Tariq'); await p.waitForTimeout(150);
  await p.click('#tStart'); await p.waitForTimeout(800);
  t = await stored('Inspo');
  check('Inspection starts with a one-line bar', t && t.startedAtIso && t.kind === 'inspection' && /Finish inspection/.test(await p.textContent('#tFinish')));
  await p.click('#tourFooter button:has-text("Back to tours")'); await p.waitForTimeout(300);
  await p.locator('#tourList .tourrow', { hasText: 'Inspo' }).locator('button:has-text("Finish")').click(); await p.waitForTimeout(800);
  t = await stored('Inspo');
  check('Finish from Today\'s tours finishes the inspection', t && t.finishedAtIso, await homeNote());

  // ===== 4. A tour open on the iPad updates when the Desk finishes it =====
  tag = 'desk-finish';
  await p.locator('#tourList .tourrow', { hasText: 'Priya S.' }).locator('button:has-text("Open")').click(); await p.waitForTimeout(500);
  const openId = await p.evaluate(async () => (await (async () => { const imp = f => import(new URL(f, location.href).href); return (await imp('js/state.js')).state.tour; })()).id);
  await p.evaluate(id => firebase.firestore().collection('tours').doc(id).set({ finishedAtIso: '2026-10-06T18:12:00.000Z', updatedAtIso: '2026-10-06T18:12:00.000Z' }, { merge: true }), openId);
  await p.waitForTimeout(700);
  check('Desk finishing the open tour closes it on the iPad with a note', !(await p.evaluate(async () => (await (async () => { const imp = f => import(new URL(f, location.href).href); return (await imp('js/state.js')).state.tour; })()).active)) && /finished at the Leasing Desk/.test(await homeNote()), await homeNote());

  // ===== 5. Who's in / out, rotation and wait estimates are Desk-only (D20) =====
  tag = 'desk-only';
  await tabTo('tour');
  const home = await p.evaluate(() => ({ rot: !!document.getElementById('rotList'), walkin: !!document.getElementById('waitLine'),
    panels: document.querySelectorAll('#tourList .wp-toggle, #tourList .wp').length, text: document.getElementById('tourList').textContent }));
  check('Tour Planner home has no Rotation card, walk-in wait or wait panels', !home.rot && !home.walkin && home.panels === 0 && !/Wait estimate|next up|Mark out/i.test(home.text), JSON.stringify({ rot: home.rot, walkin: home.walkin, panels: home.panels }));
  await p.click('button:has-text("New tour")'); await p.waitForTimeout(250);
  await p.fill('#tFirst', 'Alpha'); await p.click('#guestDoneBtn'); await p.waitForTimeout(300);
  const chipNames = (await p.locator('#takeRow button').allTextContents()).map(c => c.trim());
  const teamAZ = await p.evaluate(async () => (await import(new URL('../shared/team.js', location.href).href)).team.assistants.slice().sort((x, y) => x.localeCompare(y)));
  check('"Who\'s taking" lists the whole team A to Z, no "next up"', JSON.stringify(chipNames) === JSON.stringify(teamAZ) && !chipNames.some(c => /next up/.test(c)), chipNames.join(', '));
  const optNames = (await p.locator('#tAssistant option').allTextContents()).map(o => o.trim()).filter(o => !/Unassigned|Edit list/.test(o));
  check('Leasing assistant dropdown: whole team A to Z, no "(suggested next)"', JSON.stringify(optNames) === JSON.stringify(teamAZ), optNames.join(', '));
  await p.click('#tourFooter button:has-text("Back to tours")').catch(() => {}); await p.waitForTimeout(300);

  // ===== 6. More → calculator, cheat sheet, quiz (exit prompt cancelled) =====
  tag = 'more';
  await tabTo('more');
  await p.click('.more-item:has-text("Net Rent Calculator")'); await p.waitForTimeout(200);
  await p.fill('#cRent', '4150'); await p.selectOption('#cFree', '1'); await p.waitForTimeout(150);
  check('Calculator: $4,150, 1 month free, 12 months → $3,804', (await p.textContent('#cNet')).trim() === '$3,804', (await p.textContent('#cNet')).trim());
  await p.click('#moreCalc .back-link');
  await p.click('.more-item:has-text("Building Cheat Sheet")'); await p.waitForTimeout(200);
  check('Cheat sheet opens', await p.locator('#moreCheat').isVisible());
  await p.click('#moreCheat .back-link');
  await p.click('.more-item:has-text("Training Quiz")'); await p.waitForTimeout(150);
  await p.selectOption('#quizNameSel', 'Rosa'); await p.click('#quizIntro button:has-text("Begin")'); await p.waitForTimeout(200);
  check('Quiz starts on question 1', /Question 1 of 30/.test(await p.textContent('#quizRun')));
  await p.locator('#quizRun .qopt').first().click(); await p.waitForTimeout(250);
  dismissNext = true;
  await p.click('#quizRun button:has-text("Exit quiz")'); await p.waitForTimeout(250);
  dismissNext = false;
  check('Cancelling the PIN prompt keeps the quiz open', await p.locator('#quizRun').isVisible());

  // ===== 9. Hostile shared data: quotes and markup stay text, links stay http(s) (B4) =====
  tag = 'hostile';
  const h = await ctx.newPage();
  h.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`hostile: console: ${m.text().split('\n')[0]}`); });
  h.on('pageerror', e => errors.push(`hostile: page error: ${e.message}`));
  h.on('dialog', d => d.accept().catch(() => {}));
  await h.addInitScript(() => { window.__SEED_OPTS = { hostile: true }; try { localStorage.clear(); } catch (e) {} });
  await h.setViewportSize({ width: 820, height: 1180 });
  await h.goto('https://ipad.test/tour-companion/'); await h.waitForTimeout(900);
  await h.click('#tab-tour'); await h.waitForTimeout(300);                                         // today's tours and the rotation
  await h.click('button:has-text("New tour")'); await h.waitForTimeout(250);
  await h.fill('#tFirst', 'Pat'); await h.fill('#tProspect', 'R');
  await h.click('#guestDoneBtn'); await h.waitForTimeout(400);
  await h.locator('#pickerList .pick', { hasText: '__pwned' }).first().click(); await h.waitForTimeout(400);   // its editor's handlers carry the stop key
  const stops = await h.evaluate(async () => (await import(new URL('js/state.js', location.href).href)).state.tour.stops.map(s => s.unit));
  await h.click('#tab-list'); await h.waitForTimeout(300);                                         // availability, with the javascript: floor plan
  const ipadHostile = await h.evaluate(() => ({
    pwned: window.__pwned || '',
    elements: [...document.querySelectorAll('[id^="pwn"], [onmouseover], [onerror]')].map(e => e.outerHTML.slice(0, 80)),
    links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && !/^(https?:|mailto:|tel:|#)/i.test(h)),
  }));
  check('Hostile data: no markup from shared fields, nothing runs, no non-http(s) links (B4)', !ipadHostile.pwned && !ipadHostile.elements.length && !ipadHostile.links.length, JSON.stringify(ipadHostile));
  check('Hostile data: the unit with quotes in its number can still be added to a tour', stops.some(u => /__pwned/.test(u)), JSON.stringify(stops));
  check('Hostile data: no page errors from the handlers', !errors.some(e => e.startsWith('hostile')), errors.filter(e => e.startsWith('hostile')).join(' | '));
  await h.close();

  // ===== 10. Broker tours: the quoting note states the OR and the AND rule (owner-approved wording) =====
  tag = 'broker-note';
  const NOTE = "OR incentives: quote the OP to the broker; quote the prospect's concession and net rent only if the broker waives it. AND incentives: quote both.";
  const b = await ctx.newPage();
  b.on('pageerror', e => errors.push(`broker-note: page error: ${e.message}`));
  await b.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await b.setViewportSize({ width: 820, height: 1180 });
  await b.goto('https://ipad.test/tour-companion/'); await b.waitForTimeout(900);
  await b.click('#tab-tour'); await b.waitForTimeout(300);
  await b.click('button:has-text("New tour")'); await b.waitForTimeout(250);
  await b.check('#tBroker'); await b.waitForTimeout(200);
  const guestNote = (await b.textContent('#brokerNote')).trim();
  check('Ticking "Touring with a broker" shows the OR and AND quoting rule', guestNote === NOTE, guestNote);
  const summaryNote = await b.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    (await imp('js/state.js')).state.tour.broker = true; (await imp('js/tour-summary.js')).renderSummary();
    const n = document.querySelector('#tourSummary .disclaimer'); return n ? n.textContent.trim() : '(no note)';
  });
  check('The started-tour summary shows the same rule on a broker tour', summaryNote === NOTE, summaryNote);
  await b.close();

  const failed = steps.filter(s => !s.ok).length;
  return JSON.stringify({ passed: steps.length - failed, failed, steps, errors }, null, 1);
}
