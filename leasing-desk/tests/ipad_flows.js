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
  check('Footer shows Build v1.29', /^Build v1\.29/.test(await p.textContent('#footer')), await p.textContent('#footer'));
  check('Header says the showsheet is live', /Published/.test(await p.textContent('header')), (await p.textContent('header')).replace(/\s+/g, ' ').trim());
  await p.fill('#search', '1812'); await p.waitForTimeout(200);
  const hits = await p.locator('.unit:visible').count();
  check('Availability search finds #1812', hits >= 1 && /#1812/.test(await p.locator('.unit:visible').first().textContent()), hits + ' row(s)');
  await p.fill('#search', '');
  await tabTo('req');
  const rules = (await p.textContent('#reqRules')).replace(/\s+/g, ' ').trim();
  check('Requirements tab shows the 45× / 75× / $20 rules from shared/requirements.js', /^Tenant income: 45× the monthly rent Guarantor income: 75× the monthly rent Application fee: \$20 per person /.test(rules), rules);
  const docLines = await p.evaluate(() => ['doc-w2', 'doc-self', 'doc-student'].map(id => [...document.querySelectorAll(`#${id} li`)].map(li => li.textContent.trim()).filter(t => /statement/i.test(t)).join(' ')));
  check('Requirements tab (employed / self-employed / student): two most recent statements, all pages (production v1.21)',
    docLines[0] === 'Two most recent bank statements for the payroll account (all pages)' && docLines[1] === 'Two most recent checking or savings account statements (all pages)' && docLines[2] === 'Two most recent bank statements (all pages)', docLines.join(' · '));

  // ===== 2. New tour → pick units → remove + Undo → take it → Start → Finish =====
  tag = 'tour';
  await tabTo('tour');
  await p.click('button:has-text("New tour")'); await p.waitForTimeout(250);
  await p.fill('#tFirst', 'Testy'); await p.fill('#tProspect', 'Q');
  await p.click('#needBeds .chip:has-text("1 Bed")'); await p.fill('#needMax', '4500'); await p.check('#needFlex');   // required since production v1.27 (D45)
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
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:45:00-04:00'));   // a real tour: 35 minutes later
  dialogs.length = 0;
  await p.click('#tFinish'); await p.waitForTimeout(900);
  t = await stored('Testy');
  check('Finish tour saves finishedAtIso and returns home', t && t.finishedAtIso && /Finished Testy/.test(await homeNote()), await homeNote());
  check('A tour that ran 35 minutes gets the usual Finish confirm, not the start-time question', /^Finish tour for Testy/.test(dialogs[0] || '') && !(await p.locator('.startq-bg').count()) && !t.startCorrectedFromIso, dialogs[0] || 'no dialog');
  check('Today\'s tours lists it under Finished', await p.locator('#tourList .tourrow', { hasText: 'Testy' }).count() > 0);
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));

  // ===== 2b. Start and Finish tapped together after the tour: "Did this tour start earlier?" (production v1.20, D26) =====
  tag = 'start-earlier';
  const quickTour = async (first, startAt) => {
    await p.click('button:has-text("New tour")'); await p.waitForTimeout(250);   // set up at the current clock time
    await p.fill('#tFirst', first); await p.fill('#tProspect', 'Q');
    await p.click('#needBeds .chip:has-text("1 Bed")'); await p.fill('#needMax', '4500'); await p.check('#needFlex');   // required since production v1.27 (D45)
    await p.click('#guestDoneBtn'); await p.waitForTimeout(400);
    await p.locator('#pickerList .pick', { hasText: '#1812' }).first().click(); await p.waitForTimeout(400);
    await p.click('#takeRow button:has-text("Rosa")'); await p.waitForTimeout(300);
    await ctx.clock.setFixedTime(new Date(startAt));   // Start tapped only when they're back
    await p.click('#tStart'); await p.waitForTimeout(900);
  };
  await quickTour('Quick', '2026-10-06T14:40:00-04:00');   // set up at 2:10 PM, Start tapped at 2:40 PM
  dialogs.length = 0;
  await p.click('#tFinish'); await p.waitForTimeout(400);
  const sheetText = (await p.locator('.startq').textContent().catch(() => '')).replace(/\s+/g, ' ');
  check('Finish within a minute of Start asks "Did this tour start earlier?" instead of the usual confirm',
    /Did this tour start earlier\?/.test(sheetText) && /Started when it was set up · 2:10 PM/.test(sheetText) && /It just started — finish anyway/.test(sheetText) && dialogs.length === 0, sheetText.slice(0, 200));
  const short = await p.evaluate(() => [...document.querySelectorAll('.startq button, .startq input')].map(el => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim(), h: el.getBoundingClientRect().height })).filter(x => x.h < 44));
  check('Every button and the time box in the question are at least 44pt tall', !short.length, JSON.stringify(short));
  await p.click('.startq button:has-text("Started when it was set up")'); await p.waitForTimeout(900);
  t = await stored('Quick');
  check('"Started when it was set up" saves that start, keeps the original Start tap as startCorrectedFromIso, and finishes',
    t && t.startedAtIso === t.createdAtIso && t.createdAtIso === '2026-10-06T18:10:00.000Z' && t.startCorrectedFromIso === '2026-10-06T18:40:00.000Z' && t.finishedAtIso && !(await p.locator('.startq-bg').count()) && /Finished Quick/.test(await homeNote()),
    t && `start ${t.startedAtIso} (set up ${t.createdAtIso}) · Start tapped ${t.startCorrectedFromIso} · finished ${!!t.finishedAtIso}`);
  // The same question from Today's tours: Cancel, a time in the future, then a real earlier time
  await quickTour('Quack', '2026-10-06T14:40:00-04:00');   // set up and started at 2:40 PM
  await p.click('#tourFooter button:has-text("Back to tours")'); await p.waitForTimeout(300);
  const finishQuack = () => p.locator('#tourList .tourrow', { hasText: 'Quack' }).locator('button:has-text("Finish")').click();
  dialogs.length = 0;
  await finishQuack(); await p.waitForTimeout(300);
  check('A tour set up under 5 minutes before Finish is not offered "Started when it was set up"; the picker starts half an hour ago',
    await p.locator('.startq').count() === 1 && !(await p.locator('.startq [data-a="setup"]').count()) && await p.inputValue('#startqTime') === '14:10' && dialogs.length === 0, await p.inputValue('#startqTime').catch(() => 'no question'));
  await p.click('.startq button:has-text("Cancel")'); await p.waitForTimeout(300);
  t = await stored('Quack');
  check('Cancel leaves the tour unfinished', t && !t.finishedAtIso && !t.startCorrectedFromIso && t.startedAtIso === '2026-10-06T18:40:00.000Z' && !(await p.locator('.startq-bg').count()));
  await finishQuack(); await p.waitForTimeout(300);
  await p.fill('#startqTime', '15:30'); await p.click('.startq button:has-text("Use this time")'); await p.waitForTimeout(300);
  check('A start time later than now is refused with a message', /at least a minute before now/.test(await p.textContent('#startqErr')) && !(await stored('Quack')).finishedAtIso && await p.locator('.startq').count() === 1, await p.textContent('#startqErr'));
  await p.fill('#startqTime', '13:55'); await p.click('.startq button:has-text("Use this time")'); await p.waitForTimeout(900);
  t = await stored('Quack');
  check('Finish from Today\'s tours with "Other time" saves that start and keeps the original Start tap',
    t && t.finishedAtIso && t.startedAtIso === '2026-10-06T17:55:00.000Z' && t.startCorrectedFromIso === '2026-10-06T18:40:00.000Z' && !(await p.locator('.startq-bg').count()),
    t && `start ${t.startedAtIso} · Start tapped ${t.startCorrectedFromIso}`);
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));

  // ===== 3. New inspection → Start → Finish from Today's tours =====
  tag = 'inspection';
  await p.click('button:has-text("New inspection")'); await p.waitForTimeout(250);
  await p.fill('#tFirst', 'Inspo'); await p.fill('#tProspect', 'R'); await p.selectOption('#insBldg', '2110 TIDEMARK BLVD'); await p.fill('#insUnit', '1201');
  await p.selectOption('#tAssistant', 'Tariq'); await p.waitForTimeout(150);
  await p.click('#tStart'); await p.waitForTimeout(800);
  t = await stored('Inspo');
  check('Inspection starts with a one-line bar', t && t.startedAtIso && t.kind === 'inspection' && /Finish inspection/.test(await p.textContent('#tFinish')));
  await p.click('#tourFooter button:has-text("Back to tours")'); await p.waitForTimeout(300);
  dialogs.length = 0;
  await p.locator('#tourList .tourrow', { hasText: 'Inspo' }).locator('button:has-text("Finish")').click(); await p.waitForTimeout(800);
  t = await stored('Inspo');
  check('Finish from Today\'s tours finishes the inspection', t && t.finishedAtIso, await homeNote());
  check('An inspection finished right after Start gets the usual confirm (inspections are never asked when they started)', /^Finish inspection for Inspo/.test(dialogs[0] || '') && !(await p.locator('.startq-bg').count()) && !t.startCorrectedFromIso, dialogs[0] || 'no dialog');

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
  await p.fill('#tFirst', 'Alpha'); await p.click('#needBeds .chip:has-text("1 Bed")'); await p.check('#needPriceFlex'); await p.check('#needFlex');   // the details come first since production v1.28 (D48)
  await p.click('#guestDoneBtn'); await p.waitForTimeout(300);
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
  await h.click('#needBeds .chip:has-text("1 Bed")'); await h.check('#needPriceFlex'); await h.check('#needFlex');   // the details come first since production v1.28 (D48)
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

  // ===== 11. 2110 no longer puts the incentive on the last month (production iPad v1.22, D29) =====
  tag = '2110';
  const l = await ctx.newPage();
  l.on('pageerror', e => errors.push(`2110: page error: ${e.message}`));
  await l.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await l.setViewportSize({ width: 820, height: 1180 });
  await l.goto('https://ipad.test/tour-companion/'); await l.waitForTimeout(900);
  const LAST = /last month|except at 2110|except 2110/i;
  const listText = await l.textContent('#pageList');
  await l.click('#tab-more'); await l.waitForTimeout(300);
  await l.click('.more-item:has-text("Building Cheat Sheet")'); await l.waitForTimeout(200);
  const cheatText = await l.textContent('#moreCheat');
  await l.click('#moreCheat .back-link');
  await l.click('.more-item:has-text("Net Rent Calculator")'); await l.waitForTimeout(200);
  const calcLead = (await l.textContent('#moreCalc .lead')).trim();
  const ipad2110 = await l.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const [{ BUILDING_NOTES, BUILDING_INFO }, { QUIZ_BANK }] = await Promise.all([imp('js/buildings.js'), imp('js/quiz.js')]);
    return { note: BUILDING_NOTES['2110'] || '', extra: BUILDING_INFO['2110'].extra || '', bank: QUIZ_BANK.length,
      quiz: QUIZ_BANK.filter(q => /last month of the lease|except 2110/i.test(JSON.stringify(q))).map(q => q[0]) };
  });
  check('2110: no "incentive applied to the last month" on Availability (2050\'s note still shows), its building card or the calculator',
    !ipad2110.note && !LAST.test(ipad2110.extra) && !LAST.test(listText) && /Amenity fee \$40\/mo/.test(listText) && !LAST.test(cheatText) && !LAST.test(calcLead) && /applied up front\.$/.test(calcLead), `note "${ipad2110.note}" · card "${ipad2110.extra}" · calculator "${calcLead}"`);
  check('The quiz bank drops its two questions about it: none about the last month (the quiz still asks 30)', !ipad2110.quiz.length, `${ipad2110.bank} questions · ${ipad2110.quiz.join(' | ')}`);
  await l.close();

  // ===== 12. Occupied / Currently Undergoing Renovation from the published showsheet (production iPad v1.23, D30) =====
  tag = 'occupancy';
  const o = await ctx.newPage();
  o.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`occupancy: console: ${m.text().split('\n')[0]}`); });
  o.on('pageerror', e => errors.push(`occupancy: page error: ${e.message}`));
  o.on('dialog', d => d.accept().catch(() => {}));
  await o.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await o.setViewportSize({ width: 820, height: 1180 });
  await o.goto('https://ipad.test/tour-companion/'); await o.waitForTimeout(900);
  // The seed: #1104 occupied until November 1, #3402 being renovated until October 15, #4201 available December 1 with no such note
  const UNITS = ['1104', '3402', '4201'];
  const label = t => (t.match(/Occupied|Currently Undergoing Renovation/) || ['—'])[0];
  const rowsText = sel => Promise.all(UNITS.map(n => o.locator(sel, { hasText: '#' + n }).first().textContent().then(t => t.replace(/\s+/g, ' '), () => '(no row)')));
  const shownOk = texts => texts.every((t, i) => t.includes('#' + UNITS[i])) && label(texts[0]) === 'Occupied' && label(texts[1]) === 'Currently Undergoing Renovation' && label(texts[2]) === '—';
  const occList = await rowsText('#list .unit');
  await o.click('#tab-tour'); await o.waitForTimeout(300);
  await o.click('button:has-text("New tour")'); await o.waitForTimeout(250);
  await o.fill('#tFirst', 'Olive'); await o.fill('#tProspect', 'W');
  await o.click('#needBeds .chip:has-text("Studio")'); await o.check('#needPriceFlex'); await o.check('#needFlex');   // required since production v1.27 (D45)
  await o.click('#guestDoneBtn'); await o.waitForTimeout(400);
  const occPick = await rowsText('#pickerList .pick:not(.in)');
  for (const n of UNITS) { await o.locator('#pickerList .pick', { hasText: '#' + n }).first().click(); await o.waitForTimeout(400); }
  const occAdded = await rowsText('#pickerList .pick-added .pick.in');
  await o.click('#takeRow button:has-text("Jun")'); await o.waitForTimeout(300);
  await o.click('#tStart'); await o.waitForTimeout(900);
  const occSum = await rowsText('#tourSummary .sum-unit');
  check('Availability list: "Occupied" / "Currently Undergoing Renovation"; nothing on a unit with a date and no such note', shownOk(occList), occList.map(label).join(' / '));
  check('Unit picker, before and after a unit is added: the same labels', shownOk(occPick) && shownOk(occAdded), `before ${occPick.map(label).join(' / ')} · added ${occAdded.map(label).join(' / ')}`);
  check('Started tour summary: the same labels, next to the available date', shownOk(occSum) && /Available November 1, 2026/.test(occSum[0]) && /Available October 15, 2026/.test(occSum[1]), occSum.map(t => `${label(t)} (${(t.match(/Available [^F]*?\d{4}/) || ['no date'])[0]})`).join(' / '));
  await o.close();

  // ===== 13. Required quiz questions; "Signing in a prospect" on the cheat sheet; no tennis fee (production iPad v1.24, D31) =====
  tag = 'quiz-required';
  const qp = await ctx.newPage();
  qp.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`quiz-required: console: ${m.text().split('\n')[0]}`); });
  qp.on('pageerror', e => errors.push(`quiz-required: page error: ${e.message}`));
  qp.on('dialog', d => d.dismiss().catch(() => {}));   // no PIN is ever typed
  await qp.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await qp.setViewportSize({ width: 820, height: 1180 });
  await qp.goto('https://ipad.test/tour-companion/'); await qp.waitForTimeout(900);
  await qp.click('#tab-more'); await qp.waitForTimeout(300);
  await qp.click('.more-item:has-text("Building Cheat Sheet")'); await qp.waitForTimeout(200);
  const cheat = await qp.evaluate(() => {
    const section = h => [...document.querySelectorAll('#cheatBody section')].find(s => s.querySelector('h2').textContent.trim() === h);
    const facts = s => s ? [...s.querySelectorAll('dt')].map(dt => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()]) : [];
    const signIn = section('Signing in a prospect'), b2050 = section('2050 Tidemark Blvd');
    return { order: [...document.querySelectorAll('#cheatBody section h2')].map(h => h.textContent.trim()),
      roles: facts(section('Who handles what')), ask: signIn ? [...signIn.querySelectorAll('dd')[0].children].map(d => d.textContent.trim()) : [], signIn: facts(signIn),
      outdoor: b2050 ? (facts(b2050).find(([t]) => t === 'Outdoor space') || [])[1] || '' : '', lounge: b2050 ? (facts(b2050).find(([t]) => t === 'Lounge') || [])[1] || '' : '' };
  });
  await qp.click('#moreCheat .back-link');
  await qp.click('.more-item:has-text("Training Quiz")'); await qp.waitForTimeout(150);
  await qp.selectOption('#quizNameSel', 'Rosa'); await qp.click('#quizIntro button:has-text("Begin")'); await qp.waitForTimeout(200);
  // 25 quizzes, read off the screen question by question (each answered with its first option, the last one left open)
  const drawQuizzes = n => qp.evaluate(n => {
    const read = () => ({ q: document.getElementById('quizQ').textContent, category: document.getElementById('quizCat').textContent,
      options: [...document.querySelectorAll('#quizOpts .qopt')].map(b => b.textContent), heights: [...document.querySelectorAll('#quizOpts .qopt')].map(b => b.getBoundingClientRect().height) });
    const runs = [];
    for (let d = 0; d < n; d++) {
      startQuiz();   // a new draw each time; the name stays selected
      const total = +(document.getElementById('quizProgress').textContent.match(/of (\d+)$/) || [0, 0])[1], items = [read()];
      for (let i = 1; i < total; i++) { answerQuiz(0); items.push(read()); }
      runs.push(items);
    }
    return runs;
  }, n);
  const runs = await drawQuizzes(25);
  await qp.setViewportSize({ width: 1180, height: 820 }); await qp.waitForTimeout(200);
  const runsWide = await drawQuizzes(1);
  const qz = await qp.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const [{ QUIZ_BANK, QUIZ_REQUIRED }, { SIGN_IN_QUESTIONS, BUILDING_INFO }] = await Promise.all([imp('js/quiz.js'), imp('js/buildings.js')]);
    return { bank: QUIZ_BANK.length, required: QUIZ_REQUIRED, signInQs: SIGN_IN_QUESTIONS, oldRenewal: QUIZ_BANK.filter(q => /renew/i.test(q[0])).map(q => q[0]), info2050: JSON.stringify(BUILDING_INFO['2050']) };
  });
  const [q1, q2, q3] = qz.required.map(r => r[0]);
  const lens = [...new Set(runs.map(r => r.length))];
  const allReq = runs.every(r => [q1, q2, q3].every(q => r.some(it => it.q === q)));
  const dupes = runs.filter(r => new Set(r.map(it => it.q)).size !== r.length).length;
  check('Every quiz (25 draws): 30 questions, the 3 required ones always in, no repeats; 60 in the bank to draw the other 27 from',
    lens.length === 1 && lens[0] === 30 && allReq && !dupes && qz.required.length === 3 && qz.bank === 60, `lengths ${lens.join(',')} · required in all 25: ${allReq} · quizzes with a repeat: ${dupes} · bank ${qz.bank}`);
  const pick = q => runs.map(r => r.find(it => it.q === q)).filter(Boolean);
  const signInOrder = qz.signInQs.concat('All of the above').join(' | ');
  const renewalOrders = new Set(pick(q1).map(it => it.options.join(' | ')));
  check('Sign-in question: the four questions in order, "All of the above" last, in every draw; true/false is True then False',
    pick(q2).length === 25 && pick(q2).every(it => it.options.join(' | ') === signInOrder) && qz.required[1][1] === 'All of the above'
      && pick(q3).length === 25 && pick(q3).every(it => it.options.join('/') === 'True/False') && qz.required[2][1] === 'True', pick(q2)[0] && `${pick(q2)[0].options.join(' | ')} · ${pick(q3)[0].options.join('/')}`);
  check('Renewal / adding an occupant question: answer "Their leasing specialist", its 4 answers shuffled (not a fixed order)',
    qz.required[0][1] === 'Their leasing specialist' && pick(q1).every(it => it.options.length === 4 && it.options.includes('Their leasing specialist')) && renewalOrders.size > 1, `${renewalOrders.size} different orders in 25 draws`);
  check('The quiz screen shows the topic: "Sign-in" on the two sign-in questions, "People" on the renewal one',
    pick(q2).every(it => it.category === 'Sign-in') && pick(q3).every(it => it.category === 'Sign-in') && pick(q1).every(it => it.category === 'People'), `${pick(q2)[0] && pick(q2)[0].category} / ${pick(q3)[0] && pick(q3)[0].category} / ${pick(q1)[0] && pick(q1)[0].category}`);
  check('The old random renewal question is gone from the bank (the required one replaces it)', !qz.oldRenewal.length, qz.oldRenewal.join(' | ') || 'none');
  const role = cheat.roles.find(([t]) => /renewal/i.test(t)) || [];
  check('Cheat sheet "Who handles what": Lease renewals and adding an occupant → Leasing Specialist for that building',
    role[0] === 'Lease renewals and adding an occupant' && role[1] === 'Leasing Specialist for that building', role.join(' → '));
  check('Cheat sheet "Signing in a prospect" (after "Who handles what"): the same four questions the quiz asks, and only their email on the sign-in iPad',
    cheat.order.indexOf('Signing in a prospect') === cheat.order.indexOf('Who handles what') + 1 && cheat.ask.join(' | ') === qz.signInQs.join(' | ') && cheat.ask.length === 4
      && /referred by a Larkspur resident\? \(if they aren't with a broker\)/.test(cheat.ask[0]) && /fill in only their email address and hand the iPad back to you/.test((cheat.signIn.find(([t]) => t === 'The sign-in iPad') || [])[1] || ''),
    `${cheat.ask.join(' | ')} · ${cheat.order.join(' > ')}`);
  check('2050 building card: the tennis courts show no hourly fee (the lounge rate still does)',
    /2 tennis courts, /.test(cheat.outdoor) && !/tennis courts \(/.test(cheat.outdoor) && !/\$20\/hr/.test(qz.info2050) && /\$180\/hr/.test(cheat.lounge), cheat.outdoor);
  const minH = rs => { const hs = rs.flat().flatMap(it => it.heights); return hs.length ? Math.min(...hs) : 0; };
  check('Answer buttons at least 44pt tall, portrait and landscape', minH(runs) >= 44 && minH(runsWide) >= 44, `820×1180: ${minH(runs).toFixed(1)}pt · 1180×820: ${minH(runsWide).toFixed(1)}pt`);
  await qp.close();

  // ===== 14. Leasing assistant contest: Desk only (production Desk v1.29, D35). The iPad receives the note with the published
  // showsheet and shows it nowhere: list, search, picker, the started tour =====
  tag = 'contest';
  const cp = await ctx.newPage();
  cp.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`contest: console: ${m.text().split('\n')[0]}`); });
  cp.on('pageerror', e => errors.push(`contest: page error: ${e.message}`));
  cp.on('dialog', d => d.accept().catch(() => {}));
  await cp.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await cp.setViewportSize({ width: 820, height: 1180 });
  await cp.goto('https://ipad.test/tour-companion/'); await cp.waitForTimeout(900);
  // The seed: #3107 and #2608 carry a gift card note on the published showsheet
  const GIFT = /gift\s*card|🎁/i;
  const received = await cp.evaluate(() => ((window.__STORE.showsheet.current || {}).units || []).filter(u => u.contest).map(u => u.unit).sort().join(','));
  const giftOnPage = () => cp.evaluate(re => new RegExp(re, 'i').test(document.body.textContent), GIFT.source);
  const listRows = await Promise.all(['3107', '2608'].map(n => cp.locator('#list .unit', { hasText: '#' + n }).first().textContent().then(t => t.replace(/\s+/g, ' '), () => '(no row)')));
  const onList = await giftOnPage();
  await cp.fill('#search', 'gift card'); await cp.waitForTimeout(200);
  const giftHits = await cp.locator('#list .unit:visible').count();
  await cp.fill('#search', '');
  await cp.click('#tab-tour'); await cp.waitForTimeout(300);
  await cp.click('button:has-text("New tour")'); await cp.waitForTimeout(250);
  await cp.fill('#tFirst', 'Odette'); await cp.fill('#tProspect', 'K');
  await cp.click('#needBeds .chip:has-text("2 Bed")'); await cp.check('#needPriceFlex'); await cp.check('#needFlex');   // required since production v1.27 (D45)
  await cp.click('#guestDoneBtn'); await cp.waitForTimeout(400);
  const onPicker = await giftOnPage();
  for (const n of ['3107', '2608']) { await cp.locator('#pickerList .pick', { hasText: '#' + n }).first().click(); await cp.waitForTimeout(400); }
  await cp.click('#takeRow button:has-text("Jun")'); await cp.waitForTimeout(300);
  await cp.click('#tStart'); await cp.waitForTimeout(900);
  const onSummary = await giftOnPage();
  const saved = await cp.evaluate(() => { const t = Object.values(window.__STORE.tours).find(x => /^Odette K/.test(x.prospect || '')); return t ? { stops: t.stops.map(s => s.unit).join(','), contest: JSON.stringify(t).includes('contest') || /gift/i.test(JSON.stringify(t)) } : null; });
  check('The iPad receives the two gift card units with the showsheet but shows no gift card: Availability list, unit picker, started tour summary',
    received === '2608,3107' && listRows.every(t => /#(3107|2608)/.test(t) && !GIFT.test(t)) && !onList && !onPicker && !onSummary, `received ${received} · list ${onList} · picker ${onPicker} · summary ${onSummary}`);
  check('…searching "gift card" finds nothing, and the saved tour stops don\'t carry the note', giftHits === 0 && saved && saved.stops === '3107,2608' && !saved.contest, `${giftHits} hit(s) · ${JSON.stringify(saved)}`);
  await cp.close();

  // ===== 15. Security fixes (production iPad v1.25, D41, D43): no prospect email, apostrophes in names and IDs, the team
  // list's ×, https-only floor plan links. The names are invented (an assistant Lena O'Hara, a prospect Theo D'Angelo). =====
  tag = 'security';
  const sp = await ctx.newPage();
  sp.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`security: console: ${m.text().split('\n')[0]}`); });
  sp.on('pageerror', e => errors.push(`security: page error: ${e.message}`));
  const spDialogs = []; sp.on('dialog', d => { spDialogs.push(d.message()); d.accept().catch(() => {}); });
  await sp.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await sp.setViewportSize({ width: 820, height: 1180 });
  await sp.goto('https://ipad.test/tour-companion/'); await sp.waitForTimeout(900);
  const spTour = () => sp.evaluate(async () => (await import(new URL('js/state.js', location.href).href)).state.tour);
  await sp.evaluate(async () => {
    const db = firebase.firestore(), now = new Date().toISOString(), ago = new Date(Date.now() - 5 * 60000).toISOString();
    const { team } = await import(new URL('../shared/team.js', location.href).href);
    await db.collection('settings').doc('assistants').set({ names: team.assistants.concat(["Lena O'Hara"]) });
    await db.collection('tours').doc("t-theo-d'angelo").set({ id: "t-theo-d'angelo", kind: 'tour', assistant: '', prospect: "Theo D'Angelo", prospectFirst: 'Theo', prospectInitial: 'D', stops: [], profile: null, source: 'toolkit', createdAtIso: ago, queuedAtIso: ago, startedAtIso: null, finishedAtIso: null, updatedAtIso: now });
  });
  await sp.waitForTimeout(400);
  await sp.click('#tab-tour'); await sp.waitForTimeout(300);
  await sp.click('button:has-text("New tour")'); await sp.waitForTimeout(250);
  const noEmail = await sp.evaluate(() => !document.querySelector('#tEmail, input[type="email"]') && ![...document.querySelectorAll('#guestCard label')].some(l => /e-?mail/i.test(l.textContent)));
  await sp.fill('#tFirst', 'Petra'); await sp.fill('#tProspect', 'B'); await sp.click('#needBeds .chip:has-text("1 Bed")'); await sp.check('#needPriceFlex'); await sp.check('#needFlex');   // the details come first since production v1.28 (D48)
  await sp.click('#guestDoneBtn'); await sp.waitForTimeout(300);
  const chip = sp.locator('#takeRow button', { hasText: "Lena O'Hara" });
  const chipShown = await chip.count();
  if (chipShown) { await chip.click(); await sp.waitForTimeout(1200); }   // the autosave runs after the tap
  const took = (await spTour()).assistant;
  const petra = await sp.evaluate(() => Object.values(window.__STORE.tours).find(t => /^Petra/.test(t.prospect || '')) || null);
  check("New tour asks for no email; \"Who's taking this tour?\" works for an assistant named O'Hara; the saved tour has no email field",
    noEmail && chipShown && took === "Lena O'Hara" && petra && petra.assistant === "Lena O'Hara" && !Object.keys(petra).some(k => /mail/i.test(k)), `email field ${!noEmail} · chip ${chipShown} · assistant ${took} · saved ${petra ? Object.keys(petra).join(', ') : 'nothing'}`);
  await sp.click('#tourFooter button:has-text("Back to tours")'); await sp.waitForTimeout(300);
  await sp.locator('#tourList .tourrow', { hasText: "Theo D'Angelo" }).locator('button:has-text("Open")').click(); await sp.waitForTimeout(500);
  const opened = await spTour();
  check("A tour whose ID has an apostrophe opens from Today's tours", opened.active && opened.id === "t-theo-d'angelo", `open tour ${opened.id} · active ${opened.active}`);
  // An email left in this iPad's own copy of the tour in progress (saved before v1.25) is dropped when the app reads it
  const localOut = await sp.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const { state } = await imp('js/state.js'), { loadTourLocal } = await imp('js/tour-planner.js');
    localStorage.setItem('tour_current', JSON.stringify(Object.assign({}, state.tour, { prospectEmail: 'old@example.com' })));
    loadTourLocal();
    return { inMemory: 'prospectEmail' in state.tour, inStorage: /prospectEmail/.test(localStorage.getItem('tour_current') || ''), tour: state.tour.id };
  });
  check("An email left in the iPad's own copy of the tour in progress is dropped (from memory and from the iPad)", !localOut.inMemory && !localOut.inStorage && localOut.tour === "t-theo-d'angelo", JSON.stringify(localOut));
  await sp.click('#tourFooter button:has-text("Back to tours")'); await sp.waitForTimeout(300);
  spDialogs.length = 0;
  await sp.locator('#tourList .tourrow', { hasText: "Theo D'Angelo" }).locator('button:has-text("Delete")').click(); await sp.waitForTimeout(500);
  const theoGone = await sp.evaluate(() => !window.__STORE.tours["t-theo-d'angelo"]);
  check("…and its Delete works", theoGone && spDialogs.some(m => /^Delete Theo D'Angelo/.test(m)), `deleted ${theoGone} · ${spDialogs.join(' | ')}`);
  // The team list's remove (×) button, reached as staff do: New tour → Leasing assistant → Edit list… (PIN taken as entered)
  await sp.click('button:has-text("New tour")'); await sp.waitForTimeout(250);
  await sp.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.managerUnlocked = true; });
  await sp.selectOption('#tAssistant', '__manage__'); await sp.waitForTimeout(200);
  spDialogs.length = 0;
  await sp.locator('#assistantList .aname', { hasText: "Lena O'Hara" }).locator('button').click(); await sp.waitForTimeout(500);
  const teamNow = await sp.evaluate(() => window.__STORE.settings.assistants.names);
  check("The team list's remove (×) button works, for O'Hara too", !teamNow.includes("Lena O'Hara") && spDialogs.some(m => /Remove Lena O'Hara/.test(m)), `${teamNow.join(', ')} · ${spDialogs.join(' | ')}`);
  await sp.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.managerUnlocked = false; toggleAssistantManage(false); });
  // Floor plan links (D43): http:// opens as https://; anything else isn't made into a link (Availability list and tour summary)
  const fpOut = await sp.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const { data, fpMap } = await imp('js/showsheet-feed.js'), { fpKey } = await imp('js/format.js');
    const u = ((data && data.units) || []).find(x => x.unit === '1812'); if (!u) return null;
    const k = fpKey(u.building, u.unit), keep = fpMap[k];
    fpMap[k] = 'http://example.com/fp-ipad.pdf'; render();
    const upgraded = !!document.querySelector('#list a[href="https://example.com/fp-ipad.pdf"]') && !document.querySelector('#list a[href^="http:"]');
    fpMap[k] = 'ftp://example.com/fp-ipad.pdf'; render();
    const dropped = !document.querySelector('#list a[href^="ftp:"]');
    // The started-tour summary's "Floor plan ↗" button
    const { state } = await imp('js/state.js'), { renderSummary } = await imp('js/tour-summary.js'), keepStops = state.tour.stops;
    state.tour.stops = [{ key: k, building: u.building, unit: u.unit, type: u.type, monthly: u.monthly, netEff: u.netEff, incentive: u.incentive, avail: u.avail, rent: '', free: 0, term: 12, op: 0, opMode: 'or', credit: '', notes: '' }];
    fpMap[k] = 'http://example.com/fp-ipad.pdf'; renderSummary();
    const summaryUpgraded = !!document.querySelector('#tourSummary a[href="https://example.com/fp-ipad.pdf"]');
    fpMap[k] = 'javascript:alert(1)'; renderSummary();
    const summaryDropped = !document.querySelector('#tourSummary a[href^="javascript:"]') && !/Floor plan ↗/.test(document.getElementById('tourSummary').textContent);
    state.tour.stops = keepStops; fpMap[k] = keep; render(); renderSummary();
    return { upgraded, dropped, summaryUpgraded, summaryDropped };
  });
  check('Floor plan links on the Availability list and the tour summary: http:// opens as https://, anything else is not a link',
    fpOut && fpOut.upgraded && fpOut.dropped && fpOut.summaryUpgraded && fpOut.summaryDropped, JSON.stringify(fpOut));
  await sp.close();

  // ===== 16. "Connecting…" instead of "Offline", reconnecting on coming back on screen, the Reconnect button (production
  // iPad v1.26, D44). The fake database holds its answer (noAnswer: every snapshot comes from the iPad's saved copy) and logs
  // disableNetwork / enableNetwork in __NET.calls. The clock is pinned, so waiting is simulated by moving the wait's start
  // (conn.since) or the moment the app went away (conn.hiddenAt) back instead of sleeping. =====
  tag = 'reconnect';
  const q = await ctx.newPage();
  q.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`reconnect: console: ${m.text().split('\n')[0]}`); });
  q.on('pageerror', e => errors.push(`reconnect: page error: ${e.message}`));
  await q.addInitScript(() => { window.__SEED_OPTS = { ipadCache: true, noAnswer: true }; try { localStorage.clear(); } catch (e) {} });
  await q.setViewportSize({ width: 820, height: 1180 });
  await q.goto('https://ipad.test/tour-companion/'); await q.waitForTimeout(900);
  const hdr = () => q.evaluate(() => {
    const bn = document.getElementById('banner'), btn = bn.querySelector('button'), r = btn && btn.getBoundingClientRect();
    return { text: document.getElementById('liveText').textContent.trim(), dot: document.getElementById('dot').className,
      banner: bn.classList.contains('show') ? bn.textContent.trim() : '', button: btn ? `${btn.textContent} ${Math.round(r.width)}×${Math.round(r.height)}` : '' };
  });
  let hd = await hdr();
  check('Opened with the saved copy, the database not answering yet: "Connecting… · last copy", grey dot, no Offline banner', /^Connecting… · last copy/.test(hd.text) && /\bwait\b/.test(hd.dot) && !hd.banner, JSON.stringify(hd));
  // 16 seconds without an answer (a missing conn / status export leaves the header as it is, so the check fails rather than the run)
  await q.evaluate(async () => { const f = await import(new URL('js/showsheet-feed.js', location.href).href); if (f.conn && f.status) { f.conn.since = Date.now() - 16000; f.status(); } });
  hd = await hdr();
  const btnSize = (hd.button.match(/(\d+)×(\d+)/) || []).slice(1).map(Number);
  check('Still no answer after 15 seconds: "Offline", the red banner, and a Reconnect button at least 44×44',
    /^Offline · last copy/.test(hd.text) && /\boff\b/.test(hd.dot) && /^Offline — showing the last showsheet/.test(hd.banner) && /^Reconnect/.test(hd.button) && btnSize[0] >= 44 && btnSize[1] >= 44, JSON.stringify(hd));
  await q.evaluate(() => { window.__NET.calls.length = 0; window.__NET.hold = false; });   // this time the database answers
  if (await q.$('#banner button')) { await q.click('#banner button'); await q.waitForTimeout(300); }   // missing = the check below fails
  hd = await hdr();
  const tapCalls = await q.evaluate(() => window.__NET.calls.join(','));
  check('Reconnect turns the connection off and on once, then the header shows the live showsheet and the banner goes', tapCalls === 'disable,enable' && /^Published/.test(hd.text) && !hd.banner, `${tapCalls} · ${JSON.stringify(hd)}`);
  // Coming back on screen: after more than 30 seconds away it reconnects once; after a quick look at another app it doesn't
  const wake = await q.evaluate(async () => {
    const f = await import(new URL('js/showsheet-feed.js', location.href).href), conn = f.conn || {};
    let vis = 'visible'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
    const flip = v => { vis = v; document.dispatchEvent(new Event('visibilitychange')); };
    window.__NET.calls.length = 0;
    flip('hidden'); conn.hiddenAt = Date.now() - 5000; flip('visible');
    const short = window.__NET.calls.join(',');
    flip('hidden'); conn.hiddenAt = Date.now() - 31000; flip('visible');
    await new Promise(r => setTimeout(r, 300));
    return { short, long: window.__NET.calls.join(','), text: document.getElementById('liveText').textContent.trim() };
  });
  check('Back on screen after 31 s away: one reconnect, then live again; after 5 s: no reconnect', wake.short === '' && wake.long === 'disable,enable' && /^Published/.test(wake.text), JSON.stringify(wake));
  // The iPad's own network events. Before production v1.26 the listeners passed the event to status() as its message.
  const evtBanners = [];
  for (const type of ['offline', 'online']) { await q.evaluate(t => window.dispatchEvent(new Event(t)), type); await q.waitForTimeout(100); evtBanners.push((await hdr()).banner); }
  await ctx.setOffline(true); await q.waitForTimeout(300);
  const offH = await hdr();
  await ctx.setOffline(false); await q.waitForTimeout(300);
  const backH = await hdr();
  check('No network: "Offline" at once with the banner and no Reconnect button (nothing to retry); back online: live, banner gone',
    /^Offline · last copy/.test(offH.text) && /\boff\b/.test(offH.dot) && /^Offline — showing the last showsheet/.test(offH.banner) && !offH.button && /^Published/.test(backH.text) && !backH.banner,
    `offline: ${JSON.stringify(offH)} · back: ${JSON.stringify(backH)}`);
  const allBanners = evtBanners.concat(offH.banner, backH.banner);
  check('The banner never reads "[object Event]" (online / offline events, from the page or the network)', !allBanners.some(b => /object Event/.test(b)), allBanners.map(b => `"${b}"`).join(' · '));
  await q.close();


  // ===== 17. A tour needs the basics before Send to queue or Start (production iPad v1.27, D45): first name, a size, the most they'd
  // pay (or the price's Flexible box), a move-in date (or Flexible) and, as before, a unit. The same list as the Desk's
  // (apps/shared/tour-required.js), in the action bar, which shrinks as things are filled in. =====
  tag = 'required';
  const r = await ctx.newPage();
  r.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`${tag}: console: ${m.text().split('\n')[0]}`); });
  r.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
  r.on('dialog', d => d.accept().catch(() => {}));
  await r.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await r.setViewportSize({ width: 820, height: 1180 });
  await r.goto('https://ipad.test/tour-companion/'); await r.waitForTimeout(900);
  await r.click('#tab-tour'); await r.waitForTimeout(300);
  await r.click('button:has-text("New tour")'); await r.waitForTimeout(250);
  const rMarks = () => r.evaluate(() => ({
    msg: document.getElementById('tSaveMsg').textContent.trim(),
    outlined: [...document.querySelectorAll('#guestCard .is-missing')].map(e => e.id).join(','),
    notes: [...document.querySelectorAll('#guestCard .field-err')].map(n => n.textContent).join(' | '),
    focus: document.activeElement ? (document.activeElement.id || (document.activeElement.closest('[id]') || {}).id || '') : '' }));
  const rTour = () => r.evaluate(async () => (await import(new URL('js/state.js', location.href).href)).state.tour);
  const rStars = await r.evaluate(() => ['tFirst', 'needBeds', 'needMax', 'needMoveIn'].map(id => !!document.getElementById(id).closest('.f').querySelector('label .req-star')));
  await r.click('#tQueue'); await r.waitForTimeout(300);
  let rm = await rMarks();
  check('Send to queue on an empty form: the action bar names everything missing, each field (marked with a red *) gets a red outline and a note, the cursor goes to the first',
    rm.msg === "⚠ Still needed: first name, size, the most they'd pay (or Flexible), move-in date (or Flexible) and at least one unit." && rm.outlined === 'tFirst,needBeds,needMax,needMoveIn'
      && /Pick at least one size/.test(rm.notes) && /or tick Flexible/.test(rm.notes) && rm.focus === 'tFirst' && rStars.every(Boolean), `${JSON.stringify(rm)} · stars ${rStars}`);
  await r.fill('#tFirst', 'Reqi'); await r.click('#needBeds .chip:has-text("Studio")'); await r.waitForTimeout(200);
  rm = await rMarks();
  check('Filling the name and tapping a size clears those marks at once, and the list shrinks', rm.outlined === 'needMax,needMoveIn' && rm.msg === "⚠ Still needed: the most they'd pay (or Flexible), move-in date (or Flexible) and at least one unit.", JSON.stringify(rm));
  await r.fill('#needMax', '3999.99'); await r.waitForTimeout(100);
  const ipMax = await r.inputValue('#needMax');
  await r.check('#needFlex'); await r.waitForTimeout(150);
  rm = await rMarks();
  check('Price boxes take whole dollars ("3999.99" → "$3,999"); with move-in Flexible, only the unit is left', ipMax === '$3,999' && rm.outlined === '' && rm.msg === '⚠ Still needed: at least one unit.', `${ipMax} · ${JSON.stringify(rm)}`);
  await r.waitForTimeout(1200);   // the autosave runs meanwhile
  const afterAutosave = (await rMarks()).msg, autosaved = await r.evaluate(() => !!Object.values(window.__STORE.tours).find(t => /^Reqi/.test(t.prospect || '')));
  check('The autosave still saves the draft, and doesn\'t replace the list with "Saved" while something is missing', afterAutosave === '⚠ Still needed: at least one unit.' && autosaved, `${afterAutosave} · saved ${autosaved}`);
  await r.click('#guestDoneBtn'); await r.waitForTimeout(300);
  await r.locator('#pickerList .pick', { hasText: '#1812' }).first().click(); await r.waitForTimeout(300);
  const msgAfterUnit = (await rMarks()).msg;
  await r.click('#takeRow button:has-text("Rosa")'); await r.waitForTimeout(200);
  await r.click('#tStart'); await r.waitForTimeout(800);
  const reqi = await r.evaluate(() => Object.values(window.__STORE.tours).find(t => /^Reqi/.test(t.prospect || '')) || null);
  check('Picking a unit clears the list, and Start saves the tour with its profile', msgAfterUnit === '' && reqi && reqi.startedAtIso && reqi.profile.priceMax === 3999 && reqi.profile.flexible === true && reqi.profile.priceFlexible === false && reqi.profile.beds.join() === 'Studio', `after unit "${msgAfterUnit}" · ${reqi && JSON.stringify(reqi.profile)}`);
  await r.evaluate(() => newEntry('tour')); await r.waitForTimeout(250);
  await r.click('#takeRow button:has-text("Rosa")'); await r.waitForTimeout(200);
  await r.click('#tStart'); await r.waitForTimeout(300);
  rm = await rMarks();
  const startedBlank = !!(await rTour()).startedAtIso;
  check('Start (an assistant picked) asks for the same and doesn\'t start', /^⚠ Still needed: first name, size, /.test(rm.msg) && rm.outlined === 'tFirst,needBeds,needMax,needMoveIn' && !startedBlank, JSON.stringify(rm));
  const flexBox = await r.evaluate(() => { const b = document.getElementById('needPriceFlex').closest('label').getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; });
  await r.fill('#tFirst', 'Flexi'); await r.click('#needBeds .chip:has-text("1 Bed")'); await r.check('#needPriceFlex'); await r.fill('#needMoveIn', '2026-12-01');
  await r.click('#guestDoneBtn'); await r.waitForTimeout(300);
  await r.locator('#pickerList .pick', { hasText: '#906' }).first().click(); await r.waitForTimeout(300);
  await r.click('#tQueue'); await r.waitForTimeout(800);
  const flexi = await r.evaluate(() => Object.values(window.__STORE.tours).find(t => /^Flexi\b/.test(t.prospect || '')) || null);
  const flexiRow = (await r.locator('#tourList .tourrow', { hasText: /\bFlexi\b/ }).first().textContent().catch(() => '')).replace(/\s+/g, ' ');   // a regex: plain text would also match "flexible"
  check('No top price but the price Flexible box ticked: queued, saved as priceFlexible, "budget flexible" on Today\'s tours; its label is a 44pt tap target',
    flexi && flexi.queuedAtIso && flexi.profile.priceFlexible === true && !flexi.profile.priceMax && /1 Bed · budget flexible · move-in Dec 1/.test(flexiRow) && flexBox[0] >= 44 && flexBox[1] >= 44,
    flexi ? `${JSON.stringify(flexi.profile)} · ${flexiRow.slice(0, 140)} · label ${flexBox.join('×')}` : 'not queued');
  // Reopened from Today's tours: the prices show as currency, with no marks left over from the last tour
  await r.locator('#tourList .tourrow', { hasText: /\bFlexi\b/ }).locator('button:has-text("Open")').click(); await r.waitForTimeout(400);
  await r.evaluate(() => toggleGuest(true)); await r.waitForTimeout(150);
  const reopenedI = await r.evaluate(() => ({ max: document.getElementById('needMax').value, flex: document.getElementById('needPriceFlex').checked, marks: document.querySelectorAll('#guestCard .is-missing, #guestCard .field-err').length }));
  check('Reopening it shows the price Flexible box ticked and no leftover marks', reopenedI.max === '' && reopenedI.flex && reopenedI.marks === 0, JSON.stringify(reopenedI));
  await r.click('#tourFooter button:has-text("Back to tours")'); await r.waitForTimeout(300);
  await r.evaluate(() => newEntry('inspection')); await r.waitForTimeout(250);
  await r.fill('#tFirst', 'Inspi'); await r.fill('#insUnit', '1201'); await r.selectOption('#tAssistant', 'Tariq'); await r.waitForTimeout(150);
  await r.click('#tStart'); await r.waitForTimeout(800);
  const inspi = await r.evaluate(() => Object.values(window.__STORE.tours).find(t => /^Inspi/.test(t.prospect || '')) || null);
  check('A resident inspection needs none of this (name and unit only)', inspi && inspi.startedAtIso && inspi.kind === 'inspection' && !/Still needed/.test((await rMarks()).msg), inspi ? inspi.kind : (await rMarks()).msg);
  // ===== 17b. The details come before the units (production iPad v1.28, D48): Done and adding a unit ask for them; taking a unit
  // off never asks; the bar doesn't ask for a unit while the details are being filled in =====
  tag = 'details-first';
  await r.evaluate(() => newEntry('tour')); await r.waitForTimeout(250);
  const cardOpen = () => r.evaluate(() => document.getElementById('guestCard').style.display !== 'none');
  await r.fill('#tFirst', 'Dora'); await r.click('#guestDoneBtn'); await r.waitForTimeout(300);
  rm = await rMarks();
  check('Done with only a first name: the card stays open, the bar names the missing details (not units yet), each is outlined, the cursor goes to the first',
    (await cardOpen()) && rm.msg === "⚠ Still needed: size, the most they'd pay (or Flexible) and move-in date (or Flexible)." && rm.outlined === 'needBeds,needMax,needMoveIn' && rm.focus === 'needBeds', JSON.stringify(rm));
  const pick1812 = r.locator('#pickerList .pick', { hasText: '#1812' }).first(); const has1812 = await pick1812.count();
  if (has1812) { await pick1812.click(); await r.waitForTimeout(300); }
  rm = await rMarks();
  const unitsAfterEarlyTap = (await rTour()).stops.length;
  check('Tapping a unit (scrolled past the card) before the details are in: not added, and the bar says what is missing', has1812 === 1 && unitsAfterEarlyTap === 0 && /^⚠ Still needed: size, /.test(rm.msg) && (await cardOpen()),
    `unit row ${has1812} · units ${unitsAfterEarlyTap} · ${rm.msg}`);
  await r.click('#needBeds .chip:has-text("1 Bed")'); await r.check('#needPriceFlex'); await r.waitForTimeout(150);
  const shrunk = await rMarks();
  await r.check('#needFlex'); await r.waitForTimeout(150);
  rm = await rMarks();
  check('Filling them in shrinks the list; once the details are in it clears, with no nagging about units yet',
    shrunk.msg === '⚠ Still needed: move-in date (or Flexible).' && shrunk.outlined === 'needMoveIn' && !/Still needed/.test(rm.msg) && rm.outlined === '', `${shrunk.msg} → ${rm.msg || '(cleared)'}`);
  await r.click('#guestDoneBtn'); await r.waitForTimeout(300);
  const folded = !(await cardOpen());
  await r.locator('#pickerList .pick', { hasText: '#1812' }).first().click(); await r.waitForTimeout(300);
  const addedUnits = (await rTour()).stops.map(s => s.unit).join();
  check('With the details in, Done folds the card and the unit is added', folded && addedUnits === '1812', `folded ${folded} · units ${addedUnits}`);
  await r.evaluate(() => toggleGuest(true)); await r.waitForTimeout(150);
  await r.click('#needBeds .chip:has-text("1 Bed")'); await r.waitForTimeout(150);   // the size taken off again
  const removeBox = r.locator('#pickerList [role="checkbox"][aria-checked="true"]').first(); const hasRemove = await removeBox.count();
  if (hasRemove) { await removeBox.click(); await r.waitForTimeout(300); }
  const unitsLeft = (await rTour()).stops.length;
  check('Taking a unit off never asks, even with a detail missing', hasRemove === 1 && unitsLeft === 0, `remove box ${hasRemove} · units left ${unitsLeft}`);
  await r.click('#tourFooter button:has-text("Back to tours")').catch(() => {}); await r.waitForTimeout(300);
  // The net under the rent on the Availability list and in the unit picker: the showsheet's NET EFF when it is a number other than
  // the rent, in whole dollars, the same rule the Desk's unit list now follows (the Desk flows check the Desk against it)
  await r.click('#tab-list'); await r.waitForTimeout(300);
  const ipadNets = await r.evaluate(async () => {
    const { data } = await import(new URL('js/showsheet-feed.js', location.href).href);
    const rule = u => Number(u.netEff) && Number(u.netEff) !== Number(u.monthly) ? 'Net $' + Math.round(Number(u.netEff)).toLocaleString('en-US') : '';
    const out = { rows: 0, nets: 0, wrong: [], u1104: '' };
    document.querySelectorAll('#list .unit').forEach(row => {
      const n = ((row.querySelector('.unit-num') || {}).firstChild || {}).textContent || '', u = (data.units || []).find(x => '#' + x.unit === n.trim()); if (!u) return;
      out.rows++; const shown = ((row.querySelector('.neteff') || {}).textContent || '').trim(); if (shown) out.nets++;
      if (u.unit === '1104' && /^2050/.test(u.building)) out.u1104 = shown;
      if (shown !== rule(u)) out.wrong.push(`#${u.unit}: "${shown}" vs "${rule(u)}"`);
    });
    return out;
  });
  check('Availability list: the net under the rent follows the one rule both apps use (#1104 "Net $3,071", as on the Desk)', ipadNets.rows >= 15 && ipadNets.nets >= 10 && !ipadNets.wrong.length && ipadNets.u1104 === 'Net $3,071',
    `${ipadNets.rows} rows · ${ipadNets.nets} with a net · #1104 "${ipadNets.u1104}" · ${ipadNets.wrong.slice(0, 4).join(' | ')}`);
  await r.close();

  // ===== 18. Halloween 2026 (production iPad v1.27, D47): a 🎃 by the page title and a 🍬 or 🍭 at the end of the Finish note,
  // Oct 24–31 only (the bat is Desk-only) =====
  tag = 'halloween';
  const hwPage = async when => {
    await ctx.clock.setFixedTime(new Date(when));
    const h = await ctx.newPage();
    h.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`${tag}: console: ${m.text().split('\n')[0]}`); });
    h.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
    h.on('dialog', d => d.accept().catch(() => {}));
    await h.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
    await h.setViewportSize({ width: 820, height: 1180 });
    await h.goto('https://ipad.test/tour-companion/'); await h.waitForTimeout(900);
    return h;
  };
  const hwState = h => h.evaluate(() => ({ on: document.body.classList.contains('halloween'), pumpkin: getComputedStyle(document.querySelector('header h1'), '::after').content, bats: document.querySelectorAll('.hw-bat').length }));
  const finishPriya = async h => { await h.click('#tab-tour'); await h.waitForTimeout(300); await h.locator('#tourList .tourrow', { hasText: 'Priya' }).locator('button:has-text("Finish")').click(); await h.waitForTimeout(600); return (await h.textContent('#homeNote')).trim(); };
  let hp = await hwPage('2026-10-30T14:10:00-04:00');
  const hwOn = await hwState(hp), treatNote = await finishPriya(hp);
  const hwSaved = await hp.evaluate(() => JSON.stringify(window.__W));
  await hp.close();
  hp = await hwPage('2026-11-01T14:10:00-05:00');   // the same time of day as the seeded tours (EST: the clocks went back at 2 AM)
  const hwOff = await hwState(hp), plainNote = await finishPriya(hp);
  await hp.close();
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));
  check('Oct 30: a 🎃 by the page title and a 🍬 or 🍭 at the end of Finished (nothing seasonal saved, no bat); Nov 1: neither',
    hwOn.on && /🎃/u.test(hwOn.pumpkin) && !hwOn.bats && /^✓ Finished Priya S\. at .* on the Desk\. [🍬🍭]$/u.test(treatNote) && /finishedAtIso/.test(hwSaved) && !/[🎃🍬🍭🦇]/u.test(hwSaved)
      && !hwOff.on && !/🎃/u.test(hwOff.pumpkin) && /on the Desk\.$/.test(plainNote),
    `${JSON.stringify(hwOn)} · ${treatNote} · ${JSON.stringify(hwOff)} · ${plainNote}`);

  // ===== 19. Orange on the showsheet = "Backup apps welcome", still on the market (production iPad v1.29, D49). The seed's 2040 #1207
  // is orange on the published showsheet; 2050 #2203 is red (App pending). =====
  tag = 'backup-apps';
  const bk = await ctx.newPage();
  bk.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|sw\.js|ServiceWorker/i.test(m.text())) errors.push(`${tag}: console: ${m.text().split('\n')[0]}`); });
  bk.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
  bk.on('dialog', d => d.accept().catch(() => {}));
  await bk.addInitScript(() => { window.__SEED_OPTS = {}; try { localStorage.clear(); } catch (e) {} });
  await bk.setViewportSize({ width: 820, height: 1180 });
  await bk.goto('https://ipad.test/tour-companion/'); await bk.waitForTimeout(900);
  const rowFlags = n => bk.evaluate(k => { const r = [...document.querySelectorAll('#list .unit')].find(x => x.querySelector('.unit-num') && x.querySelector('.unit-num').firstChild.textContent.trim() === '#' + k);
    return r ? `${r.classList.contains('app') ? 'pink' : r.classList.contains('backup') ? 'orange' : 'plain'} ${getComputedStyle(r).backgroundColor}|${[...r.querySelectorAll('.flag.pending, .flag.backup')].map(f => f.textContent.trim()).join(',')}` : 'not listed'; }, n);
  const b1207 = await rowFlags('1207'), b2203 = await rowFlags('2203');
  await bk.click('#chips .chip:has-text("No app")'); await bk.waitForTimeout(200);
  const noApp = { b1207: await rowFlags('1207'), b2203: await rowFlags('2203') };
  await bk.click('#chips .chip:has-text("All")'); await bk.waitForTimeout(200);
  check('Availability: the orange unit says "Backup apps welcome" on a light orange row and stays in the "No app" filter (on the market); red stays pink, App pending, and is filtered out',
    b1207 === 'orange rgb(255, 243, 224)|Backup apps welcome' && b2203 === 'pink rgb(255, 246, 246)|App pending' && noApp.b1207 === b1207 && noApp.b2203 === 'not listed', `${b1207} · ${b2203} · with No app: ${JSON.stringify(noApp)}`);
  await bk.click('#tab-tour'); await bk.waitForTimeout(300);
  await bk.click('button:has-text("New tour")'); await bk.waitForTimeout(250);
  await bk.fill('#tFirst', 'Bea'); await bk.click('#needBeds .chip:has-text("1 Bed")'); await bk.check('#needPriceFlex'); await bk.check('#needFlex');
  await bk.click('#guestDoneBtn'); await bk.waitForTimeout(300);
  const pickTag = await bk.evaluate(() => { const r = [...document.querySelectorAll('#pickerList .pick')].find(x => x.textContent.includes('#1207')); return r ? `${r.classList.contains('backup')}|${getComputedStyle(r.querySelector('.pt'), '::after').content}` : 'not in the picker'; });
  await bk.locator('#pickerList .pick', { hasText: '#1207' }).first().click(); await bk.waitForTimeout(300);
  const pickedTag = await bk.evaluate(() => { const r = document.querySelector('#pickerList .pick-added .pick.in'); return r ? `${r.classList.contains('backup')}|${getComputedStyle(r.querySelector('.pt'), '::after').content}` : 'not added'; });
  await bk.click('#takeRow button:has-text("Jun")'); await bk.waitForTimeout(200);
  await bk.click('#tStart'); await bk.waitForTimeout(800);
  const sumTag = await bk.evaluate(() => [...document.querySelectorAll('#tourSummary .flag.backup')].map(f => f.textContent.trim()).join(','));
  await bk.close();
  check('The unit picker says "· backup apps welcome" before and after the unit is added, and the started tour\'s summary flags it',
    /^true\|.*· backup apps welcome/.test(pickTag) && /^true\|.*· backup apps welcome/.test(pickedTag) && sumTag === 'Backup apps welcome', `${pickTag} · ${pickedTag} · summary "${sumTag}"`);
  const failed = steps.filter(s => !s.ok).length;
  return JSON.stringify({ passed: steps.length - failed, failed, steps, errors }, null, 1);
}
