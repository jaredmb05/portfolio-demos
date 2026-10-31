// Leasing Desk click-through of the TESTING.md Desk checklist — a Playwright CLI run-code function.
// Run it with tests/desk_flows.sh (fills __ROOT__ / __OUT__ and builds the Dropbox fixture files first).
// Same setup as desk_capture.js: the UNMODIFIED page at https://desk.test/, seeded fake Firestore, clock pinned to
// Tue Oct 6 2026, 2:10 PM New York time. Dropbox links are answered with __OUT__/fixture_showsheet.xlsx / fixture_floorplans.xlsx.
// Returns { passed, failed, steps: [{ step, ok, detail }], errors }.
async page => {
  const ROOT = '__ROOT__', OUT = '__OUT__';
  const ctx = page.context();
  const errors = [], steps = [];
  let tag = '';
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://desk.test' }).catch(() => {});
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
    // Dropbox shared links (first candidate tried is dl.dropboxusercontent.com)
    if (/dl\.dropboxusercontent\.com\/.*Fills\.xlsx/.test(u)) return route.fulfill({ path: OUT + '/fixture_fills.xlsx', contentType: 'application/octet-stream' });
    if (/dl\.dropboxusercontent\.com\/.*Showsheet\.xlsx/.test(u)) return route.fulfill({ path: OUT + '/fixture_showsheet.xlsx', contentType: 'application/octet-stream' });
    if (/dl\.dropboxusercontent\.com\/.*Floor_Plan_Master\.xlsx/.test(u)) return route.fulfill({ path: OUT + '/fixture_floorplans.xlsx', contentType: 'application/octet-stream' });
    return route.abort();
  });

  async function open(opts, beforeLoad) {   // beforeLoad: an extra init script (runs before the page's own scripts)
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push(`${tag}: console: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
    p.__dialogs = []; p.__dismiss = false;   // set p.__dismiss = true to answer the next dialogs with Cancel, p.__answer to type that into a prompt
    p.on('dialog', d => { p.__dialogs.push(d.message()); (p.__dismiss ? d.dismiss() : d.accept(d.type() === 'prompt' ? (p.__answer !== undefined ? p.__answer : d.defaultValue() || 'Alex') : undefined)).catch(() => {}); });
    await p.addInitScript(o => { window.__SEED_OPTS = o; try { localStorage.clear(); localStorage.setItem('ld_tourSeen', '1'); } catch (e) {} }, opts);
    if (beforeLoad) await p.addInitScript(beforeLoad);
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.goto('https://desk.test/desk/');
    await p.waitForTimeout(700);
    return p;
  }
  const check = (step, ok, detail) => steps.push({ step, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  const lastToast = p => p.evaluate(() => { const t = document.querySelector('.toast'); return t ? t.textContent.trim() : ''; });
  const waitToast = (p, re) => p.waitForFunction(r => { const t = document.querySelector('.toast.show'); return t && new RegExp(r).test(t.textContent); }, re.source, { timeout: 4000 }).then(() => true, () => false);
  const tab = async (p, label) => { await p.click(`#queueTabs button:has-text("${label}")`); await p.waitForTimeout(300); };
  const row = (p, text) => p.locator('#queueBody .queue-row', { hasText: text }).first();
  const tour = p => p.evaluate(() => Object.values(window.__STORE.tours).find(t => /^Testy/.test(t.prospect || '')) || null);

  // ===== 1. Page loads with the new build =====
  tag = 'load';
  let p = await open({ seedLocal: true });
  // The stamp is in two places: the footer, and the toolkitBuild field that publishShowsheet writes (js/showsheet.js)
  const stamps = await p.evaluate(async () => (document.getElementById('buildStamp').textContent + (await (await fetch('js/showsheet.js')).text())).match(/Build v\d+\.\d+/g) || []);
  check('Footer shows Build v1.37 (both copies)', stamps.length >= 2 && stamps.every(s => s === 'Build v1.37'), stamps.join(', '));
  check('Footer text is visible on the page', await p.locator('#buildStamp').isVisible(), await p.locator('#buildStamp').textContent());
  check('Help says which templates are editable (App Confirmation / Lease Approval are not)', await p.evaluate(() => { const t = document.getElementById('helpModal').textContent; return !/Every template is editable/.test(t) && /Application Confirmation and Lease Approval aren.t templates/.test(t); }));

  // ===== 1b. Upload by keyboard → "Not on the iPads yet" → Publish clears it =====
  tag = 'publish-warning';
  check('Showsheet card starts green: "Published to iPads…"', await p.locator('#ssMeta .meta-line.pub').isVisible() && await p.locator('#ssCard.ok').count() === 1);
  let reached = false;
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < 25 && !reached; i++) { await p.keyboard.press('Tab'); reached = await p.evaluate(() => !!document.activeElement && document.activeElement.matches('#ssCard .file-input')); }
  check('Tab reaches the showsheet "Upload .xlsx" button', reached);
  check('…and its label shows a focus ring', reached && await p.evaluate(() => getComputedStyle(document.querySelector('#ssCard label.btn')).outlineStyle) === 'solid');
  await p.setInputFiles('#ssCard .file-input', OUT + '/fixture_showsheet.xlsx'); await p.waitForTimeout(600);
  const unpubText = await p.locator('#ssMeta .meta-line.unpub').textContent().catch(() => '');
  check('After a new upload the card warns "Not on the iPads yet"', /Not on the iPads yet/.test(unpubText) && await p.locator('#ssCard.warn').count() === 1, unpubText);
  check('…and Publish to iPads becomes the main button', await p.evaluate(() => document.getElementById('ssPublishBtn').classList.contains('primary')));
  for (const w of [1440, 1280]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(150); await p.locator('.status-strip').screenshot({ path: `${OUT}/unpublished-warning@${w}.png`, animations: 'disabled' }); }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.click('#ssPublishBtn'); await p.waitForTimeout(800);
  check('Publishing clears the warning (green line back)', await p.locator('#ssMeta .meta-line.pub').isVisible() && await p.locator('#ssMeta .meta-line.unpub').count() === 0 && !(await p.evaluate(() => document.getElementById('ssPublishBtn').classList.contains('primary'))));
  const shown = await waitToast(p, /Published 3 units/);
  if (shown) { await p.click('#toast'); await p.waitForTimeout(350); }
  check('Clicking a message dismisses it', shown && await p.evaluate(() => !document.querySelector('.toast.show')));
  await p.close();
  p = await open({ seedLocal: true });

  // ===== 1c. "Next up" skips anyone on a tour; starting with a busy assistant asks first =====
  tag = 'busy';
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  const busyNames = await p.evaluate(async () => { const imp = f => import(new URL(f, location.href).href); const { busyNow } = await imp('../shared/rotation.js'); const { queueRows } = await imp('js/queue.js'); return Object.keys(busyNow(queueRows)); });
  const nextLabel = (await p.textContent('#queueTabs button[data-tab="rotation"]')).match(/next: (\w+)/);
  check('Rotation "next up" is not someone on a tour', nextLabel && busyNames.length && !busyNames.includes(nextLabel[1]), `next: ${nextLabel && nextLabel[1]} · on a tour: ${busyNames.join(', ')}`);
  const daniel = row(p, 'Daniel R.');
  const rosaOpt = await daniel.locator('select.queue-assign option[value="Rosa"]').textContent();
  check('Waiting-row dropdown says who is on a tour', /on a tour · back ~/.test(rosaOpt), rosaOpt);
  await daniel.locator('select.queue-assign').selectOption('Rosa'); await p.waitForTimeout(500);
  p.__dismiss = true; p.__dialogs.length = 0;
  await row(p, 'Daniel R.').locator('button:has-text("Start tour")').click(); await p.waitForTimeout(500);
  p.__dismiss = false;
  const dan = await p.evaluate(() => Object.values(window.__STORE.tours).find(t => t.prospect === 'Daniel R.'));
  check('Start with a busy assistant asks first; Cancel leaves the tour waiting', /Rosa is still on a tour with Priya S\./.test(p.__dialogs[0] || '') && !dan.startedAtIso, (p.__dialogs[0] || 'no dialog').split('\n')[0]);

  // ===== 2. + Plan tour → Send & pick units → Save units to tour =====
  tag = 'plan';
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(200);
  check('Plan tour opens with focus on first name', await p.evaluate(() => document.activeElement && document.activeElement.id) === 'planFirst');
  await p.fill('#planFirst', 'Testy'); await p.fill('#planProspect', 'Q');
  await p.selectOption('#planAssistant', 'Nadia');
  await p.check('#planBeds input[value="1 Bed"]'); await p.fill('#planMin', '3800'); await p.fill('#planMax', '4500'); await p.check('#planFlex');   // required since production v1.34 (D45)
  await p.click('#planSubmitPick'); await p.waitForTimeout(800);
  let t = await tour(p);
  check('Send & pick units puts the tour in the queue (Firestore doc written)', t && t.queuedAtIso && t.assistant === 'Nadia', t && `${t.prospect} · ${t.assistant} · queued ${!!t.queuedAtIso}`);
  check('Plan strip is showing for the picked tour', await p.locator('#planStrip').isVisible());
  await p.click('.unit-row[data-key="2050 TIDEMARK BLVD::1812"] .unit-info'); await p.waitForTimeout(400);
  await p.click('#planStrip button:has-text("Save units to tour")'); await p.waitForTimeout(800);
  t = await tour(p);
  check('Save units to tour stores the unit on the tour', t && (t.stops || []).some(s => String(s.unit) === '1812'), t && (t.stops || []).map(s => s.unit).join(','));

  // ===== 3. Queue → Start → Finish =====
  tag = 'queue';
  await tab(p, 'Current Queue');
  check('Tour appears under Waiting in Current Queue', await row(p, 'Testy').isVisible());
  await row(p, 'Testy').locator('button:has-text("Start tour")').click(); await p.waitForTimeout(700);
  t = await tour(p);
  check('Start tour sets startedAtIso + assistant', t && t.startedAtIso && t.assistant === 'Nadia', t && t.startedAtIso);
  check('Started tour moves to "On tour now"', await p.evaluate(() => { const secs = [...document.querySelectorAll('#queueBody .queue-section')]; const on = secs.find(s => /On tour now/.test(s.textContent)); if (!on) return false; let n = on.nextElementSibling; while (n && !n.classList.contains('queue-section')) { if (/Testy/.test(n.textContent)) return true; n = n.nextElementSibling; } return false; }));
  await row(p, 'Testy').locator('button:has-text("Finish")').click(); await p.waitForTimeout(900);
  t = await tour(p);
  check('Finish sets finishedAtIso', t && t.finishedAtIso, t && t.finishedAtIso);

  // ===== 4. Follow-Ups to Send → ✓ Mark sent =====
  tag = 'followup';
  await tab(p, 'Follow-Ups to Send');
  check('Finished tour appears in Follow-Ups to Send', await row(p, 'Testy').isVisible());
  await row(p, 'Testy').locator('button:has-text("Mark sent")').click();
  const fuToast = await waitToast(p, /Marked Testy.*Check-In/);
  await p.waitForTimeout(700);
  t = await tour(p);
  check('✓ Mark sent records followUpSentAtIso and says where it went', t && t.followUpSentAtIso && fuToast, await lastToast(p));

  // ===== 5. Leasing Manager Check-In → Copy check-in → ✓ Mark sent =====
  tag = 'checkin';
  await tab(p, 'Leasing Manager Check-In');
  check('Tour appears in Leasing Manager Check-In', await row(p, 'Testy').isVisible());
  await row(p, 'Testy').locator('button:has-text("Copy check-in")').click(); await p.waitForTimeout(400);
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
  check('Copy check-in puts the check-in email on the clipboard', /Testy/.test(clip), clip.slice(0, 80).replace(/\s+/g, ' '));
  await row(p, 'Testy').locator('button:has-text("Mark sent")').click(); await p.waitForTimeout(900);
  t = await tour(p);
  check('Check-in ✓ Mark sent records checkInSentAtIso', t && t.checkInSentAtIso, t && t.checkInSentAtIso);

  // ===== 6. History shows it; Undo works =====
  tag = 'history';
  await tab(p, 'History'); await p.waitForTimeout(300);
  const hist = p.locator('#queueBody .queue-row', { hasText: 'Testy' });
  check('History lists the tour', await hist.count() > 0, await hist.count() + ' row(s)');
  const undoCheckin = hist.locator('button:has-text("Undo check-in")').first();
  check('History offers ↩ Undo check-in', await undoCheckin.count() > 0);
  if (await undoCheckin.count()) { await undoCheckin.click(); await p.waitForTimeout(900); }
  t = await tour(p);
  check('Undo check-in clears checkInSentAtIso', t && !t.checkInSentAtIso);
  await tab(p, 'Leasing Manager Check-In');
  check('Tour is back in Leasing Manager Check-In after Undo', await row(p, 'Testy').isVisible());
  await tab(p, 'History'); await p.waitForTimeout(300);
  const undoFu = p.locator('#queueBody .queue-row', { hasText: 'Testy' }).locator('button:has-text("Undo follow-up")').first();
  if (await undoFu.count()) { await undoFu.click(); await p.waitForTimeout(900); }
  t = await tour(p);
  check('Undo follow-up clears followUpSentAtIso (tour back in Follow-Ups)', t && !t.followUpSentAtIso);

  // ===== 7. Wait estimate + Rotation =====
  tag = 'wait';
  await tab(p, 'Current Queue');
  const est1 = await p.textContent('#waitValue');
  const apptBtn = p.locator('#queueBody .wp-appt button, #queueBody .wp-seg button').nth(2);
  if (await apptBtn.count()) { await apptBtn.click(); await p.waitForTimeout(500); }
  const est2 = await p.textContent('#waitValue');
  check('Appointment buttons in a wait panel change the estimate', (await apptBtn.count()) && est1 !== est2, `${est1.trim()} → ${est2.trim()}`);
  await tab(p, 'Rotation');
  const outBtn = p.locator('#queueBody button:has-text("Mark out")').first();
  check('Rotation shows Mark out buttons', await outBtn.count() > 0);

  // ===== 8. Future Move-Ins: + Add future lead, Add to Outlook =====
  tag = 'future';
  await tab(p, 'Future Move-Ins');
  check('A toured prospect with a far move-in is captured', await p.locator('#queueBody').textContent().then(s => /Elena|Grace|Priya|Daniel|Aisha|Tom|Ben|Clara/.test(s)));
  await p.click('#queueBody button:has-text("+ Add future lead")'); await p.waitForTimeout(150);
  await p.fill('#flFirst', 'Futura'); await p.fill('#flInit', 'Z'); await p.fill('#flMoveIn', '2027-01-15');
  await p.click('#queueBody button:has-text("Add lead")');
  const flToast = await waitToast(p, /Futura Z\. added — follow up Dec 16/);
  await p.waitForTimeout(500);
  check('+ Add future lead saves it with follow-up 30 days before move-in', flToast, await lastToast(p));
  const flRow = p.locator('#queueBody .queue-row', { hasText: 'Futura' }).first();
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), flRow.locator('button:has-text("Add to Outlook")').click()]);
  let ics = '', name = '';
  if (dl) { name = dl.suggestedFilename(); try { const st = await dl.createReadStream(); for await (const c of st) ics += c; } catch (e) { ics = 'unreadable: ' + e.message; } }
  check('Add to Outlook downloads a calendar file', dl && /\.ics$/.test(name), name);
  check('…dated Dec 16, 9:30 AM, with a reminder', /BEGIN:VCALENDAR/.test(ics) && /DTSTART:20261216T093000/.test(ics) && /BEGIN:VALARM/.test(ics), (ics.match(/DTSTART:\S+/) || [ics.slice(0, 60)])[0]);
  // Copy follow-up (production v1.31, D39): the follow-up email built from the lead, to paste into a reply on their Outlook
  // thread; copying writes nothing, so the lead isn't marked contacted
  const flWrites = await p.evaluate(() => window.__W.length);
  await flRow.locator('button:has-text("Copy follow-up")').click(); await p.waitForTimeout(400);
  const flClip = await p.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
  await p.locator('#queueBody .queue-row', { hasText: 'Ana P.' }).first().locator('button:has-text("Copy follow-up")').click(); await p.waitForTimeout(400);
  const anaClip = await p.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
  const flAfter = await p.evaluate(() => { const ls = Object.values(window.__STORE.future_leads); const st = n => (ls.find(l => l.name === n) || {}).status;
    return { futura: st('Futura Z.'), ana: st('Ana P.'), writes: window.__W.length, buttons: document.querySelectorAll('#queueBody button[onclick^="flCopy"]').length, open: ls.filter(l => l.status === 'open').length,
      anaHint: ((document.evaluate('.//div[contains(@class,"queue-row")][contains(., "Ana P.")]', document.getElementById('queueBody'), null, 9, null).singleNodeValue || {}).textContent || '').replace(/\s+/g, ' ') }; });
  check('Copy follow-up on every open lead (none on a lead already done), next to Add to Outlook', flAfter.buttons === flAfter.open && flAfter.open >= 3, `${flAfter.buttons} buttons · ${flAfter.open} open leads`);
  check('Copy follow-up (a lead added by hand): "Hi Futura", when we spoke on the day it was added, the move-in date, no size asked for',
    /^Hi Futura,/.test(flClip.trim()) && /When we spoke on October 6, you mentioned you were planning to move in around January 15\./.test(flClip) && /still looking\. I'd be happy to send over current availability/.test(flClip), flClip.replace(/\s+/g, ' ').slice(0, 240));
  check('Copy follow-up (a toured prospect): when you toured with us, the move-in date and the size they asked for; no price or unit number; the row says where to find their thread',
    /^Hi Ana,/.test(anaClip.trim()) && /When you toured with us on August 17, you mentioned you were planning to move in around October 16\./.test(anaClip) && /still looking for a 2 bedroom\./.test(anaClip) && !/\$|#/.test(anaClip)
    && /Outlook: search "Ana" around Aug 17/.test(flAfter.anaHint), `${anaClip.replace(/\s+/g, ' ').slice(0, 240)} · row: ${(flAfter.anaHint.match(/Outlook: search[^·]*?\d+/) || ['no hint'])[0]}`);
  check('Copying doesn\'t mark either lead contacted (nothing saved)', flAfter.futura === 'open' && flAfter.ana === 'open' && flAfter.writes === flWrites, `${flAfter.futura} / ${flAfter.ana} · writes ${flWrites} → ${flAfter.writes}`);
  await p.close();

  // ===== 9. Dropbox sync on: Sync now (stubbed Dropbox) =====
  tag = 'dropbox';
  p = await open({ seedLocal: true, dbx: true });
  check('With sync on, the Sync now button shows and Upload is hidden', await p.locator('#dbxSyncBtn').isVisible() && !(await p.locator('.status-strip button:has-text("Publish to iPads")').first().isVisible().catch(() => false)));
  await p.click('#dbxSyncBtn');
  const synced = await waitToast(p, /Synced from Dropbox — 3 units, 2 floor plans/);
  check('Sync now loads the Dropbox files (3 units, 2 floor plans)', synced, await lastToast(p));
  check('…and Floor Plan Links names the synced file', /^Floor_Plan_Master\.xlsx · /.test(await p.textContent('#fpMeta')), await p.textContent('#fpMeta'));
  await p.waitForTimeout(600);
  const pub = await p.evaluate(() => { const c = window.__STORE.showsheet.current; return c && `${c.unitCount} units · ${c.floorPlanCount} plans · by ${c.publishedBy}`; });
  check('…and publishes them to the iPads', /^3 units/.test(pub || ''), pub);
  check('Showsheet card shows the new count', /3 units loaded/.test(await p.locator('.status-strip').textContent()));
  await p.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 8000 }).catch(() => {});
  await p.click('#dbxSyncBtn');
  const nochg = await waitToast(p, /No changes found in Dropbox/);
  check('Sync now again with the same files says "No changes found"', nochg, await lastToast(p));
  await p.close();

  // ===== 10. Email Builder: "Other concession" on a 24-month unit starts at its lease term =====
  tag = 'other-concession';
  p = await open({ seedLocal: true });
  await p.click('.unit-row[data-key="2230 TIDEMARK BLVD::4201"] .unit-info'); await p.waitForTimeout(400);
  await p.locator('label.cbx', { hasText: 'Other concession' }).locator('input').check(); await p.waitForTimeout(300);
  const termField = await p.locator('input[oninput*="otherTerm"]').inputValue();
  await p.selectOption('select[onchange*="otherFree"]', '1'); await p.waitForTimeout(300);
  const preview = (await p.textContent('#preview')).replace(/\s+/g, ' ');
  check('"Other concession" on a 24-month unit starts at 24 months: "1 month free on a 24-month lease", $8,577', termField === '24' && /1 month free on a 24-month lease/.test(preview) && /Net Effective: \$8,577/.test(preview),
    `term field ${termField} · ${(preview.match(/Concession:.{0,60}/) || [''])[0]} · ${(preview.match(/Net Effective: \$[\d,]+/) || ['no net'])[0]}`);
  await p.close();

  // ===== 11. Template editor: the Tour and Inquiry Opening Lines reach the email (B3) =====
  tag = 'opening-line';
  p = await open({ seedLocal: true });
  const previewText = () => p.evaluate(() => document.getElementById('preview').innerText.replace(/\s+/g, ' '));
  await p.evaluate(() => {
    openTemplateEditor();
    document.getElementById('tplTourOpening').value = 'Great meeting you at Tidemark today!';
    document.getElementById('tplInquiryOpening').value = 'Thanks for reaching out about Tidemark!';
    saveTemplate();
  });
  await p.waitForTimeout(300);
  const tourText = await previewText();
  check('A saved Tour Opening Line shows in the tour email right after Save', /Great meeting you at Tidemark today!/.test(tourText), tourText.slice(0, 140));
  await p.evaluate(() => setMode('inquiry')); await p.waitForTimeout(300);
  const inquiryText = await previewText();
  check('A saved Inquiry Opening Line shows in the inquiry email', /Thanks for reaching out about Tidemark!/.test(inquiryText) && !/\{unit\}|\{building\}/.test(inquiryText), inquiryText.slice(0, 140));
  await p.close();

  // ===== 12. Hostile shared data: quotes and markup stay text, links stay http(s) (B4) =====
  tag = 'hostile';
  p = await open({ seedLocal: true, hostile: true });
  await p.locator('.unit-row', { hasText: '__pwned' }).first().locator('.unit-info').click(); await p.waitForTimeout(300);   // its card's handlers carry the unit key
  await p.click('.unit-row[data-key="2050 TIDEMARK BLVD::506"] .unit-info'); await p.waitForTimeout(300);                      // its floor plan link is javascript:
  const pickedUnits = await p.evaluate(async () => (await import(new URL('js/state.js', location.href).href)).state.selectedUnits.map(s => s.unit));
  await p.locator('#queueBody .queue-row', { hasText: 'Hostile H.' }).first().locator('button').first().click(); await p.waitForTimeout(300);
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; toggleReports(); });
  await p.waitForTimeout(900);
  await p.locator('#rpt-quiz .queue-row', { hasText: 'Hostile' }).first().locator('button:has-text("Details")').click(); await p.waitForTimeout(200);
  const hostile = await p.evaluate(() => ({
    pwned: window.__pwned || '',
    elements: [...document.querySelectorAll('[id^="pwn"], [onmouseover], [onerror]')].map(e => e.outerHTML.slice(0, 80)),
    links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && !/^(https?:|mailto:|tel:|#)/i.test(h)),
  }));
  check('Hostile data: no markup from shared fields, nothing runs, no non-http(s) links (B4)', !hostile.pwned && !hostile.elements.length && !hostile.links.length, JSON.stringify(hostile));
  check('Hostile data: the unit with quotes in its number can still be picked', pickedUnits.some(u => /__pwned/.test(u)), JSON.stringify(pickedUnits));
  check('Hostile data: no page errors from the handlers', !errors.some(e => e.startsWith('hostile')), errors.filter(e => e.startsWith('hostile')).join(' | '));
  await p.close();

  // ===== 13. History when the database can't be reached: a message, not "Loading…" forever (B5) =====
  tag = 'history-offline';
  p = await open({ seedLocal: true, offline: true });
  await tab(p, 'History'); await p.waitForTimeout(600);
  const histMsg = (await p.textContent('#queueBody')).replace(/\s+/g, ' ').trim();
  check('History says it couldn\'t load when the database can\'t be reached (B5)', !/Loading history/.test(histMsg) && /Couldn't load history/.test(histMsg), histMsg.slice(0, 160));
  check('…with no unhandled error', !errors.some(e => e.startsWith('history-offline: page error')), errors.filter(e => e.startsWith('history-offline')).join(' | '));
  // Expected while offline: the fake database's own "can't reach" messages. Anything else stays in the error list.
  for (let i = errors.length - 1; i >= 0; i--) if (/^history-offline: console: .*(Failed to get documents from server|Could not reach Cloud Firestore backend|Error: offline)/.test(errors[i])) errors.splice(i, 1);
  await p.close();

  // ===== 14. "Sending to a broker" switch: one per email, sets every unit's broker terms (production v1.20) =====
  tag = 'broker-switch';
  p = await open({ seedLocal: true });
  const conc = unit => p.evaluate(async u => {
    const imp = f => import(new URL(f, location.href).href);
    const { state } = await imp('js/state.js'), { resolveConcession } = await imp('../shared/pricing.js');
    const r = resolveConcession(state.selectedUnits.find(x => x.unit === u)); return `${r.text}|${r.netEff === null ? '' : r.netEff}`;
  }, unit);
  const pick = async key => { await p.click(`.unit-row[data-key="${key}"] .unit-info`); await p.waitForTimeout(300); };
  check('Broker switch: there, and off by default', await p.locator('#emailBrokerChk').isVisible() && !(await p.isChecked('#emailBrokerChk')));
  await pick('2050 TIDEMARK BLVD::1812'); await pick('2050 TIDEMARK BLVD::2901');
  const off1 = await conc('1812'), off2 = await conc('2901');
  check('Switch off: OR unit → free month + net; AND unit → free month + net, OP hidden', off1 === '1 Month Free|3804' && off2 === '1 Month Free|5913', `${off1} · ${off2}`);
  await p.check('#emailBrokerChk'); await p.waitForTimeout(300);
  const on1 = await conc('1812'), on2 = await conc('2901');
  check('Switch on: OR unit → the OP, no net; AND unit → free month and OP + net', on1 === '1 Mo. OP|' && on2 === '1 Month Free and 1/2 Mo. OP|5913', `${on1} · ${on2}`);
  check('Switch on: the email says "Concession: 1 Mo. OP"', /Concession:<\/strong> 1 Mo\. OP</.test(await p.innerHTML('#preview')));
  await pick('2230 TIDEMARK BLVD::1509');
  check('Switch on: a unit picked afterwards follows it', (await conc('1509')) === '1 Mo. OP|', await conc('1509'));
  await p.uncheck('#emailBrokerChk'); await p.waitForTimeout(300);
  check('Switch off again: back to the prospect version', (await conc('1812')) === '1 Month Free|3804' && (await conc('1509')) === '1 Month Free|3662', await conc('1509'));
  // A unit whose only concession is an OP (the seed has none, so #1812 is turned into one) (production v1.20)
  await p.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const { state } = await imp('js/state.js'), { brokerDefaults } = await imp('js/rules/tour-selection.js');
    const s = state.selectedUnits.find(x => x.unit === '1812'); s.incentive = '1 Mo. OP'; s.netEff = null; Object.assign(s, brokerDefaults(s, false));
    (await imp('js/unit-list.js')).renderUnitList(); (await imp('js/email-builder.js')).renderPreview();
  });
  await p.waitForTimeout(200);
  const opOnlyCard = (await p.locator('.inline-editor', { hasText: '1 Mo. OP' }).first().textContent()).replace(/\s+/g, ' ');
  check('OP-only unit, no broker: the email leaves the concession out (and the card says why)', (await conc('1812')) === '|' && /leaves the concession out/.test(opOnlyCard), `${await conc('1812')} · ${opOnlyCard.slice(0, 120)}`);
  await p.check('#emailBrokerChk'); await p.waitForTimeout(300);
  check('OP-only unit, sending to a broker: "1 Mo. OP"', (await conc('1812')).startsWith('1 Mo. OP|'), await conc('1812'));
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(300);
  check('Reset turns the switch off', !(await p.isChecked('#emailBrokerChk')));
  // No concession guardrails (production D23): a unit with "No Incentive" can still be given one, and the net follows.
  // The credit is quoted, not taken off the net (D19).
  await pick('2050 TIDEMARK BLVD::506');
  await p.locator('label.cbx', { hasText: 'Other concession' }).locator('input').check(); await p.waitForTimeout(300);
  await p.selectOption('select[onchange*="otherFree"]', '1'); await p.waitForTimeout(200);
  await p.fill('input[oninput*="otherCredit"]', '500'); await p.waitForTimeout(300);
  check('No-incentive unit: Other concession works (1 month free + $500 credit → net $3,020, credit quoted)', (await conc('506')) === '1 month free on a 12-month lease plus a $500 one-time credit|3020', await conc('506'));
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  // Plan a tour with a broker → Send & pick units → the switch comes on
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(200);
  await p.fill('#planFirst', 'Brokie'); await p.check('#planBroker'); await p.fill('#planBrokerLast', 'Cohen');
  await p.check('#planBeds input[value="1 Bed"]'); await p.check('#planPriceFlex'); await p.check('#planFlex');   // required since production v1.34 (D45)
  await p.click('#planSubmitPick'); await p.waitForTimeout(800);
  check('Plan tour with a broker → picking units turns the switch on', await p.isChecked('#emailBrokerChk'));
  await pick('2120 TIDEMARK BLVD::906');
  check('…and the picked unit quotes the OP', (await conc('906')) === '1 Mo. OP|', await conc('906'));
  await p.click('#planStrip button:has-text("✕")').catch(() => {}); await p.waitForTimeout(200);
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  await p.evaluate(() => setQueueTab('followup')); await p.waitForTimeout(300);
  await p.locator('#queueBody .queue-row', { hasText: 'Tom W.' }).locator('button:has-text("Open")').click(); await p.waitForTimeout(800);
  check('Opening a broker tour turns the switch on', await p.isChecked('#emailBrokerChk'));
  await p.close();

  // ===== 15. Today's totals on the Rotation tab, managers only (production v1.20) =====
  tag = 'today-totals';
  p = await open({ seedLocal: true });
  await p.evaluate(() => document.getElementById('queuePanel').classList.add('open'));
  await tab(p, 'Rotation');
  check('Today\'s totals are hidden while the manager PIN is locked', !/Today's totals/.test(await p.textContent('#queueBody')));
  const rowText = async (t, who) => { await tab(p, t); return p.evaluate(w => [...document.querySelectorAll('#queueBody .queue-row')].map(r => r.textContent.replace(/\s+/g, ' ')).find(x => x.includes(w)) || '', who); };
  const lockedLive = await rowText('Current Queue', 'Priya S.'), lockedDone = await rowText('Follow-Ups', 'Grace H.');
  check('Locked: a tour in progress shows only its start, a finished one no length', /In progress · since 1:45 PM/.test(lockedLive) && !/took/.test(lockedDone), lockedLive.slice(0, 120));
  await tab(p, 'Rotation');
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; renderTourQueue(); });
  await p.waitForTimeout(300);
  const totals = await p.evaluate(() => {
    const t = document.querySelector('#queueBody .totals-table'); if (!t) return null;
    const today = new Date().toDateString(), s = Object.values(window.__STORE.tours).filter(r => r.assistant && r.startedAtIso && new Date(r.startedAtIso).toDateString() === today);
    return { team: [...t.querySelectorAll('tr.team td')].map(td => td.textContent.trim()),
      expected: [s.filter(r => r.kind !== 'inspection').length, s.filter(r => r.kind === 'inspection').length, s.length, s.filter(r => !r.finishedAtIso).length, s.filter(r => r.finishedAtIso).length].map(String) };
  });
  check('Unlocked: Today\'s totals per assistant, with a Team row matching today\'s tours and inspections', !!totals && JSON.stringify(totals.team) === JSON.stringify(totals.expected), JSON.stringify(totals));
  const live = await rowText('Current Queue', 'Priya S.'), done = await rowText('Follow-Ups', 'Grace H.');
  check('Unlocked: a tour in progress shows how long it has been going, a finished one how long it took (production v1.22)', /In progress · 25 min since 1:45 PM/.test(live) && /took 40 min/.test(done), `${live.slice(0, 80)} | ${done.slice(0, 80)}`);
  await tab(p, 'Rotation');
  await p.close();

  // ===== 16. Hand-added unit: building + unit number fill in the floor plan link while typing =====
  tag = 'custom-unit';
  p = await open({ seedLocal: true });
  await p.evaluate(() => addCustomUnit()); await p.waitForTimeout(300);
  await p.selectOption('select[onchange*="\'building\'"]', '2050 TIDEMARK BLVD');
  await p.fill('input[oninput*="\'unit\'"]', '1812'); await p.waitForTimeout(200);
  const customFp = await p.evaluate(async () => {
    const { state } = await import(new URL('js/state.js', location.href).href);
    return { box: document.querySelector('input[oninput*="floorPlan"]').value, saved: state.selectedUnits.find(s => s.custom).floorPlan };
  });
  const selLine = (await p.textContent('#selSummary')).replace(/\s+/g, ' ').trim();
  check('Hand-added unit: "Selected for this email" shows the number while it is typed (production v1.20)', /#1812/.test(selLine), selLine);
  check('Hand-added unit: the floor plan box fills in from the floor plan list as the unit is typed', /^https:/.test(customFp.saved) && customFp.box === customFp.saved, JSON.stringify(customFp));
  await p.close();

  // ===== 17. The team list decides who is in today: a removed assistant leaves the rotation (production v1.24, D27) =====
  tag = 'removed-assistant';
  p = await open({ seedLocal: true });
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  const rotNow = () => p.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const [{ busyNow, rotationStats, suggestNext }, { queueRows }, { team }, { estimateWait }] = await Promise.all(['../shared/rotation.js', 'js/queue.js', '../shared/team.js', '../shared/wait-estimate.js'].map(imp));
    const rot = rotationStats(queueRows, team.assistants);
    return { order: rot.order.map(x => x.name), list: rot.list.map(x => x.name), next: suggestNext(rot, busyNow(queueRows)),
      lanes: (estimateWait(queueRows, rot.order.map(x => x.name), rot.out).lanes || []).map(l => l.name),
      wait: document.getElementById('waitValue').textContent, tabs: document.getElementById('queueTabs').textContent.replace(/\s+/g, ' ') };
  });
  // Marco: on the team, tours earlier this week, nothing today. The seed marks him out; bring him back in so he is next up.
  await p.evaluate(() => firebase.firestore().collection('settings').doc('availability').set({ byDate: {}, inByDate: {} }));
  await p.waitForTimeout(500);
  const r0 = await rotNow();
  // Marco leaves the team; so does Rosa, who is on a tour right now (Priya S.) and finished one this morning
  await p.evaluate(() => firebase.firestore().collection('settings').doc('assistants').set({ names: window.__STORE.settings.assistants.names.filter(x => x !== 'Marco' && x !== 'Rosa') }));
  await p.waitForTimeout(500);
  const r1 = await rotNow();
  check('Before: an assistant who is in today with nothing started is next up and a wait-estimate lane', r0.next === 'Marco' && r0.lanes.includes('Marco') && r0.tabs.includes('next: Marco'), `next ${r0.next} · lanes ${r0.lanes.join(', ')}`);
  check('Removed from the team list (Marco): not in today\'s rotation, not next up, not a wait-estimate lane, not "free"', !r1.order.includes('Marco') && r1.next !== 'Marco' && !r1.lanes.includes('Marco') && !r1.wait.includes('Marco') && !r1.tabs.includes('next: Marco'),
    `next ${r1.next} · lanes ${r1.lanes.join(', ')} · ${r1.wait.trim()}`);
  check('Removed but started a tour today (Rosa): still counted today and still a wait-estimate lane', r1.order.includes('Rosa') && r1.lanes.includes('Rosa'), r1.order.join(', '));
  check('Removed: still in the last-7-days list while they have tours in it', r1.list.includes('Marco'), r1.list.join(', '));
  await tab(p, 'Rotation');
  const rotTab = await p.evaluate(() => {
    const body = document.querySelector('#queueBody'), week = body.querySelector('table');   // locked: the first table is Last 7 days
    return { today: [...body.querySelectorAll('.queue-row .who')].map(w => w.textContent.trim()), week: week ? [...week.querySelectorAll('tr td:first-child')].map(td => td.textContent.trim()) : [] };
  });
  check('Rotation tab: the removed assistant has no row under Today; one who started a tour today does', rotTab.today.length && !rotTab.today.some(t => t.startsWith('Marco')) && rotTab.today.some(t => t.startsWith('Rosa')), rotTab.today.join(' | '));
  check('Rotation tab: the removed assistant is still in the Last 7 days table', rotTab.week.includes('Marco'), rotTab.week.join(', '));
  await p.close();

  // ===== 18. Bank statements: the two most recent, all pages (production v1.24, D27) =====
  tag = 'bank-statements';
  p = await open({ seedLocal: true });
  const bankLines = html => (html.match(/<li>[^<]*statement[^<]*<\/li>/gi) || []).join(' ');
  const appConf = (student, self) => p.evaluate(async ([st, se]) => { setMode('appconf'); document.getElementById('appConfStudent').checked = st; document.getElementById('appConfSelfEmployed').checked = se;
    return (await import(new URL('js/application-email.js', location.href).href)).buildAppConfHTML(); }, [student, self]);
  const lines = [await appConf(false, false), await appConf(false, true), await appConf(true, false)].map(bankLines);
  check('App Confirmation (employed / self-employed / student): two most recent statements, all pages',
    /Two most recent bank statements for your payroll account \(all pages\)/.test(lines[0]) && /Two most recent checking or savings account statements \(all pages\)/.test(lines[1]) && /Two most recent bank statements \(all pages\)/.test(lines[2]) && !/Most recent/.test(lines.join(' ')), lines.join(' · '));
  const tourReq = await p.evaluate(async () => { setMode('tour'); return (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML(); });
  check('Tour follow-up: the built-in requirements ask for two statements with proof of ownership, all pages', /<li>Two most recent bank statements with proof of ownership \(all pages\)<\/li>/.test(tourReq) && !/Bank Statements \(with proof/.test(tourReq), (tourReq.match(/<li>[^<]*bank[^<]*<\/li>/i) || ['no bank line'])[0]);
  await p.close();

  // ===== 19. A typed rent works the net effective out again (production v1.25, D28; ruling R1: the unit's lease term);
  //           2110 no longer puts the incentive on the last month (production D29) =====
  tag = 'net-effective';
  p = await open({ seedLocal: true });
  // The Net Effective line of one unit's block in the built email ('none' when the email leaves it out)
  const neIn = (unit) => p.evaluate(async u => {
    const html = (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML();
    const block = html.split('text-decoration:underline;">').find(b => b.includes('#' + u + '<')) || '';
    const m = block.match(/Net Effective: \$([\d,]+)/); return block ? (m ? m[1] : 'none') : 'no unit';
  }, unit);
  const rentBox = key => `.selected-card[data-sel-key="${key}"] input[oninput*="'monthly'"]`;
  const typeRent = async (key, v) => { await p.fill(rentBox(key), v); await p.waitForTimeout(150); };
  const K1812 = '2050 TIDEMARK BLVD::1812', K4201 = '2230 TIDEMARK BLVD::4201';
  await p.evaluate(() => setMode('tour'));
  await p.click(`.unit-row[data-key="${K1812}"] .unit-info`); await p.waitForTimeout(300);
  const ne12 = { sheet: await neIn('1812') };
  await typeRent(K1812, '3850'); ne12.changed = await neIn('1812');
  await typeRent(K1812, '4150'); ne12.back = await neIn('1812');
  check('Rent typed over (1 Month Free, no term written → 12 months): $3,850 → net $3,529; put back to $4,150 → the showsheet\'s $3,804',
    ne12.sheet === '3,804' && ne12.changed === '3,529' && ne12.back === '3,804', JSON.stringify(ne12));
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  await p.click(`.unit-row[data-key="${K4201}"] .unit-info`); await p.waitForTimeout(300);
  const ne24 = { sheet: await neIn('4201') };
  await typeRent(K4201, '8500'); ne24.changed = await neIn('4201');
  check('Rent typed over on a 24-month lease (2 Months Free on 24-Month Lease): $8,500 → net $7,792 over 24 months, not $7,083 over 12 (ruling R1)',
    ne24.sheet === '8,204' && ne24.changed === '7,792', JSON.stringify(ne24));
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  // A dollar credit only (the seed has none, so #906's showsheet text is changed to one; its NET EFF stays)
  const K906 = '2120 TIDEMARK BLVD::906';
  await p.evaluate(async () => { const { state } = await import(new URL('js/state.js', location.href).href); state.units.find(u => u.unit === '906').incentive = '$1,500 move-in credit'; renderUnitList(); });
  await p.click(`.unit-row[data-key="${K906}"] .unit-info`); await p.waitForTimeout(300);
  const noteState = () => p.evaluate(k => { const n = document.querySelector(`.selected-card[data-sel-key="${k}"] .ne-note`); if (!n) return 'missing';
    if (!window.__neNote) window.__neNote = n; return `${n.style.display === 'none' ? 'hidden' : 'shown'}${n === window.__neNote ? '' : ' (redrawn)'}`; }, K906);
  const credit = { before: await noteState(), sheetNe: await neIn('906') };
  await typeRent(K906, '3695'); credit.typedNe = await neIn('906'); credit.typed = await noteState();
  const noteText = (await p.textContent(`.selected-card[data-sel-key="${K906}"] .ne-note`)).trim();
  await typeRent(K906, '3895'); credit.backNe = await neIn('906'); credit.back = await noteState();
  check('A dollar credit only, rent typed: the email leaves the net effective out; put back: the showsheet\'s net returns',
    credit.sheetNe === '3,570' && credit.typedNe === 'none' && credit.backNe === '3,570', JSON.stringify(credit));
  check('…and the unit card says to use Other concession, shown and hidden in place while the rent is typed',
    credit.before === 'hidden' && credit.typed === 'shown' && credit.back === 'hidden' && /leaves out the net effective\. Use Other concession to quote one/.test(noteText), `${JSON.stringify(credit)} · ${noteText}`);
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  // A tour reopened from the queue whose rents were changed on the iPad (both stops are on today's showsheet)
  await p.evaluate(async () => {
    const { applyTour } = await import(new URL('js/plan-tour.js', location.href).href);
    applyTour('reopen-ne', [{ id: 'reopen-ne', prospect: 'Wren P.', prospectFirst: 'Wren', broker: false,
      stops: [{ building: '2050 TIDEMARK BLVD', unit: '1812', rent: '3850' }, { building: '2230 TIDEMARK BLVD', unit: '4201', rent: '8500' }] }]);
  });
  const re = { n1812: await neIn('1812'), n4201: await neIn('4201'), text: await p.evaluate(async () => (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML()) };
  check('A reopened tour with rents changed on the iPad shows the worked-out nets: $3,529 (12 months) and $7,792 (24 months)',
    re.n1812 === '3,529' && re.n4201 === '7,792' && !/1 Mo\. OP/.test(re.text), `${re.n1812} · ${re.n4201}`);
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  // 2110: no "applied to the last month" footnote in Tour or Inquiry emails
  await p.click('.unit-row[data-key="2110 TIDEMARK BLVD::2305"] .unit-info'); await p.waitForTimeout(300);
  const f2110 = [];
  for (const m of ['tour', 'inquiry']) f2110.push(await p.evaluate(async mode => { setMode(mode); const h = (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML();
    return { mode, unit: h.includes('#2305'), conc: /Concession:<\/strong> 1 Month Free</.test(h), lastMonth: /last month/i.test(h) }; }, m));
  check('2110 in a Tour or Inquiry follow-up: the concession, and no "applied to the last month" note', f2110.every(x => x.unit && x.conc && !x.lastMonth), JSON.stringify(f2110));
  // 2110 Lease Approval: Applied To defaults to the 2nd month like every building, and can still be changed
  await p.click('#modeApprovalBtn'); await p.selectOption('#apvBuilding', '2110 Tidemark Blvd'); await p.fill('#apvUnit', '2305'); await p.fill('#apvRent', '6150');
  await p.fill('#apvLeaseStart', '11152026'); await p.press('#apvLeaseStart', 'Tab'); await p.fill('#apvLeaseEnd', '11142027'); await p.press('#apvLeaseEnd', 'Tab');
  await p.check('#apvNextRentToggle'); await p.selectOption('#apvConcFrac', '1'); await p.waitForTimeout(200);
  const apvText = () => p.evaluate(() => document.getElementById('preview').innerText.replace(/\s+/g, ' '));
  const applied = await p.evaluate(() => { const sel = document.getElementById('apvConcMonth'); return { idx: sel.selectedIndex, label: sel.options[sel.selectedIndex].textContent, hint: sel.closest('div').querySelector('.label-hint').textContent }; });
  const apv1 = await apvText();
  check('Approval at 2110: Applied To defaults to the 2nd month (December 2026), the hint names no exception',
    applied.idx === 1 && applied.label === 'December 2026' && !/2110|last/i.test(applied.hint), `${applied.label} · hint ${applied.hint}`);
  check('…and the email applies the 1 month free to December 2026, not the last month (November 2027)', /applied to December 2026/.test(apv1) && !/November 2027/.test(apv1), (apv1.match(/With your .*? applied to \w+ \d{4}/) || ['no concession sentence'])[0]);
  await p.selectOption('#apvConcMonth', '2027-03'); await p.waitForTimeout(200);
  const apv2 = await apvText();
  check('…which can still be changed: March 2027 picked → the email applies it there', /applied to March 2027/.test(apv2), (apv2.match(/With your .*? applied to \w+ \d{4}/) || ['no concession sentence'])[0]);
  await p.close();

  // ===== 20. A date in AVAIL + NOTES → Occupied / Currently Undergoing Renovation (production Desk v1.26, D30) =====
  tag = 'occupancy';
  p = await open({ seedLocal: true });
  // The seed: #1104 (November 1, occupied), #3402 (October 15, being renovated), #4201 (December 1, nothing in its notes)
  const K1104 = '2050 TIDEMARK BLVD::1104', K3402 = '2050 TIDEMARK BLVD::3402';
  const flagsOf = keys => p.evaluate(ks => ks.map(k => [...document.querySelectorAll(`.unit-row[data-key="${k}"] .unit-flags .flag`)].map(f => f.textContent.trim())), keys);
  const seeded = await flagsOf([K1104, K3402, '2230 TIDEMARK BLVD::4201']);
  check('Desk unit list: "Occupied" and "Currently Undergoing Renovation" flags; nothing on a unit with a date and no such note',
    seeded[0].includes('Occupied') && seeded[1].includes('Currently Undergoing Renovation') && !seeded[2].some(f => /Occupied|Renovation/.test(f)), JSON.stringify(seeded));
  await p.evaluate(async () => { const { state } = await import(new URL('js/state.js', location.href).href); state.units.find(u => u.unit === '1104').hasApp = true; renderUnitList(); });
  const withApp = (await flagsOf([K1104]))[0];
  check('…shown right after App pending', withApp[0] === 'App pending' && withApp[1] === 'Occupied', withApp.join(' | '));
  await p.evaluate(async () => { const { state } = await import(new URL('js/state.js', location.href).href); state.units.find(u => u.unit === '1104').hasApp = false; renderUnitList(); });
  // Emails never mention it: the follow-up and the inquiry with both units, which still say when each is available
  await p.evaluate(() => setMode('tour'));
  await p.click(`.unit-row[data-key="${K1104}"] .unit-info`); await p.waitForTimeout(300);
  await p.click(`.unit-row[data-key="${K3402}"] .unit-info`); await p.waitForTimeout(300);
  const occMail = [];
  for (const m of ['tour', 'inquiry']) occMail.push(await p.evaluate(async mode => { setMode(mode); const h = (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML();
    return { mode, units: h.includes('#1104') && h.includes('#3402'), dates: /Available November 1, 2026/.test(h) && /Available October 15, 2026/.test(h), label: /Occupied|Renovation/i.test(h) }; }, m));
  check('Emails never mention it: Tour and Inquiry follow-ups with both units say only "Available <date>"', occMail.every(x => x.units && x.dates && !x.label), JSON.stringify(occMail));
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  // The real reader on invented NOTES (columns in another order: it goes by the header names), then Publish
  const read = await p.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const [{ parseShowsheet }, { state }] = await Promise.all([imp('js/showsheet.js'), imp('js/state.js')]);
    const H = ['UNIT', 'TYPE', 'SQ FT', 'VIEW', 'MONTHLY', 'NET EFF', 'INCENTIVE', 'AVAIL', 'NOTES'];
    const d = 46357;   // an Excel date (Dec 1, 2026)
    const notes = [['5101', d, 'Occupied - tenant out 11/30'], ['5102', d, 'reno, new kitchen'], ['5103', d, 'Newly renovated'], ['5104', d, 'Unoccupied'],
      ['5105', d, 'occupied; reno after move-out'], ['5106', d, ''], ['5107', '', 'Occupied'], ['5108', '', 'Reno in progress']];
    parseShowsheet([['2040 TIDEMARK BLVD'], ['1 BEDROOMS'], H].concat(notes.map(([u, a, n]) => [u, '1 Bed, 1 Bath', 700, 'River', 4000, 3667, '1 Month Free', a, n])), new Set());
    renderUnitList();
    const flags = k => [...document.querySelectorAll(`.unit-row[data-key="2040 TIDEMARK BLVD::${k}"] .unit-flags .flag`)].map(f => f.textContent.trim()).join(' | ');
    return { st: Object.fromEntries(state.units.map(u => [u.unit, u.availStatus || ''])), av: Object.fromEntries(state.units.map(u => [u.unit, u.avail])), flags: [flags('5101'), flags('5102'), flags('5103')] };
  });
  check('The reader: a date with "Occupied…" or "occupied; reno…" → occupied, "reno…" → being renovated; "Newly renovated", "Unoccupied" or no note → nothing',
    read.st['5101'] === 'occupied' && read.st['5102'] === 'reno' && read.st['5105'] === 'occupied' && !read.st['5103'] && !read.st['5104'] && !read.st['5106'], JSON.stringify(read.st));
  check('…no date: as before ("Occupied" note → Occupied, otherwise Immediately), no label', read.av['5107'] === 'Occupied' && read.av['5108'] === 'Immediately' && !read.st['5107'] && !read.st['5108'], `${read.av['5107']} · ${read.av['5108']}`);
  check('…and the unit list flags the units it read', /Occupied/.test(read.flags[0]) && /Currently Undergoing Renovation/.test(read.flags[1]) && !/Occupied|Renovation/.test(read.flags[2]), read.flags.join(' / '));
  await p.evaluate(() => publishShowsheet()); await p.waitForTimeout(800);
  const pubOcc = await p.evaluate(() => { const c = window.__STORE.showsheet.current || {}; const json = JSON.stringify(c);
    return { st: (c.units || []).filter(u => u.availStatus).map(u => `${u.unit}:${u.availStatus}`), notes: ['tenant out', 'new kitchen', 'move-out', 'Newly renovated', 'Unoccupied', 'Reno in progress'].filter(n => json.includes(n)) }; });
  check('Publish sends the label only, never the note text', pubOcc.st.join(',') === '5101:occupied,5102:reno,5105:occupied' && !pubOcc.notes.length, `${pubOcc.st.join(', ')} · note text found: ${pubOcc.notes.join(', ') || 'none'}`);
  await p.close();

  // ===== 21. Quiz Results (in Reports since production v1.28): a missed required sign-in question shows under its topic, "Sign-in" (production iPad v1.24, D31) =====
  tag = 'quiz-sign-in';
  p = await open({ seedLocal: true });
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; toggleReports(); });
  await p.waitForTimeout(900);
  const marco = p.locator('#rpt-quiz .queue-row', { hasText: 'Marco' }).first();
  const marcoSub = ((await marco.locator('.sub').textContent().catch(() => '')) || '').trim();
  await marco.locator('button:has-text("Details")').click(); await p.waitForTimeout(200);
  const marcoDetails = await p.evaluate(() => { const d = [...document.querySelectorAll('[id^="missed-"]')].find(e => e.style.display !== 'none'); return d ? d.textContent.replace(/\s+/g, ' ').trim() : ''; });
  check('Quiz Results: the seeded miss on the sign-in true/false question counts under "Sign-in"; Details show the question and the right answer',
    /Sign-in ×1/.test(marcoSub) && /fill in only their email address and hand the iPad back to you\.\s*Answered: False\s*Correct: True/.test(marcoDetails), `${marcoSub} · ${marcoDetails.slice(-160)}`);
  await p.close();

  // ===== 22. Lease assignments in App Confirmation and Lease Approval (production Desk v1.27, D32) =====
  tag = 'assignment';
  p = await open({ seedLocal: true });
  const aTxt = h => h.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
  const emailNow = () => p.evaluate(async () => (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML());
  const noteOf = id => p.evaluate(i => { const n = document.getElementById(i); return { text: n.textContent, warn: n.classList.contains('warn'), shown: n.offsetHeight > 0 }; }, id);
  await p.click('#modeAppConfBtn'); await p.waitForTimeout(150);
  await p.fill('#prospectName', 'Lindqvist'); await p.selectOption('#appConfBuilding', '2050 Tidemark Blvd'); await p.fill('#appConfUnit', '1812'); await p.fill('#appConfRent', '4150');
  await p.fill('#appConfMoveIn', '11012026'); await p.press('#appConfMoveIn', 'Tab'); await p.fill('#appConfDeadline', 'tomorrow 10:00 AM');
  const plainAc = await emailNow();
  await p.check('#appConfAssignToggle'); await p.waitForTimeout(100);
  await p.fill('#appConfLeaseEnd', '05312027'); await p.press('#appConfLeaseEnd', 'Tab'); await p.waitForTimeout(100);
  const acUnder = { html: await emailNow(), note: await noteOf('appConfAssignNote'), termOff: await p.isDisabled('#appConfLeaseTerm'), end: await p.inputValue('#appConfLeaseEnd') };
  check('App Confirmation, assignment under a year: "Lease assignment through May 31, 2027" + "delivered "as is"" in italics, no "1 year"; Lease Term greyed out',
    /Lease Term: Lease assignment through May 31, 2027 Please note: the apartment is delivered "as is"\./.test(aTxt(acUnder.html)) && /<em style="font-style:italic;">Please note: the apartment is delivered &quot;as is&quot;\.<\/em>/.test(acUnder.html)
      && !/Lease Term: 1 year/.test(aTxt(acUnder.html)) && acUnder.termOff && acUnder.end === 'May 31, 2027' && /Under a year/.test(acUnder.note.text) && !acUnder.note.warn,
    (aTxt(acUnder.html).match(/Move-in:.{0,140}/) || [''])[0] + ' · note: ' + acUnder.note.text);
  await p.fill('#appConfLeaseEnd', '10312027'); await p.press('#appConfLeaseEnd', 'Tab'); await p.waitForTimeout(100);
  const acYear = { html: await emailNow(), note: await noteOf('appConfAssignNote') };
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(150);
  const acSideways = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.evaluate(() => copyAsHTML()); const acCopyMsg = await waitToast(p, /must be prepped/);
  check('App Confirmation, one-year assignment (Nov 1 → Oct 31): no "as is"; amber reminder to prep and confirm 5 days before surrender, again after copying, never in the email',
    /Lease Term: Lease assignment through October 31, 2027/.test(aTxt(acYear.html)) && !/as is|prepped|surrender/i.test(aTxt(acYear.html)) && acYear.note.warn && acYear.note.shown
      && /must be prepped/.test(acYear.note.text) && /at least 5 days before their surrender date/.test(acYear.note.text) && acCopyMsg && acSideways <= 0,
    `note: ${acYear.note.text} · reminder after copy: ${acCopyMsg} · sideways at 1280: ${acSideways}px`);
  await p.fill('#prospectName', ''); await p.waitForTimeout(100); await p.evaluate(() => copyAsHTML());
  const blanksFirst = await waitToast(p, /still has \[Applicant\]/); await p.waitForTimeout(200);
  const blanksKept = await lastToast(p);
  check('A blank left in the email: its warning shows after copying, not covered by the prep reminder', blanksFirst && !/must be prepped/.test(blanksKept), blanksKept);
  await p.fill('#prospectName', 'Lindqvist');
  await p.uncheck('#appConfAssignToggle'); await p.waitForTimeout(100);
  const acOff = await emailNow();
  check('App Confirmation, box off: the email is byte-for-byte as before ("Lease Term: 1 year"), Lease Term usable again',
    acOff === plainAc && /Lease Term: 1 year/.test(aTxt(acOff)) && !(await p.isDisabled('#appConfLeaseTerm')), acOff === plainAc ? 'identical' : 'differs');
  // Lease Approval: the existing "Delivered as-is" box ticks itself from the lease dates
  await p.click('#modeApprovalBtn'); await p.waitForTimeout(150);
  await p.selectOption('#apvBuilding', '2230 Tidemark Blvd'); await p.fill('#apvUnit', '4201'); await p.fill('#apvRent', '5375');
  await p.fill('#apvLeaseStart', '11012026'); await p.press('#apvLeaseStart', 'Tab'); await p.fill('#apvLeaseEnd', '05312027'); await p.press('#apvLeaseEnd', 'Tab');
  const plainApv = await emailNow();
  await p.check('#apvAssignmentToggle'); await p.waitForTimeout(100);
  const a1 = { asIs: await p.isChecked('#apvAsIsToggle'), html: await emailNow(), note: await noteOf('apvAssignNote') };
  await p.fill('#apvLeaseEnd', '10312027'); await p.press('#apvLeaseEnd', 'Tab'); await p.waitForTimeout(100);
  const a2 = { asIs: await p.isChecked('#apvAsIsToggle'), html: await emailNow(), note: await noteOf('apvAssignNote') };
  await p.evaluate(() => copyAsHTML()); const apvCopyMsg = await waitToast(p, /must be prepped/);
  check('Lease Approval: under a year ticks "Delivered as-is" (the same "as is" sentence as App Confirmation); a year unticks it and shows the prep reminder, again after copying',
    a1.asIs && /sign the lease and any applicable rider\(s\), including the guarantor rider if applicable\. Please note: the apartment is delivered "as is"\./.test(aTxt(a1.html)) && !/this unit is delivered/.test(aTxt(a1.html))
      && /Under a year/.test(a1.note.text) && !a2.asIs && !/delivered "as is"|prepped|surrender/.test(aTxt(a2.html)) && a2.note.warn && /must be prepped/.test(a2.note.text) && apvCopyMsg,
    `under: as-is ${a1.asIs} · year: as-is ${a2.asIs}, note ${a2.note.text.slice(0, 40)}… · reminder after copy: ${apvCopyMsg}`);
  await p.check('#apvAsIsToggle'); await p.fill('#apvLeaseEnd', '05302027'); await p.press('#apvLeaseEnd', 'Tab'); await p.fill('#apvLeaseEnd', '11012027'); await p.press('#apvLeaseEnd', 'Tab'); await p.waitForTimeout(100);
  const handTicked = await p.isChecked('#apvAsIsToggle');
  await p.uncheck('#apvAssignmentToggle'); await p.fill('#apvLeaseEnd', '05312027'); await p.press('#apvLeaseEnd', 'Tab'); await p.waitForTimeout(100);
  const apvOff = { html: await emailNow(), note: await noteOf('apvAssignNote') };
  check('Lease Approval: a "Delivered as-is" ticked by hand stays ticked when the dates change; box off: the note goes and the email is byte-for-byte as before',
    handTicked && !apvOff.note.shown && apvOff.html === plainApv, `hand-ticked: ${handTicked} · note shown: ${apvOff.note.shown} · email ${apvOff.html === plainApv ? 'identical' : 'differs'}`);
  await p.close();

  // ===== 23. Tour times by day, in Reports (production Desk v1.22–v1.23, D24, D25; part of Reports since v1.28): the numbers
  // are worked out again here from the seeded store; Leave out / Count it again; a start chosen at Finish (D26) =====
  tag = 'tour-times';
  p = await open({ seedLocal: true });
  await p.evaluate(() => document.getElementById('queuePanel').classList.add('open'));
  await tab(p, 'Rotation');
  check('Locked: no tour times on the Rotation tab or in Reports', !/Tour times by day|are in Reports/.test(await p.textContent('#queueBody')) && !(await p.locator('#reportsBody .weekly-table').count()));
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; renderTourQueue(); }); await p.waitForTimeout(300);
  const pointer = ((await p.locator('#queueBody .queue-note', { hasText: 'are in Reports' }).textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
  check('Unlocked Rotation: today\'s totals stay; tour times by day, quiz results and the weekly numbers point to Reports', (await p.locator('#queueBody .totals-table').count()) === 1 && /Tour times by day, quiz results and the weekly numbers are in Reports/.test(pointer), pointer);
  p.__dialogs.length = 0;
  await p.click('#queueBody button:has-text("Open Reports")'); await p.waitForTimeout(900);
  check('Open Reports opens the Reports panel (already unlocked: no PIN asked)', await p.evaluate(() => document.getElementById('reportsPanel').classList.contains('open')) && !p.__dialogs.length && (await p.locator('#reportsBody .weekly-table').count()) === 1, p.__dialogs.join(' | '));
  // Reads the table, and works out the expected numbers straight from the seeded store: tours only (no inspections); a length
  // counts with Start and Finish on the same day, from 5 minutes to 2 hours, not left out by a manager; typical = the median
  const readWeek = () => p.evaluate(() => {
    const tbl = document.querySelector('#reportsBody .weekly-table'); if (!tbl) return null;
    const txt = el => el.innerText.replace(/\s+/g, ' ').trim();
    const cells = who => { const tr = [...tbl.querySelectorAll('tr')].find(t => t.querySelector('th') && t.querySelector('th').textContent.trim() === who); return tr ? [...tr.querySelectorAll('td')].map(txt) : []; };
    const expect = (from, to) => {
      const tours = Object.values(window.__STORE.tours).filter(t => t.kind !== 'inspection' && t.assistant && t.startedAtIso && new Date(t.startedAtIso) >= from && new Date(t.startedAtIso) < to);
      const len = t => t.finishedAtIso && new Date(t.finishedAtIso).toDateString() === new Date(t.startedAtIso).toDateString() ? Math.round((new Date(t.finishedAtIso) - new Date(t.startedAtIso)) / 60000) : null;
      const counts = t => !t.timeExcluded && len(t) !== null && len(t) >= 5 && len(t) <= 120;
      const lens = tours.filter(counts).map(len).sort((a, b) => a - b), m = lens.length >> 1;
      return { n: tours.length, out: tours.filter(t => t.finishedAtIso && !counts(t)).length, typical: Math.round(lens.length % 2 ? lens[m] : (lens[m - 1] + lens[m]) / 2) };
    };
    return { heads: [...tbl.querySelectorAll('tr:first-child th')].map(txt), team: cells('Team'), nav: (document.querySelector('#reportsBody .wk-nav strong') || {}).textContent || '',
      note: (tbl.parentElement.nextElementSibling || {}).textContent || '',
      thisWeek: expect(new Date(2026, 9, 5), new Date(2026, 9, 12)), monday: expect(new Date(2026, 9, 5), new Date(2026, 9, 6)), lastWeek: expect(new Date(2026, 8, 28), new Date(2026, 9, 5)) };
  });
  const typ = s => (s.match(/^(\d+) min/) || [])[1], cnt = s => +((s.match(/(\d+) tours?/) || [])[1] || 0), outN = s => +((s.match(/(\d+) left out/) || [])[1] || 0);
  let wk = await readWeek();
  check('Tour times by day: Mon–Sun columns plus Week, starting with this week', wk && wk.heads.length === 9 && /^Mon Oct 5/.test(wk.heads[1]) && /^Sun Oct 11/.test(wk.heads[7]) && wk.heads[8] === 'Week' && /^This week · Oct 5 – Oct 11/.test(wk.nav), wk && `${wk.nav} | ${wk.heads.join(' | ')}`);
  check('Team Week column matches the data (the median, inspections left out), with the change from the week before', wk && new RegExp(`^${wk.thisWeek.typical} min ${wk.thisWeek.n} tours`).test(wk.team[7]) && /▲|▼|same/.test(wk.team[7]), `${wk && wk.team[7]} (expected ${wk && wk.thisWeek.typical} min, ${wk && wk.thisWeek.n} tours)`);
  check('Team Monday matches the data', wk && new RegExp(`^${wk.monday.typical} min ${wk.monday.n} tours`).test(wk.team[0]), `${wk && wk.team[0]} (expected ${wk && wk.monday.typical} min, ${wk && wk.monday.n} tours)`);
  await p.click('#reportsBody .wk-nav button[aria-label="Previous week"]'); await p.waitForTimeout(300);
  wk = await readWeek();
  check('‹ goes back a week (Sep 28 – Oct 4): the Week column and how many finished tours were left out match the data', wk && /^Sep 28 – Oct 4/.test(wk.nav) && typ(wk.team[7]) === String(wk.lastWeek.typical) && cnt(wk.team[7]) === wk.lastWeek.n && outN(wk.team[7]) === wk.lastWeek.out && wk.lastWeek.out >= 5 && wk.note.includes(`${wk.lastWeek.out} finished tours were left out this week`),
    `${wk && wk.nav}: ${wk && wk.team[7]} (expected ${wk && wk.lastWeek.typical} min, ${wk && wk.lastWeek.n} tours, ${wk && wk.lastWeek.out} left out)`);
  const reviewRows = () => p.evaluate(() => [...document.querySelectorAll('#reportsBody .wk-review-table tr')].slice(1).map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  const teamCell = i => p.locator('#reportsBody .weekly-table tr.team td').nth(i).locator('button.wk-cell');
  await teamCell(0).click(); await p.waitForTimeout(300);
  let rv = await reviewRows();
  check('Clicking a day lists its tours: a Finish tapped the next morning has no length, a tour over 2 hours is left out',
    rv.length === cnt(wk.team[0]) && rv.every(t => /^Mon, Sep 28/.test(t)) && rv.some(t => /Tariq 5:20 PM 9:05 AM, Tue, Sep 29 — No: finished on a later day$/.test(t)) && rv.some(t => /Jun 11:00 AM 1:20 PM 2 h 20 min No: over 2 hours$/.test(t)),
    rv.length + ' rows: ' + rv.filter(t => /No:/.test(t)).join(' | '));
  await teamCell(1).click(); await p.waitForTimeout(300);
  rv = await reviewRows();
  check('…Start and Finish tapped together are left out (under 5 minutes); a tour left out by a manager says who, with Count it again',
    rv.length === cnt(wk.team[1]) && rv.every(t => /^Tue, Sep 29/.test(t)) && rv.some(t => /Rosa 3:00 PM 3:03 PM 3 min No: under 5 minutes$/.test(t)) && rv.some(t => /Nadia 4:40 PM 4:41 PM 1 min No: under 5 minutes$/.test(t)) && rv.some(t => /Ellis 1:00 PM 2:25 PM 1 h 25 min No: left out by a manager \(Morgan\) Count it again$/.test(t)),
    rv.filter(t => /No:/.test(t)).join(' | '));
  check('A start chosen at Finish on the iPad is marked "set at Finish" and still counts (D26)', rv.some(t => /Tariq 2:00 PM · set at Finish 2:38 PM 38 min Yes Leave out of tour times$/.test(t)), (rv.find(t => /set at Finish/.test(t)) || 'no row').slice(0, 110));
  // Leave out one counted tour, then count it again
  const teamTue = () => p.evaluate(() => { const tr = document.querySelector('#reportsBody .weekly-table tr.team'); return tr ? tr.querySelectorAll('td')[1].innerText.replace(/\s+/g, ' ').trim() : ''; });
  const firstLeave = p.locator('#reportsBody .wk-review-table button:has-text("Leave out of tour times")').first();
  const leftId = ((await firstLeave.getAttribute('data-rkey')) || '').replace(/^wkx-/, '');
  const tueBefore = await teamTue(), upd0 = await p.evaluate(id => (window.__STORE.tours[id] || {}).updatedAtIso, leftId);
  p.__dialogs.length = 0;
  await firstLeave.click(); await p.waitForTimeout(700);
  const saved = await p.evaluate(id => window.__STORE.tours[id], leftId), write = await p.evaluate(id => window.__W.filter(w => w[0] === 'tours' && w[1] === id).pop() || null, leftId);
  rv = await reviewRows(); const tueAfter = await teamTue();
  check('Leave out of tour times: asks for a name, saves only who and when (a merge, last-updated time unchanged), the tour still counts as a tour, one more left out',
    /Your name/.test(p.__dialogs[0] || '') && saved && saved.timeExcluded === true && saved.timeExcludedBy === 'Alex' && !!saved.timeExcludedAtIso && saved.updatedAtIso === upd0
      && write && write[3] && write[3].merge === true && Object.keys(write[2]).sort().join() === 'timeExcluded,timeExcludedAtIso,timeExcludedBy'
      && outN(tueAfter) === outN(tueBefore) + 1 && cnt(tueAfter) === cnt(tueBefore) && rv.some(t => t.includes(saved.prospect) && /No: left out by a manager \(Alex\) Count it again$/.test(t)),
    `${leftId}: timeExcluded=${saved && saved.timeExcluded} by ${saved && saved.timeExcludedBy} · Team Tue: ${tueBefore} → ${tueAfter} · write ${write && JSON.stringify(write[2])}`);
  await p.locator(`#reportsBody .wk-review-table button[data-rkey="wkx-${leftId}"]`).click(); await p.waitForTimeout(700);
  const back = await p.evaluate(id => window.__STORE.tours[id], leftId);
  check('Count it again: counted again, the note cleared, last-updated time still unchanged', back && back.timeExcluded === false && back.timeExcludedBy === '' && back.timeExcludedAtIso === null && back.updatedAtIso === upd0 && (await teamTue()) === tueBefore, `timeExcluded=${back && back.timeExcluded} · Team Tue: ${await teamTue()}`);
  // A save the database refuses (as the real rules refuse a note on a deleted tour): the fake database is made to refuse it
  const refuseSave = id => p.evaluate(rid => { const db = firebase.firestore(), orig = db.collection; db.collection = name => { const c = orig(name); if (name !== 'tours') return c; const od = c.doc; c.doc = did => { const d = od(did); if (did === rid) d.set = () => Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })); return d; }; return c; }; }, id);
  const yesIds = await p.evaluate(() => [...document.querySelectorAll('#reportsBody .wk-review-table button')].filter(b => /Leave out/.test(b.textContent)).map(b => b.getAttribute('data-rkey').replace(/^wkx-/, '')));
  const [goneId, keptId] = yesIds;
  await p.evaluate(id => { delete window.__STORE.tours[id]; }, goneId); await refuseSave(goneId);
  await p.locator(`#reportsBody .wk-review-table button[data-rkey="wkx-${goneId}"]`).click(); await p.waitForTimeout(700);
  const goneMsg = await lastToast(p), recreated = await p.evaluate(id => !!window.__STORE.tours[id], goneId);
  check('Leaving out a tour deleted since the list loaded says so (not "check the connection"), and doesn\'t bring it back', /This tour was deleted/.test(goneMsg) && /Click Refresh/.test(goneMsg) && !recreated, goneMsg);
  await refuseSave(keptId);
  await p.locator(`#reportsBody .wk-review-table button[data-rkey="wkx-${keptId}"]`).click(); await p.waitForTimeout(700);
  const connMsg = await lastToast(p), kept = await p.evaluate(id => window.__STORE.tours[id], keptId);
  check('A refused save on a tour that still exists keeps the connection message, and nothing changes', /Not saved/.test(connMsg) && /Check the connection/.test(connMsg) && kept && !kept.timeExcluded, connMsg);
  for (let i = errors.length - 1; i >= 0; i--) if (/^tour-times: console: .*Missing or insufficient permissions/.test(errors[i])) errors.splice(i, 1);   // the two refused saves above log this on purpose
  await p.close();

  // ===== 24. Reports (production Desk v1.28–v1.31, D33, D34, D37, D38), behind the manager PIN. Every number is worked out
  // again here from the default demo seed (six weeks of handled tours) and compared with what the panel shows =====
  tag = 'reports';
  p = await open({ seedLocal: true });
  const rpOpen = () => p.evaluate(() => document.getElementById('reportsPanel').classList.contains('open'));
  check('Reports: locked until the manager PIN, nothing drawn, no Lock button', /managers only \(PIN\)/.test(await p.textContent('#reportsMeta')) && !(await p.locator('#reportsBody .rpt').count()) && !(await p.isVisible('#reportsLock')));
  p.__answer = '1234'; await p.click('#reportsToggle');
  check('Reports: a wrong PIN keeps it closed', await waitToast(p, /Incorrect PIN/) && !(await rpOpen()));
  p.__answer = 'test-pin-never-typed'; await p.click('#reportsToggle'); await p.waitForTimeout(1000); p.__answer = undefined;
  // The rules written out again in the page (not the app's code): sizes from the unit type; the net quoted (D19, D37): the
  // rent less the free months (typed on the tour, else the showsheet's) over the stop's lease term, a credit never taken off,
  // a broker on an OR concession pays the rent; the concession behind it (D38); the top price (typos and "flexible" don't count)
  await p.evaluate(async () => {
    const { parseIncentive } = await import(new URL('../shared/pricing.js', location.href).href);
    const num = v => +String(v == null ? '' : v).replace(/[^0-9.]/g, '') || 0;
    const net = (st, broker) => { const rent = num(st.rent || st.monthly), sh = parseIncentive(st.incentive); if (broker && sh.mode === 'or') return Math.round(rent);
      const term = parseInt(st.term, 10) > 0 ? parseInt(st.term, 10) : 12, free = parseFloat(st.free) > 0 ? parseFloat(st.free) : sh.freeMonths;
      const amt = free ? rent * free : num(st.netEff) ? (rent - num(st.netEff)) * term : 0; return Math.round(rent - Math.max(0, amt) / term); };
    const conc = (st, broker) => { const sh = parseIncentive(st.incentive), orB = !!broker && sh.mode === 'or', rent = num(st.rent || st.monthly);
      const mo = orB ? 0 : parseFloat(st.free) > 0 ? parseFloat(st.free) : sh.freeMonths || 0;
      return mo ? String(mo) : num(st.credit) ? 'credit' : !orB && num(st.netEff) && num(st.netEff) < rent ? 'other' : 'none'; };
    const size = ty => /studio/i.test(ty) ? 'Studio' : /^1 Bed/.test(ty) ? '1 Bed' : /^2 Bed/.test(ty) ? '2 Bed' : /^3 Bed/.test(ty) ? '3 Bed' : 'Other';
    const budget = t => { const pr = t.profile || {}, b = pr.priceFlexible ? 0 : num(pr.priceMax); return b >= 1000 && b <= 30000 ? b : 0; };
    const period = weeks => { const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7);
      const from = new Date(mon); from.setDate(from.getDate() - 7 * (weeks - 1)); const to = new Date(mon); to.setDate(to.getDate() + 7); return { from, to }; };
    window.__T = { num, net, conc, size, budget, period };
  });
  const expectRpt = (weeks, bldg) => p.evaluate(([weeks, bldg]) => {
    const { num, net, size, budget, period } = window.__T, { from, to } = period(weeks);
    const inB = st => !bldg || String(st.building).slice(0, 4) === bldg;
    const tours = Object.values(window.__STORE.tours).filter(t => t.kind !== 'inspection' && t.startedAtIso && new Date(t.startedAtIso) >= from && new Date(t.startedAtIso) < to && (!bldg || (t.stops || []).some(inB)));
    const stops = tours.flatMap(t => (t.stops || []).filter(inB).map(st => ({ st, t })));
    const count = {}; stops.forEach(({ st }) => { const k = String(st.building).slice(0, 4) + '|' + st.unit; count[k] = (count[k] || 0) + 1; });
    const bySize = {}; stops.forEach(({ st }) => { const z = size(st.type); bySize[z] = (bySize[z] || 0) + 1; });
    let fit = 0, withBudget = 0;
    stops.forEach(({ st, t }) => { const max = budget(t); if (max && num(st.rent || st.monthly)) { withBudget++; if (net(st, !!t.broker) <= max) fit++; } });
    return { tours: tours.length, shown: stops.length, apts: Object.keys(count).length, top: Math.max(0, ...Object.values(count)), bySize, withBudget, fitPct: withBudget ? Math.round(100 * fit / withBudget) + '%' : '—' };
  }, [weeks, bldg || '']);
  const readRpt = () => p.evaluate(() => ({
    meta: document.getElementById('reportsMeta').textContent,
    kpi: Object.fromEntries([...document.querySelectorAll('#reportsBody .rpt-kpi')].map(k => [k.querySelector('.rpt-kpi-l').textContent.trim(), k.querySelector('.rpt-kpi-v').textContent.trim().replace(/,/g, '')])),
    topN: +((document.querySelector('#rpt-apts tbody tr .rpt-barcell b') || {}).textContent || 0),
    bldgBars: document.querySelectorAll('#rpt-bldg .viz-hit').length, weekCols: document.querySelectorAll('#rpt-sizes .viz-hit').length }));
  let ex = await expectRpt(4), rd = await readRpt();
  check('Reports: opens on the last 4 weeks, Monday Sep 14 to today, with the Lock button', await rpOpen() && /Sep 14 – Oct 6, 2026/.test(rd.meta) && rd.weekCols === 4 && await p.isVisible('#reportsLock'), `${rd.meta} · ${rd.weekCols} weekly columns`);
  for (const w of [1440, 1280]) {   // as it opens: screenshots (audit/ is git-ignored), and no sideways scroll at either width
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(400);
    const side = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await p.locator('#reportsPanel').screenshot({ path: `${OUT}/reports@${w}.png`, animations: 'disabled' });
    check(`Reports at ${w} wide: no sideways scroll, charts side by side`, side <= 0 && await p.locator('#reportsBody .rpt-grid.two').count() === 1, `${side}px`);
  }
  await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  check('Reports: the six numbers across the top', JSON.stringify(Object.keys(rd.kpi)) === JSON.stringify(['Tours', 'Apartments shown', 'Different apartments', 'Within their price', 'Typical tour length', 'Quiz pass rate']), Object.keys(rd.kpi).join(' · '));
  check('Reports: tours, apartments shown and different apartments match the data', +rd.kpi['Tours'] === ex.tours && +rd.kpi['Apartments shown'] === ex.shown && +rd.kpi['Different apartments'] === ex.apts && ex.tours > 100, `${rd.kpi['Tours']} / ${rd.kpi['Apartments shown']} / ${rd.kpi['Different apartments']} vs ${ex.tours} / ${ex.shown} / ${ex.apts}`);
  check('Reports: "Within their price" matches the data (the net, or the rent with no concession, at or under the top of the price range)', rd.kpi['Within their price'] === ex.fitPct, `${rd.kpi['Within their price']} vs ${ex.fitPct} of ${ex.withBudget}`);
  check('Reports: the most-shown apartment comes first', rd.topN === ex.top && ex.top > 0, `${rd.topN} vs ${ex.top}`);
  await p.click('#rpt-sizes .rpt-tbtn'); await p.waitForTimeout(250);
  const sz = await p.evaluate(() => { const t = document.querySelector('#rpt-sizes table'); if (!t) return null; return { head: [...t.querySelectorAll('thead th')].map(x => x.textContent.trim()), foot: [...t.querySelectorAll('tfoot th, tfoot td')].map(x => x.textContent.trim()), rows: t.querySelectorAll('tbody tr').length, btn: document.querySelector('#rpt-sizes .rpt-tbtn').textContent, focused: !!(document.activeElement && document.activeElement.classList.contains('rpt-tbtn')) }; });
  const footOf = z => sz ? +sz.foot[sz.head.indexOf(z)] : NaN;
  check('Show table: a row per week, totals per size match the data, focus stays on the button',
    sz && sz.rows === 4 && ['Studio', '1 Bed', '2 Bed', '3 Bed'].every(z => footOf(z) === (ex.bySize[z] || 0)) && +sz.foot[sz.foot.length - 1] === ex.shown && /Show chart/.test(sz.btn) && sz.focused, sz && `${sz.head.join(' · ')} = ${sz.foot.join(' · ')}`);
  await p.click('#rpt-sizes .rpt-tbtn'); await p.waitForTimeout(250);
  await p.focus('#rpt-sizes .viz-hit'); await p.waitForTimeout(150);
  const tipTxt = await p.evaluate(() => { const t = document.querySelector('.viz-tip'); return t && getComputedStyle(t).display !== 'none' ? t.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const hitLabel = await p.getAttribute('#rpt-sizes .viz-hit', 'aria-label');
  check('Keyboard focus on a week shows the same details as hover (every size), and the chart says them to a screen reader', /^\d+ shown week of Sep 14 3 Bed \d+ 2 Bed \d+ 1 Bed \d+ Studio \d+$/.test(tipTxt) && /^week of Sep 14: \d+ shown\. 3 Bed \d+, 2 Bed \d+, 1 Bed \d+, Studio \d+\.$/.test(hitLabel), `${tipTxt} · ${hitLabel}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('Esc hides the details', await p.evaluate(() => getComputedStyle(document.querySelector('.viz-tip')).display === 'none'));
  await p.selectOption('#reportsBody select.rpt-bldg', '2050'); await p.waitForTimeout(300);
  ex = await expectRpt(4, '2050'); rd = await readRpt();
  check('Building filter (2050): every number is for that building only', /2050 Tidemark Blvd/.test(rd.meta) && +rd.kpi['Tours'] === ex.tours && +rd.kpi['Apartments shown'] === ex.shown && +rd.kpi['Different apartments'] === ex.apts && rd.bldgBars === 1,
    `${rd.meta} · ${rd.kpi['Tours']} / ${rd.kpi['Apartments shown']} / ${rd.kpi['Different apartments']} vs ${ex.tours} / ${ex.shown} / ${ex.apts} · ${rd.bldgBars} building bar(s)`);
  const bldgOpts = await p.evaluate(() => [...document.querySelectorAll('#reportsBody select.rpt-bldg option')].map(o => o.textContent));
  check('The building menu lists the five demo buildings by street', bldgOpts.join('|') === 'All buildings|2050 Tidemark Blvd|2230 Tidemark Blvd|2120 Tidemark Blvd|2040 Tidemark Blvd|2110 Tidemark Blvd', bldgOpts.join(', '));
  await p.selectOption('#reportsBody select.rpt-bldg', ''); await p.waitForTimeout(300);
  await p.click('#reportsBody .rpt-seg button:has-text("This week")'); await p.waitForTimeout(300);
  ex = await expectRpt(1); rd = await readRpt();
  check('This week: Monday to today only', /Oct 5 – Oct 6, 2026/.test(rd.meta) && +rd.kpi['Tours'] === ex.tours && +rd.kpi['Apartments shown'] === ex.shown && rd.weekCols === 1, `${rd.meta} · ${rd.kpi['Tours']} tours vs ${ex.tours}`);
  await p.click('#reportsBody .rpt-seg button:has-text("6 weeks")'); await p.waitForTimeout(300);
  ex = await expectRpt(6); rd = await readRpt();
  check('6 weeks: six weekly columns, Aug 31 to this week, and the numbers match', /Aug 31 – Oct 6, 2026/.test(rd.meta) && rd.weekCols === 6 && +rd.kpi['Tours'] === ex.tours && +rd.kpi['Apartments shown'] === ex.shown, `${rd.meta} · ${rd.weekCols} columns · ${rd.kpi['Tours']} vs ${ex.tours}`);
  await p.click('#rpt-movein .rpt-tbtn'); await p.waitForTimeout(150); await p.click('#rpt-busy .rpt-tbtn'); await p.waitForTimeout(150);
  const mv = await p.evaluate(() => ({ months: [...document.querySelectorAll('#rpt-movein tbody th')].map(x => x.textContent.trim()), busyTotal: [...document.querySelectorAll('#rpt-busy tbody tr')].reduce((a, tr) => a + +tr.lastElementChild.textContent, 0) }));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mIdx = x => { const [mo, y] = x.split(' '); return +y * 12 + MONTHS.indexOf(mo); }, dated = mv.months.filter(x => /^[A-Z][a-z]+ \d{4}$/.test(x));
  check('Move-in months run month after month (empty months stay on), at most 8, the last one "or later" for the far-off move-in; busiest-times totals add up to the tours',
    dated.length > 2 && dated.length <= 8 && dated.every((x, i) => !i || mIdx(x) - mIdx(dated[i - 1]) === 1) && mv.months.some(x => / or later$/.test(x)) && mv.busyTotal === ex.tours, `${mv.months.join(', ')} · busiest total ${mv.busyTotal} vs ${ex.tours} tours`);
  const qz = await p.evaluate(() => {
    const { from, to } = window.__T.period(6), rows = Object.values(window.__STORE.quiz_results).filter(q => new Date(q.dateIso) >= from && new Date(q.dateIso) < to);
    const miss = {}; rows.forEach(q => (q.missed || []).forEach(x => { miss[x.category] = (miss[x.category] || 0) + 1; }));
    const passed = rows.filter(q => q.passed).length, head = document.querySelector('#rpt-quiz .rpt-quizhead').textContent.replace(/\s+/g, ' ').trim(), top = head.match(/most missed: (.+) \((\d+)\)/);
    return { head, rows: document.querySelectorAll('#rpt-quiz .queue-row').length, n: rows.length, lead: `${rows.length} attempts in this period · ${passed} passed (${Math.round(100 * passed / rows.length)}%) · most missed: `,
      topOk: !!top && miss[top[1]] === +top[2] && +top[2] === Math.max(...Object.values(miss)), kpi: [...document.querySelectorAll('.rpt-kpi')].find(k => /Quiz/.test(k.textContent)).querySelector('.rpt-kpi-v').textContent.trim(), pct: Math.round(100 * passed / rows.length) + '%' };
  });
  check('Quiz results in Reports: attempts in the period, how many passed, the most-missed topic; the pass rate tile agrees', qz.head.startsWith(qz.lead) && qz.topOk && qz.rows === qz.n && qz.n > 8 && qz.kpi === qz.pct, `${qz.head} · ${qz.rows} rows · tile ${qz.kpi}`);
  await p.locator('#rpt-quiz .queue-row', { hasText: 'Marco' }).first().locator('button:has-text("Details")').click(); await p.waitForTimeout(150);
  await p.click('#reportsBody .rpt-seg button:has-text("4 weeks")'); await p.waitForTimeout(300);
  const marcoOpen = await p.evaluate(() => { const r = [...document.querySelectorAll('#rpt-quiz .queue-row')].find(x => /Marco/.test(x.textContent)); const d = r && r.nextElementSibling; return !!d && d.style.display !== 'none' && /Correct: \$20 per person/.test(d.textContent); });
  check('Quiz details stay open when the period changes', marcoOpen);
  await p.click('#reportsBody .rpt-seg button:has-text("6 weeks")'); await p.waitForTimeout(300);
  await p.evaluate(() => { const orig = XLSX.writeFile; XLSX.writeFile = (wb, name) => { window.__xlsx = { name, sheets: wb.SheetNames.slice(), summary: XLSX.utils.sheet_to_json(wb.Sheets['Summary'], { header: 1 }) }; return orig(wb, name); }; });
  const [xdl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('#reportsBody button:has-text("Download Excel")')]);
  const xl = await p.evaluate(() => window.__xlsx || null), sumVal = k => ((xl && xl.summary.find(r => r[0] === k)) || [])[1];
  const SHEETS = ['Summary', 'Tours per week', 'Shown by size by week', 'Shown by building', 'Apartments shown', 'Shown, still available', 'Sizes asked vs available', 'Net rent shown by size', 'Week by week by size', 'Within their price', 'Move-in months', 'Busiest days and times', 'Tour times', 'Quiz results'];
  check('Download Excel: the 14 sheets, named for the period; the summary matches the page',
    xdl && xdl.suggestedFilename() === 'Leasing reports 2026-08-31 to 2026-10-06.xlsx' && xl && JSON.stringify(xl.sheets) === JSON.stringify(SHEETS) && (xl.summary[0] || [])[0] === 'Leasing reports' && sumVal('Tours') === ex.tours && sumVal('Apartments shown') === ex.shown,
    `${xdl && xdl.suggestedFilename()} · ${xl && xl.sheets.join(', ')}`);
  const pr = await p.evaluate(async () => {
    const { rpt } = await import(new URL('js/reports.js', location.href).href), { printReports } = await import(new URL('js/reports-print.js', location.href).href);
    return new Promise(done => {
      window.print = () => {
        const r = { cls: document.body.classList.contains('print-reports'), w: rpt.printW, landscape: [...document.head.querySelectorAll('style')].some(s => /size: landscape/.test(s.textContent)), widest: Math.max(...[...document.querySelectorAll('#reportsBody svg.viz')].map(s => +s.getAttribute('width'))),
          title: (document.querySelector('.rpt-print-head') || {}).textContent || '' };
        setTimeout(() => { window.dispatchEvent(new Event('afterprint')); setTimeout(() => done(Object.assign(r, { restored: !document.body.classList.contains('print-reports') && rpt.printW === 0 && ![...document.head.querySelectorAll('style')].some(s => /size: landscape/.test(s.textContent)) })), 50); }, 0);
      };
      printReports();
    });
  });
  check('Print or save as PDF: landscape, charts drawn for the page (at most 926 px wide), a "Leasing reports" title line, and the screen goes back afterwards', pr.cls && pr.landscape && pr.w === 960 && pr.widest <= 926 && pr.restored && /^Leasing reportsAug 31 – Oct 6, 2026 · All buildings · printed Oct 6, 2026$/.test(pr.title), JSON.stringify(pr));
  await p.evaluate(() => document.body.classList.add('print-reports')); await p.emulateMedia({ media: 'print' });
  const pv = await p.evaluate(() => { const d = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'missing'; }; return { queue: d('#queuePanel'), header: d('.app > header'), reports: d('#reportsPanel'), head: d('#reportsPanel .queue-head'), bar: d('.rpt-bar'), title: d('.rpt-print-head'), top: d('#toTop'), banner: d('.demo-banner') }; });
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => document.body.classList.remove('print-reports'));
  check('Printing shows only Reports, with a title line instead of the buttons; ↑ Top is hidden', pv.queue === 'none' && pv.header === 'none' && pv.reports !== 'none' && pv.head === 'none' && pv.bar === 'none' && pv.title === 'flex' && pv.top === 'none', JSON.stringify(pv));
  // Review fixes (production Oct 22): sizes, the broker rule, quartiles, odd saved data, a typed building with markup, focus, quiz not loaded
  const unitChk = await p.evaluate(async () => {
    const R = await import(new URL('js/rules/reports.js', location.href).href);
    return { sizes: ['2-Bedroom', '1BR', '2BR2BA', '1.5 Bed', 'Studio, 1 Bath', '2 Bdrm, 2 Bth, WIC, WD, Balc', 'Jr 1 Bed'].map(R.reportSize), groups: ['CONVERTIBLES', 'PENTHOUSES', 'JR 1 BEDROOMS'].map(R.reportGroupSize),
      ne: [R.stopNetEff({ monthly: 4150, incentive: '1 Month Free OR 1 Mo. OP' }, true), R.stopNetEff({ monthly: 4150, incentive: '1 Month Free OR 1 Mo. OP' }, false), R.stopNetEff({ monthly: 4000, rent: '3800', netEff: 4000, incentive: 'No Incentive' }, false), R.stopNetEff({ monthly: 3295, incentive: 'No Incentive', credit: '1200' }, false)],
      q: [R.rptQuantile([3000, 3500, 4000], 0.25), R.rptQuantile([3000, 3500, 4000], 0.75)] };
  });
  check('Sizes read from types like "2-Bedroom", "1BR", "2BR2BA" ("1.5 Bed" isn\'t read as 5); Convertibles = Studio, Penthouses = 3 Bed',
    unitChk.sizes.join('|') === '2 Bed|1 Bed|2 Bed|Other|Studio|2 Bed|1 Bed' && unitChk.groups.join('|') === 'Studio|3 Bed|1 Bed', `${unitChk.sizes.join(', ')} · ${unitChk.groups.join(', ')}`);
  check('The net in Reports: a broker on an OR concession pays the rent; never above a typed-over rent; a credit is never taken off (D19)', unitChk.ne.join('|') === '4150|3804|3800|3295', unitChk.ne.join(', '));
  check('The middle half of three prices runs from the lowest to the highest (nearest rank)', unitChk.q.join('|') === '3000|4000', unitChk.q.join(', '));
  await p.evaluate(() => {
    const S = window.__STORE, t0 = new Date(); t0.setHours(t0.getHours() - 1); const iso = t0.toISOString();
    S.tours['odd-1'] = { id: 'odd-1', kind: 'tour', assistant: 'Rosa', prospect: 'Odd D.', startedAtIso: iso, createdAtIso: iso, updatedAtIso: iso,
      stops: [null, { building: '<img src=x onerror="window.__pwned=1">', unit: '<b>9</b>', type: '1 Bed', monthly: 4000 }], profile: { beds: 'Studio', moveIn: '9999-12-01', priceMax: '4,200' } };
    S.tours['odd-2'] = { id: 'odd-2', kind: 'tour', assistant: 'Rosa', prospect: 'Odd E.', startedAtIso: iso, createdAtIso: iso, updatedAtIso: iso, stops: 'oops', profile: 'oops' };
    S.quiz_results['odd-q'] = { name: 'Odd', score: 1, total: 30, pct: 3, passed: false, dateIso: iso, missed: 'oops' };
  });
  await p.click('#reportsBody .rpt-bar button:has-text("Refresh")'); await p.waitForTimeout(900);
  await p.click('#reportsBody button[data-rkey="aptsAll"]'); await p.waitForTimeout(250);
  const odd = await p.evaluate(() => ({ drawn: !!document.querySelector('#rpt-apts') && !/Couldn’t work out/.test(document.getElementById('reportsBody').textContent),
    injected: document.querySelectorAll('#reportsBody img, #rpt-apts tbody th b').length, pwned: !!window.__pwned,
    other: [...document.querySelectorAll('#rpt-apts tbody th')].some(th => th.textContent === 'Other #<b>9</b>'),
    months: document.querySelectorAll('#rpt-movein tbody th').length, later: [...document.querySelectorAll('#rpt-movein tbody th')].some(th => / or later$/.test(th.textContent)),   // the table view is on (from the months check above)
    oddQuiz: (([...document.querySelectorAll('#rpt-quiz .queue-row')].find(r => /Odd/.test(r.textContent)) || {}).textContent || '').replace(/\s+/g, ' ') }));
  check('Odd saved data still draws: a missing unit, a typed building with markup (shown as text under "Other"), sizes and stops that aren\'t lists, a year-9999 move-in ("or later"), a quiz with no list of misses',
    odd.drawn && !odd.injected && !odd.pwned && odd.other && odd.months <= 10 && odd.later && /Odd Not passed No misses/.test(odd.oddQuiz), JSON.stringify(odd));
  await p.locator('#rpt-weekly .viz-hit').nth(2).focus(); await p.evaluate(async () => (await import(new URL('js/reports.js', location.href).href)).renderReports()); await p.waitForTimeout(100);
  const keptFocus = await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-rkey'));
  check('Keyboard focus on a chart stays put when Reports redraws', keptFocus === 'hit-rpt-weekly-2', keptFocus);
  const qNotLoaded = await p.evaluate(async () => {
    const R = await import(new URL('js/reports.js', location.href).href), keep = [R.rpt.quizRows, R.rpt.quizState]; R.rpt.quizRows = null; R.rpt.quizState = 'error'; R.renderReports();
    const k = [...document.querySelectorAll('#reportsBody .rpt-kpi')].find(x => /quiz pass rate/i.test(x.textContent)), t = k ? k.textContent.replace(/\s+/g, ' ').trim() : '';
    R.rpt.quizRows = keep[0]; R.rpt.quizState = keep[1]; R.renderReports(); return t;
  });
  check('Quiz results that didn\'t load say so (not "no attempts")', /—\s*couldn’t load the quiz results/.test(qNotLoaded), qNotLoaded);
  // Net rent of the apartments shown (D37): every showing, at the net quoted on the tour (the rent when there's no concession).
  // Week by week for one size (D38): asked for, shown, typical net, the concession on those showings
  const netChk = await p.evaluate(() => {
    const { num, net, conc, size: sizeOf, period } = window.__T;
    const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return !s.length ? null : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const rank = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.max(0, Math.ceil(q * s.length) - 1)]; };   // nearest rank: a value actually quoted
    const money = v => v == null ? '—' : '$' + Math.round(v).toLocaleString('en-US');
    const { from, to } = period(6);
    const tours = Object.values(window.__STORE.tours).filter(t => t.kind !== 'inspection' && t.startedAtIso && new Date(t.startedAtIso) >= from && new Date(t.startedAtIso) < to);
    const wkOf = t => Math.floor((new Date(t.startedAtIso) - from) / (7 * 864e5));
    const stops = tours.flatMap(t => (Array.isArray(t.stops) ? t.stops : []).filter(st => st && typeof st === 'object').map(st => ({ st, t, wk: wkOf(t), size: sizeOf(st.type) })));
    const priced = stops.filter(x => num(x.st.rent || x.st.monthly)).map(x => Object.assign(x, { net: net(x.st, !!x.t.broker) }));
    const SIZES = ['Studio', '1 Bed', '2 Bed', '3 Bed'], want = {};
    SIZES.forEach(z => { const g = priced.filter(x => x.size === z), nets = g.map(x => x.net);
      want[z] = [String(g.length), money(med(nets)), g.length ? `${money(rank(nets, 0.25))}–${money(rank(nets, 0.75))}` : '—', money(med(g.map(x => num(x.st.rent || x.st.monthly))))]; });
    const order = k => isNaN(k) ? 100 + ['credit', 'other', 'none'].indexOf(k) : -parseFloat(k);
    const name = k => k === 'credit' ? 'Credit only' : k === 'other' ? 'Other concession' : k === 'none' ? 'No concession' : `${+k === 0.5 ? '½' : +k} month${+k <= 1 ? '' : 's'} free`;
    const asks = t => Array.isArray((t.profile || {}).beds) ? [...new Set(t.profile.beds.map(sizeOf).filter(z => z !== 'Other'))] : [];
    const weekly = z => { const g = priced.filter(x => x.size === z), keys = [...new Set(g.map(x => conc(x.st, x.t.broker)))].sort((a, b) => order(a) - order(b));
      const row = w => [tours.filter(t => wkOf(t) === w && asks(t).includes(z)).length, stops.filter(x => x.wk === w && x.size === z).length, money(med(g.filter(x => x.wk === w).map(x => x.net)))]
        .concat(keys.map(k => g.filter(x => x.wk === w && conc(x.st, x.t.broker) === k).length)).map(String);
      return { head: ['Week of', 'Asked for', 'Shown', 'Typical net'].concat(keys.map(name)).join(' | '), rows: [0, 1, 2, 3, 4, 5].map(row),
        foot: [tours.filter(t => asks(t).includes(z)).length, stops.filter(x => x.size === z).length, money(med(g.map(x => x.net)))].concat(keys.map(k => g.filter(x => conc(x.st, x.t.broker) === k).length)).map(String) }; };
    const rows = sel => [...document.querySelectorAll(sel + ' tbody tr')].map(tr => [...tr.children].map(x => x.textContent.trim()));
    const head = [...document.querySelectorAll('#rpt-net thead th')].map(x => x.textContent.trim()).join(' | ');
    const got = Object.fromEntries(rows('#rpt-net').map(c => [c[0], c.slice(1)]));
    return { want, got, head, title: document.querySelector('#rpt-net .rpt-h').textContent, wantStudio: weekly('Studio'), want2: weekly('2 Bed'),
      wide: ['rpt-net', 'rpt-fit', 'rpt-netweek'].every(id => document.getElementById(id).classList.contains('wide')) && !document.getElementById('rpt-bldg').classList.contains('wide'),
      diamonds: document.querySelectorAll('#rpt-net .viz-diamond').length };
  });
  check('Net rent of the apartments shown, by size: how many shown, the typical net quoted (the rent with no concession), where most fell and the typical rent before the concession, worked out again from the tours',
    netChk.title === 'Net rent of the apartments shown' && netChk.head === 'Size | Apartments shown | Typical net | Most were between | Typical rent before the concession'
    && Object.keys(netChk.want).every(z => JSON.stringify(netChk.got[z]) === JSON.stringify(netChk.want[z])) && netChk.diamonds === 4 && netChk.wide,
    JSON.stringify(netChk.got) + ' vs ' + JSON.stringify(netChk.want));
  const n4201 = await p.evaluate(async () => {
    const { quoteLines } = await import(new URL('../shared/pricing.js', location.href).href);
    const stops = Object.values(window.__STORE.tours).flatMap(t => Array.isArray(t.stops) ? t.stops : []).filter(s => s && s.key === '2230|4201');
    const row = [...document.querySelectorAll('#rpt-net tbody tr')].find(tr => tr.firstElementChild.textContent === '3 Bed');
    return { n: stops.length, terms: [...new Set(stops.map(s => s.term))].join(), ipad: quoteLines(stops[0], false).line2, row: row ? row.textContent.replace(/\s+/g, ' ') : '', old: /\$7,458/.test(document.getElementById('reportsBody').textContent) };
  });
  check('2230 #4201 (2 months free on a 24-month lease): seeded stops save its 24-month term, so Reports nets $8,204, as the iPad quotes it (not $7,458)', n4201.n > 0 && n4201.terms === '24' && n4201.ipad === 'Net effective $8,204' && /\$8,204/.test(n4201.row) && !n4201.old, JSON.stringify(n4201));
  const readWeekly = () => p.evaluate(() => ({ title: document.querySelector('#rpt-netweek .rpt-h').textContent, head: [...document.querySelectorAll('#rpt-netweek thead th')].map(x => x.textContent.trim()).join(' | '),
    rows: [...document.querySelectorAll('#rpt-netweek tbody tr')].map(tr => [...tr.children].slice(1).map(x => x.textContent.trim())), foot: [...document.querySelectorAll('#rpt-netweek tfoot td')].map(x => x.textContent.trim()),
    focus: document.activeElement && document.activeElement.getAttribute('data-rkey') }));
  const sameWeekly = (g, w) => g.head === w.head && JSON.stringify(g.rows) === JSON.stringify(w.rows) && JSON.stringify(g.foot) === JSON.stringify(w.foot);
  let wkTbl = await readWeekly();
  const lastFull = Object.fromEntries(wkTbl.head.split(' | ').map((h, i) => [h, i ? (wkTbl.rows[4] || [])[i - 1] : '']));
  check('Week by week: Studio (the size it opens on): asked for at sign-in, shown, the typical net and how many showings had each concession, week by week and for the whole period, worked out again from the tours',
    wkTbl.title === 'Week by week: Studio' && sameWeekly(wkTbl, netChk.wantStudio), JSON.stringify(wkTbl) + ' vs ' + JSON.stringify(netChk.wantStudio));
  check('Concessions are read as quoted (week of Sep 28): 1.5 months typed on a tour, a credit only, and no concession (a broker on an OR deal counts here)',
    +lastFull['1.5 months free'] >= 1 && +lastFull['Credit only'] >= 1 && +lastFull['No concession'] >= 1 && /1 month free/.test(wkTbl.head), JSON.stringify(lastFull));
  await p.focus('#rpt-netweek select.rpt-pick'); await p.selectOption('#rpt-netweek select.rpt-pick', '2 Bed'); await p.waitForTimeout(250);   // as a person would: focus on the picker
  wkTbl = await readWeekly();
  check('Picking 2 Bed redraws the table for 2 Bed, with keyboard focus kept on the picker', wkTbl.title === 'Week by week: 2 Bed' && sameWeekly(wkTbl, netChk.want2) && wkTbl.focus === 'netsize',
    JSON.stringify(wkTbl) + ' vs ' + JSON.stringify(netChk.want2));
  await p.selectOption('#rpt-netweek select.rpt-pick', 'Studio'); await p.waitForTimeout(250);
  await p.evaluate(() => { const f = document.getElementById('rpt-net'); window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 200); }); await p.waitForTimeout(400);
  const pinned = await p.evaluate(() => { const b = document.querySelector('#reportsBody .rpt-bar'); return { pos: getComputedStyle(b).position, top: Math.round(b.getBoundingClientRect().top), stuck: b.classList.contains('stuck'), up: document.getElementById('toTop').classList.contains('show') }; });
  check('Scrolling through Reports: the bar (period, building, Print, Excel) stays pinned at the top, and ↑ Top appears (D34)', pinned.pos === 'sticky' && pinned.top === 0 && pinned.stuck && pinned.up, JSON.stringify(pinned));
  await p.focus('#toTop'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const upKb = await p.evaluate(() => ({ y: window.scrollY, focus: document.activeElement && document.activeElement.tagName, shown: document.getElementById('toTop').classList.contains('show') }));
  check('↑ Top with the keyboard: straight to the top of the page (no animation), focus on the page header, button hides', upKb.y === 0 && upKb.focus === 'HEADER' && !upKb.shown, JSON.stringify(upKb));
  await p.click('#reportsLock'); await p.waitForTimeout(300);
  check('Lock closes Reports and clears it', !(await rpOpen()) && !(await p.locator('#reportsBody .rpt').count()) && /managers only \(PIN\)/.test(await p.textContent('#reportsMeta')) && !(await p.isVisible('#reportsLock')));
  const topAtTop = await p.evaluate(() => { window.scrollTo(0, 0); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(document.getElementById('toTop').classList.contains('show'))))); });
  await p.evaluate(() => window.scrollTo(0, 2500)); await p.waitForTimeout(300);
  const topDown = await p.evaluate(() => document.getElementById('toTop').classList.contains('show'));
  await p.click('#toTop'); await p.waitForTimeout(1500);
  const topY = await p.evaluate(() => window.scrollY);
  check('↑ Top anywhere on the Desk (Reports closed): hidden at the top, shows once scrolled down, a click goes back up', !topAtTop && topDown && topY === 0, `at top ${topAtTop} · scrolled ${topDown} · after click y=${topY}`);
  await p.close();
  p = await open({ empty: true });
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; toggleReports(); }); await p.waitForTimeout(900);
  const emptyTxt = (await p.textContent('#reportsBody')).replace(/\s+/g, ' ');
  check('Reports with no tours yet: plain empty states', /No apartments shown in this period/.test(emptyTxt) && /No tours in this period/.test(emptyTxt) && /No quiz attempts in this period/.test(emptyTxt), emptyTxt.slice(0, 200));
  await p.close();
  tag = 'reports-offline';
  p = await open({ seedLocal: true, offline: true });
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; toggleReports(); }); await p.waitForTimeout(900);
  const offTxt = (await p.textContent('#reportsBody')).replace(/\s+/g, ' ');
  check('Reports offline: says the tours couldn’t load, with Try again', /Couldn’t load the tours\. Check the connection, then Try again/.test(offTxt), offTxt.slice(0, 160));
  for (let i = errors.length - 1; i >= 0; i--) if (/^reports-offline: console: .*(Failed to get documents from server|Could not reach Cloud Firestore backend|Error: offline)/.test(errors[i])) errors.splice(i, 1);   // the fake database refuses every read here
  await p.close();

  // ===== 25. Choose what to print (production Desk v1.30, D36): a tick box per part of Reports, a menu for how it prints; left off = not printed =====
  tag = 'printpick';
  p = await open({ seedLocal: true });
  await p.evaluate(async () => { const R = await import(new URL('js/reports.js', location.href).href); window.__rpt = R.rpt; window.__render = R.renderReports; (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; toggleReports(); setReportRange(6); }); await p.waitForTimeout(900);
  await p.click('#rpt-movein .rpt-tbtn'); await p.waitForTimeout(150);   // move-in shows its table on screen
  // window.print is stubbed: it notes what would print, then fires the browser's "afterprint"
  await p.evaluate(() => { window.__printed = []; window.print = () => {
    const b = document.getElementById('reportsBody');
    window.__printed.push({ cls: document.body.classList.contains('print-reports'), w: window.__rpt.printW, kpis: !!b.querySelector('.rpt-kpis'), groups: [...b.querySelectorAll('.rpt-group')].map(g => g.textContent.trim()),
      figs: Object.fromEntries([...b.querySelectorAll('.rpt-fig')].map(f => [f.id.replace('rpt-', ''), { wide: f.classList.contains('wide'), chart: !!f.querySelector('svg.viz'), table: !!f.querySelector('table'), and: !!f.querySelector('.rpt-and'), rows: f.querySelectorAll('tbody tr').length, tiles: f.querySelectorAll('.rpt-fit').length, svgW: +((f.querySelector('svg.viz') || { getAttribute: () => 0 }).getAttribute('width')) }])) });
    setTimeout(() => window.dispatchEvent(new Event('afterprint')), 0);
  }; });
  const dlg = () => p.evaluate(() => {
    const m = document.getElementById('printPickModal'), rows = [...m.querySelectorAll('.pp-row')], ae = document.activeElement;
    const box = m.querySelector('.modal'), lab = document.getElementById(box.getAttribute('aria-labelledby') || '-');
    return { open: m.classList.contains('show'), title: m.querySelector('h2').textContent, dialog: box.getAttribute('role') === 'dialog' && box.getAttribute('aria-modal') === 'true' && !!lab && lab.textContent === 'Choose what to print', n: rows.length, ticked: rows.filter(r => r.querySelector('input').checked).length,
      menus: Object.fromEntries(rows.filter(r => r.querySelector('select')).map(r => [r.querySelector('input').dataset.part, r.querySelector('select').value])),
      allApts: (m.querySelector('select[data-part="apts"] option[value="all"]') || {}).textContent || '', groups: [...m.querySelectorAll('legend')].map(l => l.firstChild.textContent),
      gone: [...m.querySelectorAll('.pp-group.off legend')].map(l => l.firstChild.textContent), focus: ae && (ae.dataset.part || ae.getAttribute('data-rkey') || ae.textContent),
      go: !document.getElementById('printPickGo').disabled, note: document.getElementById('printPickNote').textContent };
  });
  const openPick = async () => { await p.click('#reportsBody .rpt-bar button:has-text("Print or save as PDF")'); await p.waitForFunction(() => document.getElementById('printPickModal').contains(document.activeElement), null, { timeout: 3000 }).catch(() => {}); };
  const printed = async n => { await p.waitForFunction(n => window.__printed.length === n, n, { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300); return p.evaluate(n => window.__printed[n - 1] || null, n); };
  await openPick();
  let d = await dlg();
  check('Print or save as PDF opens "Choose what to print" (a dialog to screen readers, named by its title): 14 parts under the page\'s headings, all ticked, focus on the first, nothing printed yet',
    d.open && d.title === 'Choose what to print' && d.dialog && d.n === 14 && d.ticked === 14 && d.groups.join('|') === 'Apartments shown|What prospects want|Traffic|Team' && d.focus === 'kpis' && !(await p.evaluate(() => window.__printed.length)), JSON.stringify(d));
  check('Each menu starts the way its part shows on screen: move-in a table, Net rent chart and table, the other charts as charts, the top 15 apartments; no menu on the summary, week by week, tour times or quiz',
    d.menus.movein === 'table' && d.menus.net === 'both' && ['sizes', 'bldg', 'demand', 'fit', 'weekly', 'busy'].every(k => d.menus[k] === 'chart') && d.menus.apts === 'top' && /^All \d+$/.test(d.allApts) && !['kpis', 'netweek', 'tourtimes', 'quiz'].some(k => k in d.menus), JSON.stringify(d.menus));
  const fits = await p.evaluate(() => { const g = id => document.querySelector(`#printPickList input[data-part="${id}"]`).closest('.pp-group').getBoundingClientRect(), go = document.getElementById('printPickGo').getBoundingClientRect();
    return { twoCols: g('tourtimes').left > g('sizes').left + 100, goVisible: go.bottom <= window.innerHeight && go.top >= 0 }; });
  check('At 1440 wide the list is in two columns and the Print button is on screen', fits.twoCols && fits.goVisible, JSON.stringify(fits));
  await p.click('#printPickModal button:has-text("Untick all")'); await p.waitForTimeout(100);
  d = await dlg();
  check('Untick all: Print is off with a note saying why; every heading says it\'s left off', d.ticked === 0 && !d.go && d.note === 'Tick at least one part to print.' && d.gone.length === 4, JSON.stringify(d));
  await p.click('#printPickModal button:has-text("Tick all")'); await p.waitForTimeout(100);
  d = await dlg();
  check('Tick all: everything back on, Print on', d.ticked === 14 && d.go && !d.note && !d.gone.length);
  await p.locator('#printPickList .pp-row', { hasText: 'By building' }).locator('input').uncheck();
  await p.click('#printPickModal button:has-text("Cancel")'); await p.waitForTimeout(200);
  const cancelled = await p.evaluate(() => ({ open: document.getElementById('printPickModal').classList.contains('show'), focus: document.activeElement && document.activeElement.getAttribute('data-rkey'), printed: window.__printed.length }));
  await openPick(); d = await dlg();
  check('Cancel: nothing prints and focus goes back to Print; opening it again starts with everything ticked (nothing remembered)', !cancelled.open && cancelled.focus === 'print' && !cancelled.printed && d.open && d.ticked === 14, JSON.stringify(cancelled) + ` · ticked ${d.ticked}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check('Esc closes it', !(await dlg()).open);
  // Left off: week by week, By building, still available, move-in, all of Traffic, quiz. Sizes chart and table; demand and fit tables; every apartment
  await openPick();
  for (const name of ['Week by week (the size picked on screen)', 'By building', 'Most-shown, still available', 'When they want to move in', 'Tours per week', 'Busiest days and times', 'Training quiz results'])
    await p.locator('#printPickList .pp-row', { hasText: name }).locator('input').uncheck();
  await p.selectOption('#printPickList select[data-part="sizes"]', 'both');
  await p.selectOption('#printPickList select[data-part="demand"]', 'table');
  await p.selectOption('#printPickList select[data-part="fit"]', 'table');
  await p.selectOption('#printPickList select[data-part="apts"]', 'all');
  d = await dlg();
  const offRow = await p.evaluate(() => { const r = [...document.querySelectorAll('#printPickList .pp-row')].find(x => /When they want to move in/.test(x.textContent)); return { menu: getComputedStyle(r.querySelector('select')).display !== 'none', said: getComputedStyle(r.querySelector('.pp-off')).display !== 'none' }; });
  check('A part left off says "Left off" in place of its menu; a heading with nothing ticked says it\'s left off', !offRow.menu && offRow.said && d.gone.join('|') === 'Traffic', JSON.stringify(offRow) + ' · ' + d.gone.join('|'));
  const nApts = +d.allApts.replace(/\D/g, '');
  await p.click('#printPickModal button:has-text("Print or save as PDF")');
  const pp = await printed(1), has = k => !!(pp && pp.figs[k]);
  check('Printed only the ticked parts: the ones left off aren\'t on the page at all, and the Traffic heading goes with them',
    pp && pp.cls && pp.w === 960 && pp.kpis && ['sizes', 'apts', 'demand', 'net', 'fit', 'tourtimes'].every(has) && !['netweek', 'bldg', 'still', 'movein', 'weekly', 'busy', 'quiz'].some(has) && pp.groups.join('|') === 'Apartments shown|What prospects want|Team',
    pp && JSON.stringify({ figs: Object.keys(pp.figs), groups: pp.groups }));
  check('Printed as picked: sizes chart and table, demand and within-their-price as tables (the fit tiles once), Net rent chart and table, every apartment; sizes and demand full width with their partners left off',
    pp && pp.figs.sizes.chart && pp.figs.sizes.and && pp.figs.sizes.table && !pp.figs.demand.chart && pp.figs.demand.table && !pp.figs.fit.chart && pp.figs.fit.table && pp.figs.fit.tiles === 1 && pp.figs.net.chart && pp.figs.net.table && nApts > 15 && pp.figs.apts.rows === nApts && pp.figs.sizes.wide && pp.figs.sizes.svgW === 926 && pp.figs.demand.wide,
    pp && JSON.stringify(pp.figs));
  const screenBack = await p.evaluate(() => { const b = document.getElementById('reportsBody'); return { pick: window.__rpt.printPick, cls: document.body.classList.contains('print-reports'), figs: b.querySelectorAll('.rpt-fig').length,
    movein: !!b.querySelector('#rpt-movein table') && !b.querySelector('#rpt-movein svg.viz'), sizes: !!b.querySelector('#rpt-sizes svg.viz') && !b.querySelector('#rpt-sizes table'), apts: b.querySelectorAll('#rpt-apts tbody tr').length, focus: document.activeElement && document.activeElement.getAttribute('data-rkey') }; });
  check('After printing, the screen is as it was: every part back, move-in still a table, sizes still a chart, the top 15 apartments, focus on Print',
    screenBack.pick === null && !screenBack.cls && screenBack.figs === 13 && screenBack.movein && screenBack.sizes && screenBack.apts === 15 && screenBack.focus === 'print', JSON.stringify(screenBack));
  await openPick();
  await p.selectOption('#printPickList select[data-part="busy"]', 'table');
  await p.click('#printPickModal button:has-text("Print or save as PDF")');
  const pa = await printed(2);
  check('Everything ticked prints all 13 parts the way they show on screen; busiest days and times as a table prints full width, and so does tours per week beside it',
    pa && Object.keys(pa.figs).length === 13 && pa.groups.length === 4 && pa.kpis && pa.figs.movein.table && !pa.figs.movein.chart && pa.figs.weekly.chart && !pa.figs.weekly.table && pa.figs.busy.wide && pa.figs.busy.table && !pa.figs.busy.chart && pa.figs.weekly.wide && pa.figs.weekly.svgW === 926 && !pa.figs.sizes.wide && pa.figs.sizes.svgW === 438,
    pa && JSON.stringify(pa.figs));
  // Nothing runs past its box with every chart printed as chart and table and every apartment listed (US Letter landscape, 12 mm margins)
  const every = { kpis: true, netweek: true, tourtimes: true, quiz: true, apts: 'all', still: 'all' }; ['sizes', 'bldg', 'demand', 'movein', 'net', 'fit', 'weekly', 'busy'].forEach(k => { every[k] = 'both'; });
  await p.setViewportSize({ width: 965, height: 900 }); await p.emulateMedia({ media: 'print' });
  const spill = await p.evaluate(every => {
    document.body.classList.add('print-reports'); window.__rpt.printPick = every; window.__rpt.printW = 960; window.__render();
    const out = [...document.querySelectorAll('#reportsBody .rpt-fig')].map(f => { const cs = getComputedStyle(f), edge = f.getBoundingClientRect().right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
      return [f.id, Math.round(Math.max(0, ...[...f.querySelectorAll('table')].map(t => t.getBoundingClientRect().right - edge)))]; }).filter(([, o]) => o > 1);
    document.body.classList.remove('print-reports'); window.__rpt.printPick = null; window.__rpt.printW = 0; window.__render(); return out;
  }, every);
  await p.emulateMedia({ media: 'screen' }); await p.setViewportSize({ width: 1440, height: 900 });
  check('Printed with every chart as chart and table, no table runs past its box (Letter landscape)', !spill.length, JSON.stringify(spill));
  // ↑ Top sits under dialogs and toasts and over the pinned Reports bar (production v1.29 let it float over open dialogs)
  await p.evaluate(() => window.scrollTo(0, document.getElementById('rpt-net').getBoundingClientRect().top + window.scrollY - 200)); await p.waitForTimeout(400);
  await openPick();
  const atTop = () => p.evaluate(() => { const t = document.getElementById('toTop'), r = t.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { shown: t.classList.contains('show'), hit: hit === t ? 'button' : hit && hit.closest('#printPickModal') ? 'dialog' : hit ? hit.tagName : 'none' }; });
  const underDlg = await atTop(), z = await p.evaluate(() => ['#reportsBody .rpt-bar', '#toTop', '#printPickModal', '.toast'].map(s => +getComputedStyle(document.querySelector(s)).zIndex));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  const noDlg = await atTop();
  check('↑ Top sits under an open dialog (and toasts) and over the pinned Reports bar; with the dialog closed it can be clicked',
    underDlg.shown && underDlg.hit === 'dialog' && noDlg.hit === 'button' && z[0] < z[1] && z[1] < z[2] && z[1] < z[3], `${JSON.stringify(underDlg)} · closed ${JSON.stringify(noDlg)} · layers ${z.join(' < ')}`);
  await p.close();

  // ===== 26. Leasing assistant contest (production Desk v1.29, D35): a NOTES "gift card" → a green 🎁 flag on the Desk unit
  // list until its date, and "gift card" in the search; never in emails, not in Reports (the iPad: ipad_flows.js) =====
  tag = 'contest';
  p = await open({ seedLocal: true });
  // The seed: #3107 "$150 gift card for a lease by 10/22" (16 days after the pinned Oct 6) and #2608 with no date
  const K3107 = '2230 TIDEMARK BLVD::3107', K2608 = '2040 TIDEMARK BLVD::2608';
  const contestFlags = keys => p.evaluate(ks => ks.map(k => ((document.querySelector(`.unit-row[data-key="${k}"] .flag.contest`) || {}).textContent || '')), keys);
  const seededContest = await p.evaluate(async () => {
    const [{ state }, { contestDeadline }] = await Promise.all([import(new URL('js/state.js', location.href).href), import(new URL('js/rules/contest.js', location.href).href)]);
    const f = document.querySelector('.unit-row[data-key="2230 TIDEMARK BLVD::3107"] .flag.contest');
    return { units: state.units.filter(u => u.contest).map(u => [u.unit, u.contestUntil || '', contestDeadline(u.contest)]), title: f ? f.title : '' };
  });
  const seededFlags = await contestFlags([K3107, K2608]);
  check('Demo seed: two gift card units, each dated as the reader works it out from the note; both flagged in the unit list, the note in full on hover',
    seededContest.units.length === 2 && seededContest.units.every(([, until, read]) => until === read) && seededContest.units.some(([u, until]) => u === '3107' && until === '2026-10-22')
    && seededFlags[0] === '🎁 $150 gift card for a lease by 10/22' && /^🎁 \$100 Gift Card/.test(seededFlags[1]) && /never in emails/.test(seededContest.title), `${JSON.stringify(seededContest)} · ${seededFlags.join(' / ')}`);
  // A page left open: the flag is there through 11:59 PM on the deadline and gone at midnight; the undated one stays
  const flagsAt = async t => { await ctx.clock.setFixedTime(new Date(t)); await p.evaluate(() => renderUnitList()); return contestFlags([K3107, K2608]); };
  const lastDay = await flagsAt('2026-10-22T23:59:00-04:00'), dayAfter = await flagsAt('2026-10-23T00:00:30-04:00');
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00')); await p.evaluate(() => renderUnitList());
  check('…shown through its deadline day, gone the day after; a note with no date stays', !!lastDay[0] && !!lastDay[1] && !dayAfter[0] && !!dayAfter[1], `Oct 22 11:59 PM: ${lastDay.map(Boolean).join('/')} · Oct 23: ${dayAfter.map(Boolean).join('/')}`);
  // The real reader on invented NOTES (columns in another order: it goes by the header names)
  const ct = await p.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const [{ parseShowsheet }, { state }, { buildEmailHTML }] = await Promise.all([imp('js/showsheet.js'), imp('js/state.js'), imp('js/email-builder.js')]);
    const H = ['UNIT', 'TYPE', 'VIEW', 'SQ FT', 'MONTHLY', 'NET EFF', 'INCENTIVE', 'AVAIL', 'NOTES'];
    const notes = [['5201', '$250 gift card, deadline 10/31'], ['5202', 'GIFT CARD $175 - ends Nov 15'], ['5203', '$250 giftcard 10/5'], ['5204', 'Keys at the front desk'], ['5205', ''], ['5206', '$125 gift card'],
      ['5207', 'Occupied'], ['5208', 'Gift card $50, today only: 10/6'], ['5209', '<img src=x onerror="window.__pwned=\'contest\'"> gift card & "more"']];
    parseShowsheet([['2050 TIDEMARK BLVD'], ['1 BEDROOMS'], H].concat(notes.map(([u, n]) => [u, '1 Bed, 1 Bath', 'River', 700, 4000, 3667, '1 Month Free', '', n])), new Set());
    const got = Object.fromEntries(state.units.map(u => [u.unit, [u.contest || '', u.contestUntil || '']]));
    const K = n => '2050 TIDEMARK BLVD::' + n;
    const flag = n => ((document.querySelector(`.unit-row[data-key="${K(n)}"] .flag.contest`) || {}).textContent || '');
    setMode('tour'); renderUnitList();
    const tourFlags = Object.fromEntries(['5201', '5202', '5203', '5204', '5206', '5208', '5209'].map(n => [n, flag(n)]));
    const hostile = { img: !!document.querySelector('#unitListContainer img'), pwned: window.__pwned || null, title: (document.querySelector(`.unit-row[data-key="${K('5209')}"] .flag.contest`) || {}).title || '' };
    const listShownIn = m => { setMode(m); return getComputedStyle(document.querySelector('.for-units')).display !== 'none'; };
    const shown = Object.fromEntries(['tour', 'inquiry', 'welcome', 'pfa', 'appconf', 'approval'].map(m => [m, listShownIn(m)]));
    setMode('inquiry'); renderUnitList(); const inquiryFlag = flag('5201');
    const box = document.getElementById('unitSearch');
    box.value = 'gift card'; box.dispatchEvent(new Event('input'));
    const searched = [...document.querySelectorAll('#unitListContainer .unit-row')].map(r => r.getAttribute('data-key').split('::')[1]).sort().join(',');
    box.value = ''; box.dispatchEvent(new Event('input'));
    const mails = {};
    for (const m of ['tour', 'inquiry']) { setMode(m); toggleUnit(K('5201')); toggleUnit(K('5206')); mails[m] = buildEmailHTML(); toggleUnit(K('5201')); toggleUnit(K('5206')); }
    setMode('tour');
    return { got, tourFlags, hostile, shown, inquiryFlag, searched, giftInMail: Object.values(mails).some(h => /gift|contest|deadline|🎁/i.test(h)), mailHasUnits: Object.values(mails).every(h => h.includes('#5201') && h.includes('#5206')) };
  });
  check('The reader: any note with "gift card" (any capitals, "giftcard" too) kept as written, its date read (10/31, Nov 15, 10/5); other notes ignored',
    ct.got['5201'].join('|') === '$250 gift card, deadline 10/31|2026-10-31' && ct.got['5202'][1] === '2026-11-15' && ct.got['5203'][1] === '2026-10-05' && ct.got['5206'].join('|') === '$125 gift card|'
    && !ct.got['5204'][0] && !ct.got['5205'][0] && !ct.got['5207'][0], JSON.stringify(ct.got));
  check('…flagged in Tour and Inquiry follow-up as written; gone the day after its deadline (10/5 on Oct 6), shown on the day (10/6); a note with no date stays',
    ct.tourFlags['5201'] === '🎁 $250 gift card, deadline 10/31' && /ends Nov 15/.test(ct.tourFlags['5202']) && !ct.tourFlags['5203'] && !ct.tourFlags['5204'] && ct.tourFlags['5206'] === '🎁 $125 gift card'
    && /today only/.test(ct.tourFlags['5208']) && ct.inquiryFlag === ct.tourFlags['5201'], JSON.stringify(ct.tourFlags));
  check('…a note with markup and quotes stays text (shortened to 48 characters on the flag, in full on hover)',
    !ct.hostile.img && !ct.hostile.pwned && /^🎁 <img src=x onerror=/.test(ct.tourFlags['5209']) && /…$/.test(ct.tourFlags['5209']) && ct.hostile.title.startsWith('<img src=x onerror="window.__pwned=\'contest\'"> gift card & "more"'), `${ct.tourFlags['5209']} · ${JSON.stringify(ct.hostile)}`);
  check('The unit list (with the flag) shows only in Tour and Inquiry follow-up', ct.shown.tour && ct.shown.inquiry && !ct.shown.welcome && !ct.shown.pfa && !ct.shown.appconf && !ct.shown.approval, JSON.stringify(ct.shown));
  check('Typing "gift card" in the unit search lists just the contest units still running', ct.searched === '5201,5202,5206,5208,5209', ct.searched);
  check('Never in an email: Tour and Inquiry follow-ups with two contest units say nothing about the gift card', !ct.giftInMail && ct.mailHasUnits, `gift in email: ${ct.giftInMail} · units in both: ${ct.mailHasUnits}`);
  await p.evaluate(() => publishShowsheet()); await p.waitForTimeout(800);
  const pubContest = await p.evaluate(() => { const c = window.__STORE.showsheet.current || {}; return { units: (c.units || []).filter(u => u.contest).map(u => `${u.unit}:${u.contestUntil || '-'}`), other: JSON.stringify(c).includes('Keys at the front desk') }; });
  check('Publish sends the gift card note and its date (so every Desk sees it), and still no other note', pubContest.units.join(',') === '5201:2026-10-31,5202:2026-11-15,5203:2026-10-05,5206:-,5208:2026-10-06,5209:-' && !pubContest.other, `${pubContest.units.join(', ')} · other note published: ${pubContest.other}`);
  await p.close();
  p = await open({ seedLocal: true });
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; toggleReports(); }); await p.waitForTimeout(1500);
  const rptContest = await p.evaluate(() => { const b = document.getElementById('reportsBody'); return { drawn: !!b.querySelector('.rpt'), gift: /gift\s*card|🎁/i.test(b.textContent) }; });
  check('Not in Reports: no gift card anywhere in it', rptContest.drawn && !rptContest.gift, JSON.stringify(rptContest));
  await p.close();

  // ===== 27. The Desk on a phone (production Desk v1.32, D40): one layer under 600px wide; desktops never see it. Every screen on an
  // emulated iPhone, and nothing moved at 1440 / 1280 / 768, are checked by desk_capture.sh … phone and desk_same_layout.sh =====
  tag = 'phone';
  p = await open({ seedLocal: true });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } }); await p.waitForTimeout(250);
  const ph = await p.evaluate(() => {
    const cols = el => getComputedStyle(el).gridTemplateColumns.split(' ').length, row = document.querySelector('#queueBody .queue-row'), r = sel => row.querySelector(sel).getBoundingClientRect();
    const btns = [...document.querySelectorAll('#queuePanel button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(b => b.width < 44 || b.height < 44).length;
    return { wide: document.documentElement.scrollWidth, tabs: cols(document.getElementById('queueTabs')), rowCols: cols(row), whenUnder: r('.when').top > r('.who').top && Math.abs(r('.when').left - r('.who').left) < 2, btns };
  });
  check('Phone (390 wide): the page fits, the tabs sit two by two, a queue row is a card (the name, then when, then the buttons), every queue button at least 44 px',
    ph.wide <= 390 && ph.tabs === 2 && ph.rowCols === 2 && ph.whenUnder && !ph.btns, JSON.stringify(ph));
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(200);
  const pm = await p.evaluate(() => {
    const m = document.querySelector('#planModal .modal').getBoundingClientRect(), h = document.querySelector('#planModal .panel-header'), close = h.querySelector('button').getBoundingClientRect();
    const first = document.getElementById('planFirst').getBoundingClientRect(), last = document.getElementById('planProspect').getBoundingClientRect();
    return { w: m.width, h: m.height, x: m.left, y: m.top, head: getComputedStyle(h).position, closeTop: close.top < 60, oneCol: last.top > first.bottom - 1, font: getComputedStyle(document.getElementById('planFirst')).fontSize };
  });
  check('…Plan a tour fills the screen with its title and ✕ Close pinned at the top, one field per line, text boxes 16px (no zoom on tap)',
    pm.w === 390 && pm.h === 844 && !pm.x && !pm.y && pm.head === 'sticky' && pm.closeTop && pm.oneCol && pm.font === '16px', JSON.stringify(pm));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  const ur = await p.evaluate(() => { const row = document.querySelector('.unit-row[data-key="2050 TIDEMARK BLVD::1812"]'), b = s => row.querySelector(s).getBoundingClientRect();
    return { sameLine: Math.abs(b('.unit-num').top - b('.unit-rent').top) < 2, descUnder: b('.unit-desc').top >= b('.unit-num').bottom - 1, rentRight: b('.unit-rent').right > b('.unit-num').right }; });
  check('…an Email Builder unit row shows the number and the rent on one line, the description under them', ur.sameLine && ur.descUnder && ur.rentRight, JSON.stringify(ur));
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; toggleReports(); setReportRange(6); }); await p.waitForTimeout(1200);
  const rp = await p.evaluate(() => {
    const fig = document.getElementById('rpt-sizes'), cs = getComputedStyle(fig), inner = fig.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    return { kpiCols: getComputedStyle(document.querySelector('#reportsBody .rpt-kpis')).gridTemplateColumns.split(' ').length, bar: getComputedStyle(document.querySelector('#reportsBody .rpt-bar')).position,
      chart: +fig.querySelector('svg.viz').getAttribute('width'), inner: Math.round(inner), wide: document.documentElement.scrollWidth };
  });
  check('…Reports: the six numbers two by two, the bar scrolls with the page (not pinned), charts the width of the screen, no sideways scroll',
    rp.kpiCols === 2 && rp.bar === 'static' && rp.chart <= rp.inner && rp.chart >= rp.inner - 40 && rp.wide <= 390, JSON.stringify(rp));
  // A tap on a chart column: the details show, stay up when the finger lifts, and go away with a tap elsewhere (events as a phone sends them)
  const tip = await p.evaluate(() => {
    const hit = document.querySelectorAll('#rpt-sizes .viz-hit')[3], r = hit.getBoundingClientRect(), x = r.left + r.width / 2, y = r.bottom - 10;
    const fire = (el, type, pointerType, extra) => el.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true, pointerType, clientX: x, clientY: y }, extra)));
    const shown = () => { const t = document.querySelector('.viz-tip'); return !!t && t.style.display === 'block'; };
    fire(hit, 'pointerdown', 'mouse'); const mouseDown = shown();
    fire(hit, 'pointerdown', 'touch'); const tapped = shown(), text = (document.querySelector('.viz-tip') || {}).textContent || '';
    fire(hit, 'pointerout', 'touch', { relatedTarget: null }); const lifted = shown();
    fire(document.querySelector('#reportsBody .rpt-kpis'), 'pointerdown', 'touch'); const elsewhere = shown();
    fire(hit, 'pointerdown', 'pen'); const pen = shown();
    fire(hit, 'pointerout', 'mouse', { relatedTarget: null }); const mouseLeft = shown();
    return { mouseDown, tapped, text: text.slice(0, 40), lifted, elsewhere, pen, mouseLeft };
  });
  check('…a tap on a chart column shows its details (a finger or a pen, not a mouse click); they stay up when the finger lifts and go with a tap elsewhere; a mouse leaving the window still hides them',
    !tip.mouseDown && tip.tapped && /shown/.test(tip.text) && tip.lifted && !tip.elsewhere && tip.pen && !tip.mouseLeft, JSON.stringify(tip));
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(400);
  const desk = await p.evaluate(() => { const row = document.querySelector('#queueBody .queue-row'); openPlanTour(); const m = document.querySelector('#planModal .modal').getBoundingClientRect(); document.getElementById('planModal').classList.remove('show');
    return { bar: getComputedStyle(document.querySelector('#reportsBody .rpt-bar')).position, rowCols: getComputedStyle(row).gridTemplateColumns.split(' ').length, modal: Math.round(m.width), font: getComputedStyle(document.getElementById('planFirst')).fontSize,
      kpiRow: new Set([...document.querySelectorAll('#reportsBody .rpt-kpi')].map(k => Math.round(k.getBoundingClientRect().top))).size }; });
  check('Back at 1440 wide nothing of the phone layer is left: the Reports bar is pinned again, rows have their four columns, Plan a tour is a 720px dialog with 13px text boxes, the six numbers in one row',
    desk.bar === 'sticky' && desk.rowCols === 4 && desk.modal === 720 && desk.font === '13px' && desk.kpiRow === 1, JSON.stringify(desk));
  await p.close();

  // ===== 28. Security fixes (production Desk v1.33, D41–D43): no prospect email anywhere, apostrophes in every button,
  // https-only floor plan links, a clean calendar file, and Dropbox links that are Dropbox-only and behind the manager PIN.
  // (Production's one-off erase of emails already saved is not ported: the demo never had any.) =====
  tag = 'security';
  p = await open({ seedLocal: true });
  const seededEmails = await p.evaluate(() => [...Object.values(window.__STORE.tours), ...Object.values(window.__STORE.future_leads)].filter(x => Object.keys(x).some(k => /mail/i.test(k))).map(x => x.id));
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(200);
  const planFields = await p.evaluate(() => ({ emailBox: !!document.querySelector('#planEmail, #planModal input[type="email"]'), mailLabel: [...document.querySelectorAll('#planModal label')].some(l => /e-?mail/i.test(l.textContent)) }));
  await p.fill('#planFirst', 'Testy'); await p.fill('#planProspect', 'E');
  await p.check('#planBeds input[value="Studio"]'); await p.fill('#planMax', '3300'); await p.fill('#planMoveIn', '2026-11-15');   // a top price: required since production v1.34 (D45)
  await p.click('#planSubmit'); await p.waitForTimeout(500);
  const tE = await p.evaluate(() => Object.values(window.__STORE.tours).find(t => t.prospect === 'Testy E.') || null);
  check('Plan a tour asks for no email, the tour it saves has none, and no seeded tour or lead holds one (D41)',
    !planFields.emailBox && !planFields.mailLabel && tE && !Object.keys(tE).some(k => /mail/i.test(k)) && !seededEmails.length, `${JSON.stringify(planFields)} · saved: ${tE ? Object.keys(tE).join(', ') : 'nothing'} · seeded with an email: ${seededEmails.join(', ') || 'none'}`);
  await tab(p, 'Current Queue');
  const copyEmailBtns = await p.locator('#queueBody button:has-text("Copy email")').count();
  await row(p, 'Daniel R.').locator('button:has-text("Copy 10-min heads-up")').click();
  const headsMsg = await waitToast(p, /Heads-up copied\. Paste it into an email to them\./);
  const headsClip = await p.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
  check('Waiting rows have no Copy email button; Copy 10-min heads-up still copies the note, to paste into an email to them', !copyEmailBtns && headsMsg && /^Hi Daniel,/.test(headsClip.trim()) && /about 10 minutes away/.test(headsClip),
    `${copyEmailBtns} Copy email button(s) · ${await lastToast(p)} · ${headsClip.replace(/\s+/g, ' ').slice(0, 60)}`);

  // Names and IDs with an apostrophe work on every button (invented: an assistant Lena O'Hara, a tour and a Future Move-In)
  await p.evaluate(async () => {
    const db = firebase.firestore(), now = new Date().toISOString(), ago = new Date(Date.now() - 5 * 60000).toISOString();
    const { team } = await import(new URL('../shared/team.js', location.href).href);
    await db.collection('settings').doc('assistants').set({ names: team.assistants.concat(["Lena O'Hara"]) });
    await db.collection('tours').doc("t-theo-d'angelo").set({ id: "t-theo-d'angelo", kind: 'tour', assistant: '', prospect: "Theo D'Angelo", prospectFirst: 'Theo', prospectInitial: 'D', stops: [], profile: null, source: 'toolkit', createdAtIso: ago, queuedAtIso: ago, startedAtIso: null, finishedAtIso: null, updatedAtIso: now });
    await db.collection('future_leads').doc("m-ines-o'malley").set({ id: "m-ines-o'malley", source: 'manual', name: "Ines O'Malley", assistant: '', tourDate: '2026-10-01', moveIn: '2027-01-20', followUpDate: '2026-12-21', criteria: '1 Bed', units: '', status: 'open' });
  });
  await p.waitForTimeout(500);
  await tab(p, 'Current Queue');
  await row(p, "Theo D'Angelo").locator('button:has-text("Copy 10-min heads-up")').click();
  const theoHeads = await waitToast(p, /Heads-up copied/);
  await row(p, "Theo D'Angelo").locator('select.queue-assign').selectOption('Rosa'); await p.waitForTimeout(400);
  const theoAssigned = await p.evaluate(() => (window.__STORE.tours["t-theo-d'angelo"] || {}).assistant);
  await row(p, "Theo D'Angelo").locator('button.queue-del').click(); await p.waitForTimeout(600);
  const theoGone = await p.evaluate(() => !window.__STORE.tours["t-theo-d'angelo"]);
  check("A tour whose ID has an apostrophe: Copy 10-min heads-up, the assistant picker and Delete work", theoHeads && theoAssigned === 'Rosa' && theoGone, `heads-up ${theoHeads} · assistant ${theoAssigned} · deleted ${theoGone}`);
  await tab(p, 'Future Move-Ins');
  await row(p, "Ines O'Malley").locator('button:has-text("Copy follow-up")').click(); await p.waitForTimeout(400);
  const inesClip = await p.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
  const [inesIcs] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), row(p, "Ines O'Malley").locator('button:has-text("Add to Outlook")').click()]);
  await row(p, "Ines O'Malley").locator('button:has-text("Delete")').click(); await p.waitForTimeout(500);
  const inesGone = await p.evaluate(() => { const l = window.__STORE.future_leads["m-ines-o'malley"]; return !l || l.status === 'deleted'; }) && (await row(p, "Ines O'Malley").count()) === 0;
  check("A Future Move-In whose ID has an apostrophe: Copy follow-up, Add to Outlook and Delete work", /^Hi Ines,/.test(inesClip.trim()) && !!inesIcs && inesGone, `copied ${inesClip.replace(/\s+/g, ' ').slice(0, 30)} · calendar file ${!!inesIcs} · deleted ${inesGone}`);
  await tab(p, 'Rotation');
  const lenaBtn = () => row(p, "Lena O'Hara").locator('.acts button');
  const lenaBefore = ((await lenaBtn().textContent()) || '').trim();
  await lenaBtn().click(); await p.waitForTimeout(500);
  const lenaAfter = ((await lenaBtn().textContent()) || '').trim();
  check("An assistant named O'Hara: Mark out works in Rotation", lenaBefore === 'Mark out' && lenaAfter === 'Mark back in', `${lenaBefore} → ${lenaAfter}`);
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; renderTourQueue(); }); await p.waitForTimeout(300);
  const schedRow = p.locator('#queueBody > table tr', { hasText: "Lena O'Hara" });
  await schedRow.locator('input[type=checkbox]').first().click(); await p.waitForTimeout(400);
  const lenaSched = await p.evaluate(() => ((window.__STORE.settings.schedule || {}).byName || {})["Lena O'Hara"] || null);
  await schedRow.locator('button:has-text("Remove")').click(); await p.waitForTimeout(500);
  const teamNow = await p.evaluate(() => window.__STORE.settings.assistants.names);
  check("…and her schedule tick box and Remove work too", JSON.stringify(lenaSched) === '[1,2,3,4,5,6]' && !teamNow.includes("Lena O'Hara"), `${JSON.stringify(lenaSched)} · ${teamNow.join(', ')}`);
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = false; renderTourQueue(); });
  // A unit number with an apostrophe in the Email Builder: pick it and type in its editor
  const ukey = await p.evaluate(async () => {
    const imp = f => import(new URL(f, location.href).href);
    const { state } = await imp('js/state.js'), { unitSelectKey } = await imp('js/units.js');
    const u = Object.assign({}, state.units.find(x => x.unit === '506'), { unit: "7'A" }); state.units.push(u); (await imp('js/unit-list.js')).renderUnitList(); return unitSelectKey(u);
  });
  await p.click(`.unit-row[data-key="${ukey}"] .unit-info`); await p.waitForTimeout(500);
  await p.locator(`.inline-editor[data-sel-key="${ukey}"] textarea`).fill('Loved the light'); await p.waitForTimeout(200);
  const typed = await p.evaluate(async k => ((await import(new URL('js/state.js', location.href).href)).state.selectedUnits.find(s => s.key === k) || {}).notes || '', ukey);
  check("A unit number with an apostrophe: it can be picked and its editor saves what's typed", typed === 'Loved the light', typed || 'nothing saved');
  // Floor plan links in emails (D43): http:// goes out as https://; anything else is no link ("[Floor plan link missing]" in the tour email)
  const fpOut = await p.evaluate(async k => {
    const imp = f => import(new URL(f, location.href).href);
    const { state } = await imp('js/state.js'), { buildEmailHTML } = await imp('js/email-builder.js');
    const { buildApprovalHTML } = await imp('js/approval-email.js'), { buildAppConfHTML } = await imp('js/application-email.js');
    const s = state.selectedUnits.find(x => x.key === k); s.addFloorPlan = true;
    s.floorPlan = 'http://example.com/plan-7a.pdf'; const tourUp = buildEmailHTML();
    s.floorPlan = 'ftp://example.com/plan-7a.pdf'; const tourFtp = buildEmailHTML();
    const form = (toggle, box, build) => { document.getElementById(toggle).checked = true; document.getElementById(box).value = 'http://example.com/plan-7a.pdf'; const up = build();
      document.getElementById(box).value = 'javascript:alert(1)'; const bad = build(); document.getElementById(toggle).checked = false; document.getElementById(box).value = '';
      return up.includes('href="https://example.com/plan-7a.pdf"') && !/javascript:|http:\/\/example/.test(bad) && /\[paste floor plan link\]/.test(bad); };
    return { tourUpgraded: tourUp.includes('href="https://example.com/plan-7a.pdf"') && !tourUp.includes('http://example.com'), tourDropped: !tourFtp.includes('ftp://') && tourFtp.includes('[Floor plan link missing]'),
      approval: form('apvFloorPlanToggle', 'apvFloorPlan', buildApprovalHTML), appConf: form('appConfFloorPlanToggle', 'appConfFloorPlan', buildAppConfHTML) };
  }, ukey);
  check('Floor plan links in the tour, Lease Approval and Application Confirmation emails: http:// is sent as https://, anything else is no link',
    fpOut.tourUpgraded && fpOut.tourDropped && fpOut.approval && fpOut.appConf, JSON.stringify(fpOut));
  // Calendar file (D43): a line break saved in a lead can't add a line of its own; a bad date makes no file
  await p.evaluate(() => { const db = firebase.firestore();
    db.collection('future_leads').doc('m-cal').set({ id: 'm-cal\nSUMMARY:Other', source: 'manual', name: 'Remy C.', assistant: '', tourDate: '2026-10-01', moveIn: '2027-02-01', followUpDate: '2027-01-02', criteria: 'Studio\r\nDTSTART:20300101T000000', units: '', status: 'open' });
    db.collection('future_leads').doc('m-bad').set({ id: 'm-bad', source: 'manual', name: 'Odile B.', assistant: '', tourDate: '2026-10-01', moveIn: '2027-02-01', followUpDate: 'soon', criteria: '', units: '', status: 'open' }); });
  await p.waitForTimeout(400); await tab(p, 'Future Move-Ins');
  const [cdl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), row(p, 'Remy C.').locator('button:has-text("Add to Outlook")').click()]);
  let cics = ''; if (cdl) { try { const st = await cdl.createReadStream(); for await (const c of st) cics += c; } catch (e) { cics = 'unreadable'; } }
  const summaries = (cics.match(/^SUMMARY:/gm) || []).length, dtstarts = (cics.match(/^DTSTART:/gm) || []).length, uidLine = (cics.match(/^UID:[^\r\n]*/m) || [''])[0];
  const [bdl] = await Promise.all([p.waitForEvent('download', { timeout: 2000 }).catch(() => null), row(p, 'Odile B.').locator('button:has-text("Add to Outlook")').click()]);
  const badMsg = await waitToast(p, /no valid follow-up date/);
  check('Calendar file: a line break saved in a lead adds no line of its own (one SUMMARY, one DTSTART, a UID of letters, digits, ".", "-", "_"), and a bad date makes no file',
    cdl && summaries === 1 && dtstarts === 1 && uidLine === 'UID:m-calSUMMARYOther@leasing-desk.example' && !bdl && badMsg, `${summaries} SUMMARY · ${dtstarts} DTSTART · ${uidLine} · file for a bad date: ${!!bdl} · ${await lastToast(p)}`);
  await p.close();

  // Dropbox links (D42): only Dropbox, and changing them or turning sync off needs the manager PIN
  p = await open({ seedLocal: true, dbx: true });
  const asked = []; p.on('request', r => { if (/files\.example\.com/.test(r.url())) asked.push(r.url()); });
  const dbxUrl = () => p.evaluate(() => window.__STORE.settings.dropboxSync.showsheetUrl);
  const url0 = await dbxUrl();
  await p.evaluate(() => openDbxSettings()); await p.waitForTimeout(200);
  const helpText = (await p.textContent('#dbxModal')).replace(/\s+/g, ' ');
  await p.fill('#dbxSs', 'https://files.example.com/showsheet.xlsx'); await p.click('#dbxModal button:has-text("Test link")'); await p.waitForTimeout(400);
  const testMsg = (await p.textContent('#dbxSsTest')).trim();
  check('Dropbox settings say a change needs the manager PIN; Test link refuses a link on another site without downloading it',
    /Changing a link or turning sync off needs the manager PIN, and only Dropbox links work\./.test(helpText) && /Only Dropbox share links work here/.test(testMsg) && !asked.length, `${testMsg} · requests to that site: ${asked.length}`);
  p.__dialogs.length = 0;
  await p.click('#dbxModal button:has-text("Save")');
  const notDbx = await waitToast(p, /Only Dropbox share links work here/), noPinYet = !p.__dialogs.some(m => /PIN/.test(m));
  p.__answer = '';   // a wrong (empty) PIN
  await p.fill('#dbxSs', 'https://www.dropbox.com/scl/fi/zz9/Other_Showsheet.xlsx?rlkey=q1&dl=0'); await p.click('#dbxModal button:has-text("Save")'); await p.waitForTimeout(300);
  const pinAsked = p.__dialogs.some(m => /Manager PIN/.test(m)), unchanged = (await dbxUrl()) === url0;
  check('Dropbox: Save refuses a link on another site (no PIN asked); a new Dropbox link asks for the manager PIN, and a wrong PIN saves nothing', notDbx && noPinYet && pinAsked && unchanged, `refused ${notDbx} · PIN asked ${pinAsked} · unchanged ${unchanged}`);
  p.__dialogs.length = 0;
  await p.evaluate(() => openDbxSettings()); await p.waitForTimeout(200);
  await p.click('#dbxOffBtn'); await p.waitForTimeout(300);
  const offPin = p.__dialogs.some(m => /Manager PIN/.test(m)), stillOn = (await dbxUrl()) === url0;
  p.__dialogs.length = 0; p.__answer = undefined;
  await p.evaluate(() => openDbxSettings()); await p.waitForTimeout(200);
  await p.click('#dbxModal button:has-text("Save")'); await p.waitForTimeout(300);
  const sameNoPin = !p.__dialogs.some(m => /PIN/.test(m));
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; openDbxSettings(); }); await p.waitForTimeout(200);   // as after entering the PIN
  await p.fill('#dbxSs', 'https://www.dropbox.com/scl/fi/zz9/Other_Showsheet.xlsx?rlkey=q1&dl=0'); await p.click('#dbxModal button:has-text("Save")'); await p.waitForTimeout(1500);
  const dbxSaved = /Other_Showsheet/.test(await dbxUrl());
  check('Turning sync off needs the PIN too; saving the links unchanged needs none; once unlocked, a new Dropbox link saves', offPin && stillOn && sameNoPin && dbxSaved, `turn-off PIN ${offPin} · still on ${stillOn} · unchanged save asked no PIN ${sameNoPin} · saved ${dbxSaved}`);
  await p.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => firebase.firestore().collection('settings').doc('dropboxSync').set({ showsheetUrl: 'https://files.example.com/showsheet.xlsx' }, { merge: true }));
  await p.waitForTimeout(300); await p.click('#dbxSyncBtn');
  const refusedSync = await waitToast(p, /only Dropbox links can be synced/);
  check('A link on another site written straight into the database is never downloaded (Sync now says only Dropbox links can be synced)', refusedSync && !asked.length, `${await lastToast(p)} · requests to that site: ${asked.length}`);
  await p.close();


  // ===== 29. A tour needs the basics before it goes in the queue or starts (production Desk v1.34, D45): first name, a size, the
  // most they'd pay (or the price's Flexible box) and a move-in date (or Flexible). One message, red outlines and notes, the cursor on
  // the first; whole-dollar price boxes; "budget flexible". The list is apps/shared/tour-required.js, the same one the iPad uses. =====
  tag = 'required';
  p = await open({ seedLocal: true });
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  const tourCount = () => p.evaluate(() => Object.keys(window.__STORE.tours).length);
  const marks = () => p.evaluate(() => ({
    outlined: [...document.querySelectorAll('#planModal .is-missing')].map(e => e.id).join(','),
    notes: [...document.querySelectorAll('#planModal .field-err')].map(n => n.textContent).join(' | '),
    focus: document.activeElement ? (document.activeElement.id || (document.activeElement.closest('[id]') || {}).id || '') : '' }));
  const countBefore = await tourCount();
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(200);
  const stars = await p.evaluate(() => ['planFirst', 'planBeds', 'planMax', 'planMoveIn'].map(id => !!document.getElementById(id).closest('.field-row > div, .field').querySelector('label .req-star')));
  await p.click('#planSubmit'); await p.waitForTimeout(250);
  let reqToast = await lastToast(p), mk = await marks();
  check('Send to queue on an empty form: one message names everything missing, each field (marked with a red *) gets a red outline and a note, the cursor goes to the first, nothing is saved',
    reqToast === "Still needed: first name, size, the most they'd pay (or Flexible) and move-in date (or Flexible)." && mk.outlined === 'planFirst,planBeds,planMax,planMoveIn'
      && /Pick at least one size/.test(mk.notes) && /or tick Flexible/.test(mk.notes) && mk.focus === 'planFirst' && (await tourCount()) === countBefore && stars.every(Boolean),
    `${reqToast} · ${JSON.stringify(mk)} · stars ${stars}`);
  await p.fill('#planFirst', 'Testy'); await p.check('#planBeds input[value="1 Bed"]'); await p.waitForTimeout(150);
  mk = await marks();
  check('Filling the first name and ticking a size clears those two marks at once; the other two stay', mk.outlined === 'planMax,planMoveIn' && !/first name|size/.test(mk.notes), JSON.stringify(mk));
  await p.fill('#planMax', '4500.75'); await p.fill('#planMin', 'abc3,2 00'); await p.waitForTimeout(100);
  const maxShown = await p.inputValue('#planMax'), minShown = await p.inputValue('#planMin');
  mk = await marks();
  check('Price boxes take whole dollars as you type ("4500.75" → "$4,500", letters dropped), and a top price clears its mark', maxShown === '$4,500' && minShown === '$3,200' && mk.outlined === 'planMoveIn', `${maxShown} · ${minShown} · ${JSON.stringify(mk)}`);
  await p.selectOption('#planAssistant', 'Nadia');
  await p.click('#planStartNow'); await p.waitForTimeout(250);
  const startToast = await lastToast(p);
  await p.click('#planSubmitPick'); await p.waitForTimeout(250);
  const pickToast = await lastToast(p);
  check('Start tour now and Send & pick units ask for the same, and still save nothing', startToast === 'Still needed: move-in date (or Flexible).' && pickToast === startToast && (await tourCount()) === countBefore, `${startToast} · ${pickToast}`);
  await p.check('#planFlex'); await p.waitForTimeout(100);
  mk = await marks();
  await p.click('#planSubmit'); await p.waitForTimeout(500);
  const tq = await tour(p);
  check('Move-in Flexible is enough: no marks left, and Send to queue saves the tour with the whole-dollar prices',
    mk.outlined === '' && !mk.notes && tq && tq.queuedAtIso && tq.profile && tq.profile.priceMax === 4500 && tq.profile.priceMin === 3200 && tq.profile.flexible === true && tq.profile.priceFlexible === false && tq.profile.beds.join() === '1 Bed',
    `${JSON.stringify(mk)} · ${tq && JSON.stringify(tq.profile)}`);
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(200);
  await p.fill('#planFirst', 'Flexo'); await p.check('#planBeds input[value="2 Bed"]'); await p.check('#planPriceFlex'); await p.fill('#planMoveIn', '2026-12-01');
  await p.click('#planSubmit'); await p.waitForTimeout(500);
  const flexo = await p.evaluate(() => Object.values(window.__STORE.tours).find(t => /^Flexo/.test(t.prospect || '')) || null);
  await tab(p, 'Current Queue');
  const flexoRow = (await row(p, 'Flexo').textContent().catch(() => '')).replace(/\s+/g, ' ');
  check('No top price but the price Flexible box ticked: accepted, saved as priceFlexible, and the queue row says "budget flexible"',
    flexo && flexo.profile.priceFlexible === true && !flexo.profile.priceMax && /2 Bed · budget flexible · move-in Dec 1/.test(flexoRow), flexo ? `${JSON.stringify(flexo.profile)} · ${flexoRow.slice(0, 160)}` : 'not saved');
  const reopened = await p.evaluate(id => { queueOpen(id); openPlanTour(); return { min: document.getElementById('planMin').value, max: document.getElementById('planMax').value, flex: document.getElementById('planPriceFlex').checked, marks: document.querySelectorAll('#planModal .is-missing, #planModal .field-err').length }; }, tq.id);
  await p.evaluate(() => document.getElementById('planModal').classList.remove('show'));
  await p.click('#planStrip button:has-text("✕")').catch(() => {}); await p.waitForTimeout(200);
  check('Reopening a saved tour shows its prices as currency, with no leftover marks', reopened.min === '$3,200' && reopened.max === '$4,500' && !reopened.flex && reopened.marks === 0, JSON.stringify(reopened));
  // A seeded tour opened from Follow-Ups (Grace H.) and saved again goes through: the demo's tours have what a tour needs
  await tab(p, 'Follow-Ups to Send');
  await row(p, 'Grace H.').locator('button:has-text("Open")').click(); await p.waitForTimeout(500);
  await p.evaluate(() => openPlanTour()); await p.waitForTimeout(150);
  await p.click('#planSubmit'); await p.waitForTimeout(500);
  const graceToast = await lastToast(p);
  await p.click('#planStrip button:has-text("✕")').catch(() => {}); await p.waitForTimeout(200);
  check('A seeded tour reopened and saved again goes through (Save changes asks for the same, and the seed has it all)', /^Updated tour for Grace H\./.test(graceToast), graceToast);
  await p.click('#queuePanel button:has-text("+ Plan tour")'); await p.waitForTimeout(200);
  await p.click('#planKindInsp'); await p.fill('#planFirst', 'Inspy'); await p.fill('#planInspUnit', '1201');
  await p.click('#planSubmit'); await p.waitForTimeout(500);
  const inspy = await p.evaluate(() => Object.values(window.__STORE.tours).find(t => /^Inspy/.test(t.prospect || '')) || null);
  check('A resident inspection needs none of this (name and unit only)', inspy && inspy.kind === 'inspection' && !/Still needed/.test(await lastToast(p)), inspy ? inspy.kind : await lastToast(p));
  await p.close();

  // ===== 30. Future Move-Ins leads stay done (production Desk v1.34, D46), through the real buttons; the net rent under the rent in
  // the unit list, as the iPad shows it; Halloween Oct 24–31, 2026 only (D47). =====
  tag = 'leads';
  p = await open({ seedLocal: true });
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  await p.evaluate(() => firebase.firestore().collection('tours').doc('t-silas').set({ id: 't-silas', kind: 'tour', prospect: 'Silas P.', prospectFirst: 'Silas', prospectInitial: 'P', assistant: 'Jun', stops: [], profile: { beds: ['1 Bed'], priceMax: 5000, moveIn: '2026-12-23' }, createdAtIso: '2026-10-06T13:00:00.000Z', queuedAtIso: '2026-10-06T13:00:00.000Z', startedAtIso: '2026-10-06T13:05:00.000Z', updatedAtIso: '2026-10-06T13:05:00.000Z' }));
  await p.waitForTimeout(700);
  const silas = () => p.evaluate(() => (window.__STORE.future_leads['tour-t-silas'] || {}).status || '(none)');
  const silasCaptured = await silas();
  await tab(p, 'Future Move-Ins');
  await row(p, 'Silas P.').locator('button:has-text("✓ Contacted")').click(); await p.waitForTimeout(700);
  const afterContacted = await silas();
  await p.evaluate(async () => {   // another Desk loading, its tours first: the capture runs while its list has no leads yet
    const fl = await import(new URL('js/future-leads.js', location.href).href), keep = fl.futureLeads.slice();
    fl.futureLeads.length = 0; await fl.flCaptureFromTours(); fl.futureLeads.push(...keep);
  });
  await p.waitForTimeout(500);
  const afterRace = await silas();
  check('✓ Contacted sticks: a Desk whose tours load before its leads no longer puts the lead back to open', silasCaptured === 'open' && afterContacted === 'contacted' && afterRace === 'contacted', `${silasCaptured} → ${afterContacted} → ${afterRace}`);
  await p.evaluate(() => flSetStatus('tour-t-silas', 'open')); await p.waitForTimeout(500);
  await tab(p, 'Future Move-Ins');
  await row(p, 'Silas P.').locator('button:has-text("Delete")').click(); await p.waitForTimeout(600);
  const afterDelete = await silas();
  await p.evaluate(() => firebase.firestore().collection('tours').doc('t-silas').set({ updatedAtIso: '2026-10-06T14:00:00.000Z' }, { merge: true })); await p.waitForTimeout(700);
  const afterTourUpdate = await silas();
  await tab(p, 'Future Move-Ins');
  const silasListed = (await p.textContent('#queueBody')).includes('Silas P.');
  check('Delete sticks: the lead is marked deleted, hidden from every list, and not added back when its tour changes', afterDelete === 'deleted' && afterTourUpdate === 'deleted' && !silasListed, `${afterDelete} → ${afterTourUpdate} · listed ${silasListed}`);

  tag = 'net-rent';
  const nets = await p.evaluate(() => { const r = k => document.querySelector(`.unit-row[data-key="2050 TIDEMARK BLVD::${k}"] .unit-rent`); return { u1104: r('1104') && r('1104').textContent.trim(), u506: r('506') && r('506').textContent.trim(), align: getComputedStyle(r('506')).textAlign }; });
  check('Unit list: the net rent shows under the rent when the showsheet has one (#1104), not otherwise (#506); the rent column is right-aligned',
    /^\$3,350\s*Net \$3,071$/.test(nets.u1104 || '') && nets.u506 === '$3,295' && nets.align === 'right', JSON.stringify(nets));
  // Every row against the iPad's rule for its own lists, written out again here: the showsheet's NET EFF when it is a number other
  // than the rent, in whole dollars (the iPad flows check the iPad's lists against the same rule)
  const netRows = await p.evaluate(async () => {
    const { state } = await import(new URL('js/state.js', location.href).href), { unitSelectKey } = await import(new URL('js/units.js', location.href).href);
    const ipadRule = u => Number(u.netEff) && Number(u.netEff) !== Number(u.monthly) ? 'Net $' + Math.round(Number(u.netEff)).toLocaleString('en-US') : '';
    const out = { rows: 0, nets: 0, wrong: [] };
    state.units.forEach(u => { const el = document.querySelector(`.unit-row[data-key="${CSS.escape(unitSelectKey(u))}"]`); if (!el) return; out.rows++;
      const shown = ((el.querySelector('.unit-net') || {}).textContent || '').trim(); if (shown) out.nets++; if (shown !== ipadRule(u)) out.wrong.push(`#${u.unit}: "${shown}" vs "${ipadRule(u)}"`); });
    return out;
  });
  check('…every unit row shows exactly the net the iPad\'s list shows for that unit (and none where the iPad shows none)', netRows.rows >= 15 && netRows.nets >= 10 && !netRows.wrong.length, `${netRows.rows} rows · ${netRows.nets} with a net · ${netRows.wrong.slice(0, 4).join(' | ')}`);
  await p.close();

  tag = 'halloween';
  const hwCheck = () => p.evaluate(() => ({ on: document.body.classList.contains('halloween'), pumpkin: getComputedStyle(document.querySelector('h1'), '::after').content }));
  const SEASONAL = /[🎃🍬🍭🦇]/u;
  await ctx.clock.setFixedTime(new Date('2026-10-30T14:10:00-04:00'));
  p = await open({ seedLocal: true });
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  const hw = await hwCheck();
  await row(p, 'Priya').locator('button:has-text("Finish")').click(); await p.waitForTimeout(400);
  const finishToast = await lastToast(p);
  await tab(p, 'Follow-Ups to Send');
  await row(p, 'Aisha B.').locator('button:has-text("Mark sent")').click(); await p.waitForTimeout(700);
  const sentToast = await lastToast(p);
  await tab(p, 'Leasing Manager Check-In');
  await row(p, 'Omar F.').locator('select.checkin-agent').selectOption('Morgan');
  await row(p, 'Omar F.').locator('button:has-text("Mark sent")').click(); await p.waitForTimeout(700);
  const checkinToast = await lastToast(p);
  check('Oct 30: a 🎃 after "Leasing Desk", and a 🍬 or 🍭 at the end of the Finish, Mark sent and check-in sent messages',
    hw.on && /🎃/u.test(hw.pumpkin) && /^Finished Priya S\. — now in Follow-Ups to Send [🍬🍭]$/u.test(finishToast) && /^Marked Aisha B\. as sent — now in Leasing Manager Check-In [🍬🍭]$/u.test(sentToast)
      && /^Check-in marked sent for Omar F\. — it's in History [🍬🍭]$/u.test(checkinToast), `${JSON.stringify(hw)} · ${finishToast} · ${sentToast} · ${checkinToast}`);
  const bat = await p.evaluate(async () => {
    const { batFlyby } = await import(new URL('js/seasons.js', location.href).href);
    document.querySelectorAll('.hw-bat').forEach(b => b.remove()); localStorage.removeItem('ld_batDay');   // the page's own flyby may have run already
    batFlyby(); batFlyby();
    const b = document.querySelector('.hw-bat'), an = b && b.getAnimations()[0], cs = b && getComputedStyle(b);
    const out = { bats: document.querySelectorAll('.hw-bat').length, day: localStorage.getItem('ld_batDay'), name: cs && cs.animationName, ms: an && an.effect.getTiming().duration, clicks: cs && cs.pointerEvents, hidden: b && b.getAttribute('aria-hidden') };
    if (an) { an.finish(); await new Promise(r => setTimeout(r, 50)); }
    out.afterEnd = document.querySelectorAll('.hw-bat').length;
    return out;
  });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await p.evaluate(async () => { const { batFlyby } = await import(new URL('js/seasons.js', location.href).href); localStorage.removeItem('ld_batDay'); batFlyby(); return document.querySelectorAll('.hw-bat').length; });
  await p.emulateMedia({ reducedMotion: 'no-preference', media: 'print' });
  const inPrint = await p.evaluate(() => { const b = document.createElement('div'); b.className = 'hw-bat'; document.body.appendChild(b); const out = { pumpkin: getComputedStyle(document.querySelector('h1'), '::after').content, bat: getComputedStyle(b).display }; b.remove(); return out; });
  await p.emulateMedia({ media: 'screen' });
  check('…the bat: once a day (ld_batDay), 7 seconds, can\'t be clicked, gone when it lands; none with reduced motion; neither it nor the 🎃 in print',
    bat.bats === 1 && /^Fri Oct 30 2026$/.test(bat.day || '') && bat.name === 'hw-bat' && bat.ms === 7000 && bat.clicks === 'none' && bat.hidden === 'true' && bat.afterEnd === 0
      && reduced === 0 && inPrint.pumpkin === 'none' && inPrint.bat === 'none', `${JSON.stringify(bat)} · reduced-motion bats ${reduced} · print ${JSON.stringify(inPrint)}`);
  // Nothing seasonal in an email or in the database: Grace's follow-up email built on Oct 30, and every write this page made
  await tab(p, 'Follow-Ups to Send');
  await row(p, 'Grace H.').locator('button:has-text("Open")').click(); await p.waitForTimeout(600);
  const hwMail = await p.evaluate(async () => (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML());
  const hwWrites = await p.evaluate(() => JSON.stringify(window.__W));
  check('…and none of it in an email or the database (a follow-up email built on Oct 30; every write the page made)', /Grace/.test(hwMail) && !SEASONAL.test(hwMail) && /finishedAtIso/.test(hwWrites) && !SEASONAL.test(hwWrites),
    `${(hwMail.match(SEASONAL) || ['email clean'])[0]} · ${(hwWrites.match(SEASONAL) || ['writes clean'])[0]}`);
  await p.close();
  // A Desk left open past midnight: the 10-minute re-check (the page's own setInterval, captured here) switches it off
  await ctx.clock.setFixedTime(new Date('2026-10-31T23:59:00-04:00'));
  p = await open({ seedLocal: true }, () => { const si = window.setInterval.bind(window); window.__every10min = []; window.setInterval = (fn, ms, ...a) => { if (ms === 600000) window.__every10min.push(fn); return si(fn, ms, ...a); }; });
  const beforeMidnight = (await hwCheck()).on;
  await ctx.clock.setFixedTime(new Date('2026-11-01T00:00:30-04:00'));
  const afterMidnight = await p.evaluate(() => { window.__every10min.forEach(f => f()); return { on: document.body.classList.contains('halloween'), pumpkin: getComputedStyle(document.querySelector('h1'), '::after').content, rechecks: window.__every10min.length }; });
  await p.close();
  check('At midnight on Oct 31 an open Desk switches it off at its next 10-minute re-check', beforeMidnight && !afterMidnight.on && !/🎃/u.test(afterMidnight.pumpkin) && afterMidnight.rechecks === 1,
    `11:59 PM on: ${beforeMidnight} · 12:00 AM: ${JSON.stringify(afterMidnight)}`);
  await ctx.clock.setFixedTime(new Date('2026-11-01T14:10:00-05:00'));   // the same time of day as the seeded tours (EST: the clocks went back at 2 AM)
  p = await open({ seedLocal: true });
  await p.evaluate(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } });
  const off = await p.evaluate(async () => { (await import(new URL('js/seasons.js', location.href).href)).batFlyby(); return { on: document.body.classList.contains('halloween'), pumpkin: getComputedStyle(document.querySelector('h1'), '::after').content, bats: document.querySelectorAll('.hw-bat').length }; });
  await row(p, 'Priya').locator('button:has-text("Finish")').click(); await p.waitForTimeout(400);
  const plainToast = await lastToast(p);
  check('Nov 1: no pumpkin and no bat; the treat is now the Thanksgiving one (production D50)', !off.on && !/🎃/u.test(off.pumpkin) && off.bats === 0 && plainToast === 'Finished Priya S. — now in Follow-Ups to Send 🦃', `${JSON.stringify(off)} · ${plainToast}`);
  await p.close();
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));

  // ===== 31. Orange on the showsheet = "Backup apps welcome" (production Desk v1.35, D49). tests/fixture_fills.cjs builds a showsheet
  // with real fills: 2120 #1101 red (App pending), #1102 none, #1103 orange with a yellow NOTES cell, #1104 orange from the theme.
  // Read through Dropbox sync and the manual upload: the same result. Still on the market: a light orange row, never hasApp. =====
  tag = 'backup-apps';
  const fillsOf = q => q.evaluate(async () => (await import(new URL('js/state.js', location.href).href)).state.units
    .filter(u => /^2120/.test(u.building)).map(u => `${u.unit}:${u.hasApp ? 'app' : ''}${u.backupApps ? 'backup' : ''}`).join(' '));
  const rowLook = (q, n) => q.evaluate(k => { const r = document.querySelector(`.unit-row[data-key="2120 TIDEMARK BLVD::${k}"]`); if (!r) return 'not listed';
    return `${r.classList.contains('has-app') ? 'pink' : r.classList.contains('has-backup') ? 'orange' : 'plain'} ${getComputedStyle(r).backgroundColor}|${[...r.querySelectorAll('.flag.pending, .flag.backup')].map(f => f.textContent.trim()).join(',')}`; }, n);
  p = await open({ seedLocal: true, dbx: true });
  await p.evaluate(() => firebase.firestore().collection('settings').doc('dropboxSync').set({ showsheetUrl: 'https://www.dropbox.com/scl/fi/ff1/Fills.xlsx?rlkey=f1&dl=0', ssHash: '' }, { merge: true }));
  await p.waitForTimeout(300); await p.click('#dbxSyncBtn');
  const viaDbx = await waitToast(p, /Synced from Dropbox — 4 units/) ? await fillsOf(p) : 'not synced: ' + await lastToast(p);
  await p.close();
  p = await open({ seedLocal: true });
  await p.setInputFiles('#ssCard .file-input', OUT + '/fixture_fills.xlsx'); await p.waitForTimeout(600);
  const viaUpload = await fillsOf(p);
  check('Dropbox sync and the manual upload read the same fills: red = App pending, orange (standard or theme) = Backup apps welcome, a yellow NOTES cell on an orange row changes nothing',
    viaDbx === '1101:app 1102: 1103:backup 1104:backup' && viaUpload === viaDbx, `Dropbox: ${viaDbx} · upload: ${viaUpload}`);
  const looks = { 1101: await rowLook(p, '1101'), 1102: await rowLook(p, '1102'), 1103: await rowLook(p, '1103'), 1104: await rowLook(p, '1104') };
  check('Unit list: the orange units on a light orange row with an amber "Backup apps welcome"; App pending\'s pink row as before; nothing on the plain unit',
    looks[1103] === 'orange rgb(255, 243, 224)|Backup apps welcome' && looks[1104] === looks[1103] && looks[1101] === 'pink rgb(255, 246, 246)|App pending' && /^plain .*\|$/.test(looks[1102]), JSON.stringify(looks));
  const flagInk = await p.evaluate(() => { const f = document.querySelector('.unit-row.has-backup .flag.backup'), cs = f && getComputedStyle(f); return cs ? `${cs.color} on ${cs.backgroundColor}` : 'no flag'; });
  check('…the flag is amber (#8a5d0e on #fff3d6, 5.2:1)', flagInk === 'rgb(138, 93, 14) on rgb(255, 243, 214)', flagInk);
  await p.click('.unit-row[data-key="2120 TIDEMARK BLVD::1103"] .unit-info'); await p.click('.unit-row[data-key="2120 TIDEMARK BLVD::1102"] .unit-info'); await p.waitForTimeout(500);
  const LINE = "An application is in progress on this apartment; we're happy to take a backup application.";
  const mails = await p.evaluate(async () => { const eb = await import(new URL('js/email-builder.js', location.href).href); const tourMail = eb.buildEmailHTML(); setMode('inquiry'); const inq = eb.buildEmailHTML(); setMode('tour'); return { tourMail, inq }; });
  const lineAt = h => { const i = h.indexOf(LINE); return { n: h.split(LINE).length - 1, after1103: i > h.indexOf('#1103') && i < (h.indexOf('#1102') < 0 ? Infinity : h.indexOf('#1102')), underAvail: /Available Immediately<\/strong><\/p><p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><em>An application is in progress/.test(h) }; };
  const lt = lineAt(mails.tourMail), li = lineAt(mails.inq);
  check('Tour and Inquiry Follow-Up emails: the one neutral line, once, under "Available …" of the orange apartment only (in the email\'s <p> style), never "weak"',
    lt.n === 1 && lt.after1103 && lt.underAvail && li.n === 1 && li.after1103 && !/weak/i.test(mails.tourMail + mails.inq), `tour ${JSON.stringify(lt)} · inquiry ${JSON.stringify(li)}`);
  // The line follows today's showsheet: the orange comes off → the line goes; a hand-typed apartment never gets it
  const offMail = await p.evaluate(async () => { const { state } = await import(new URL('js/state.js', location.href).href); const u = state.units.find(x => x.unit === '1103' && /^2120/.test(x.building)); delete u.backupApps;
    const h = (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML(); u.backupApps = true; return h; });
  await p.click('.panel-header button:has-text("Reset")'); await p.waitForTimeout(200);
  await p.click('button:has-text("+ Add Custom Unit")'); await p.waitForTimeout(400);
  const ce = p.locator('.inline-editor').last();
  await ce.locator('select').nth(0).selectOption('2120 TIDEMARK BLVD'); await ce.locator('input[type=text]').nth(0).fill('1103'); await p.waitForTimeout(200);
  const customMail = await p.evaluate(async () => (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML());
  check('…gone when the orange comes off today\'s showsheet; never on an apartment typed in by hand', !offMail.includes(LINE) && /#1103/.test(customMail) && !customMail.includes(LINE), `off: ${offMail.includes(LINE)} · typed by hand: ${customMail.includes(LINE)}`);
  await p.close();
  // The demo's own orange unit (2040 #1207, seeded): on the list, and still on the market
  p = await open({ seedLocal: true });
  const seededOrange = await p.evaluate(() => { const r = document.querySelector('.unit-row[data-key="2040 TIDEMARK BLVD::1207"]'); return r ? `${r.classList.contains('has-backup')} ${getComputedStyle(r).backgroundColor} ${(r.querySelector('.flag.backup') || {}).textContent || ''}` : 'not listed'; });
  check('The demo seeds one orange unit (2040 #1207): light orange row, "Backup apps welcome"', seededOrange === 'true rgb(255, 243, 224) Backup apps welcome', seededOrange);
  await p.close();
  // ===== 32. Seasons (production Desk v1.36, D50), Desk only: a turkey after the title from Nov 1 until the Monday after Thanksgiving,
  // then snow over the title area until Mar 31 (the ❄ pauses it, remembered in ld_snowOff), then nothing until Halloween. The clock
  // is pinned for every check; the seeded tours are at the same time of day (EST after Nov 1, EDT from Mar 14). =====
  tag = 'seasons';
  {   // a block: these names are used by earlier sections too
    const seasonPage = async (when, reduced, beforeLoad) => { await ctx.clock.setFixedTime(new Date(when)); const q = await open({ seedLocal: true }, beforeLoad);
      if (reduced) await q.emulateMedia({ reducedMotion: 'reduce' });
      await q.evaluate(() => { const qp = document.getElementById('queuePanel'); if (!qp.classList.contains('open')) { qp.classList.add('open'); renderTourQueue(); } }); return q; };
    const look = q => q.evaluate(() => { const b = document.querySelector('.snow-toggle');
      return { cls: ['halloween', 'thanksgiving', 'snow'].filter(k => document.body.classList.contains(k)).join(','), turkey: !!document.querySelector('header h1 .season-art svg'),
        walk: (document.querySelector('.turkey-walk') && getComputedStyle(document.querySelector('.turkey-walk')).animationName) || '', toggle: b ? b.title : '', pressed: b ? b.getAttribute('aria-pressed') : '',
        flakes: document.querySelectorAll('header .season-snow i').length }; });
    const seasonFinish = async q => { await row(q, 'Priya').locator('button:has-text("Finish")').click(); await q.waitForTimeout(400); return lastToast(q); };
    const seasonSent = async q => { await tab(q, 'Follow-Ups to Send'); await row(q, 'Aisha B.').locator('button:has-text("Mark sent")').click(); await q.waitForTimeout(700); return lastToast(q); };
    const tgDays = await (async () => { const q = await seasonPage('2026-10-06T14:10:00-04:00');
      const out = await q.evaluate(async () => { const S = await import(new URL('../shared/seasons.js', location.href).href);
        const f = d => `${d.getMonth() + 1}/${d.getDate()}`;
        return { tg: [2026, 2027, 2028, 2030].map(y => f(S.thanksgivingDay(y))).join(' '),
          edges: ['2026-10-31T23:59:59', '2026-11-01T00:00:00', '2026-11-29T23:59:59', '2026-11-30T00:00:00', '2027-03-31T23:59:59', '2027-04-01T00:00:00', '2027-10-23T23:59:59', '2027-11-01T00:00:00'].map(t => S.seasonNow(new Date(t)) || '-').join(' ') }; });
      await q.close(); return out; })();
    check('The dates: Thanksgiving is the 4th Thursday (11/26 in 2026, 11/25 in 2027, 11/23 in 2028, 11/28 in 2030); the turkey from Nov 1, snow from the Monday after, nothing from Apr 1',
      tgDays.tg === '11/26 11/25 11/23 11/28' && tgDays.edges === 'halloween thanksgiving thanksgiving snow snow - - thanksgiving', `${tgDays.tg} · ${tgDays.edges}`);
    p = await seasonPage('2026-11-26T14:10:00-05:00');
    let lk = await look(p); const tgToast = await seasonFinish(p), tgSent = await seasonSent(p);
    const tgPrint = await (async () => { await p.emulateMedia({ media: 'print' }); const v = await p.evaluate(() => getComputedStyle(document.querySelector('.season-art')).display); await p.emulateMedia({ media: 'screen' }); return v; })();
    check('Thanksgiving Day: the turkey after "Leasing Desk" (stepping), no snow or ❄ button, a 🦃 at the end of Finish and Mark sent; not in print',
      lk.cls === 'thanksgiving' && lk.turkey && lk.walk === 'turkey-walk' && !lk.toggle && lk.flakes === 0 && /^Finished Priya S\. — now in Follow-Ups to Send 🦃$/u.test(tgToast)
        && /^Marked Aisha B\. as sent — now in Leasing Manager Check-In 🦃$/u.test(tgSent) && tgPrint === 'none', `${JSON.stringify(lk)} · ${tgToast} · ${tgSent} · print ${tgPrint}`);
    await p.close();
    p = await seasonPage('2026-11-26T14:10:00-05:00', true); lk = await look(p); await p.close();
    check('…with reduced motion the turkey stands still', lk.turkey && lk.walk === 'none', JSON.stringify(lk));
    p = await seasonPage('2026-11-30T14:10:00-05:00');
    await p.waitForTimeout(2000); lk = await look(p);
    const snowToast = await seasonFinish(p);
    const flakeMax = await p.evaluate(async () => { const box = document.querySelector('header .season-snow'); await new Promise(r => setTimeout(r, 8000)); return { now: box ? box.childElementCount : 0, hidden: box ? box.getAttribute('aria-hidden') : '' }; });
    await p.click('.snow-toggle'); await p.waitForTimeout(1500);
    const paused = await look(p), stored = await p.evaluate(() => localStorage.getItem('ld_snowOff'));
    await p.click('.snow-toggle'); await p.waitForTimeout(1500);
    const resumed = await look(p), stored2 = await p.evaluate(() => localStorage.getItem('ld_snowOff'));
    check('From the Monday after Thanksgiving: no turkey; snow keeps falling over the title (at most 16 flakes, hidden from screen readers); a ❄️ at the end of Finish',
      lk.cls === 'snow' && !lk.turkey && lk.flakes > 0 && flakeMax.now > 0 && flakeMax.now <= 16 && flakeMax.hidden === 'true' && /^Finished Priya S\. — now in Follow-Ups to Send ❄️$/u.test(snowToast),
      `${JSON.stringify(lk)} · after 8 s ${JSON.stringify(flakeMax)} · ${snowToast}`);
    check('…the ❄ pauses it (the flakes go, "Let it snow", aria-pressed false, ld_snowOff = 1) and clicking it again lets it snow',
      lk.toggle === 'Pause the snow' && lk.pressed === 'true' && paused.flakes === 0 && paused.toggle === 'Let it snow' && paused.pressed === 'false' && stored === '1' && resumed.flakes > 0 && resumed.toggle === 'Pause the snow' && stored2 === '0',
      `before ${lk.toggle}/${lk.pressed} · paused ${JSON.stringify(paused)} (${stored}) · resumed ${resumed.flakes} (${stored2})`);
    await p.close();
    p = await seasonPage('2026-12-15T14:10:00-05:00', false, () => { localStorage.setItem('ld_snowOff', '1'); });   // paused earlier on this computer
    await p.waitForTimeout(1500); lk = await look(p);
    const snowPrint = await (async () => { await p.emulateMedia({ media: 'print' }); const v = await p.evaluate(() => getComputedStyle(document.querySelector('.snow-toggle')).display); await p.emulateMedia({ media: 'screen' }); return v; })();
    await tab(p, 'Follow-Ups to Send');
    await row(p, 'Grace H.').locator('button:has-text("Open")').click(); await p.waitForTimeout(600);
    const snowMail = await p.evaluate(async () => (await import(new URL('js/email-builder.js', location.href).href)).buildEmailHTML());
    await seasonSent(p);
    const snowWrites = await p.evaluate(() => JSON.stringify(window.__W));
    check('A computer that paused the snow stays paused when the Desk opens again; the ❄ isn\'t printed; no 🦃 / ❄ in an email or the database',
      lk.cls === 'snow' && lk.flakes === 0 && lk.toggle === 'Let it snow' && snowPrint === 'none' && /Grace/.test(snowMail) && !/[🦃❄]/u.test(snowMail) && /followUpSentAtIso/.test(snowWrites) && !/[🦃❄]/u.test(snowWrites),
      `${JSON.stringify(lk)} · print ${snowPrint} · email ${/[🦃❄]/u.test(snowMail) ? 'has one' : 'clean'} · writes ${/[🦃❄]/u.test(snowWrites) ? 'have one' : 'clean'}`);
    await p.close();
    p = await seasonPage('2026-12-15T14:10:00-05:00', true);
    await p.evaluate(() => document.querySelectorAll('header .season-snow i').forEach(f => f.remove()));   // any flake from before reduced motion was switched on
    await p.waitForTimeout(2000); lk = await look(p);
    const btnShown = await p.evaluate(() => { const b = document.querySelector('.snow-toggle'); return !!b && getComputedStyle(b).display !== 'none'; }); await p.close();
    check('With reduced motion no snow falls and the pause button is hidden', lk.cls === 'snow' && lk.flakes === 0 && !btnShown, `${JSON.stringify(lk)} · button shown ${btnShown}`);
    p = await seasonPage('2027-01-12T14:10:00-05:00');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => document.querySelectorAll('header .season-snow i').forEach(f => f.remove()));
    await p.waitForTimeout(2000); lk = await look(p);
    const phoneBtn = await p.evaluate(() => { const b = document.querySelector('.snow-toggle'); return !!b && getComputedStyle(b).display !== 'none'; }); await p.close();
    check('On a phone no snow falls and there is no ❄ button (January)', lk.cls === 'snow' && lk.flakes === 0 && !phoneBtn, `${JSON.stringify(lk)} · button shown ${phoneBtn}`);
    // An open Desk changes season at its 10-minute re-check: the turkey goes and the snow starts at midnight on that Monday
    await ctx.clock.setFixedTime(new Date('2026-11-29T23:59:00-05:00'));
    p = await open({ seedLocal: true }, () => { const si = window.setInterval.bind(window); window.__every10min = []; window.setInterval = (fn, ms, ...a) => { if (ms === 600000) window.__every10min.push(fn); return si(fn, ms, ...a); }; });
    const sunday = await look(p);
    await ctx.clock.setFixedTime(new Date('2026-11-30T00:00:30-05:00'));
    await p.evaluate(() => window.__every10min.forEach(f => f())); await p.waitForTimeout(1500);
    const monday = await look(p); await p.close();
    check('An open Desk swaps the turkey for the snow at its first re-check after midnight on the Monday after Thanksgiving',
      sunday.cls === 'thanksgiving' && sunday.turkey && !sunday.toggle && monday.cls === 'snow' && !monday.turkey && monday.toggle === 'Pause the snow' && monday.flakes > 0, `Sunday ${JSON.stringify(sunday)} · Monday ${JSON.stringify(monday)}`);
    p = await seasonPage('2027-04-01T14:10:00-04:00'); await p.waitForTimeout(1000); lk = await look(p); const aprToast = await seasonFinish(p); await p.close();
    check('April 1: no turkey, no snow, no ❄ button, no treat', !lk.cls && !lk.turkey && !lk.toggle && lk.flakes === 0 && aprToast === 'Finished Priya S. — now in Follow-Ups to Send', `${JSON.stringify(lk)} · ${aprToast}`);
    await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));
  }

  // ===== 33. Typing in the Tour Queue panel survives its redraws (production Desk v1.36–v1.37, D51): any tour change redrew the
  // panel and emptied the "+ Add future lead" form. Boxes that save as they change (a waiting tour's assistant) still show other
  // Desks' changes; the Check-In "sent by" box follows the last name used unless the row's own name was changed. =====
  tag = 'keep-typing';
  {
    p = await open({ seedLocal: true });
    const bump = (id, extra) => p.evaluate(([i, x]) => firebase.firestore().collection('tours').doc(i).set(Object.assign({ updatedAtIso: new Date().toISOString() }, x || {}), { merge: true }), [id, extra]);
    await p.evaluate(() => setQueueTab('future')); await p.waitForTimeout(200);
    await p.click('#queueBody button:has-text("+ Add future lead")'); await p.waitForTimeout(200);
    await p.fill('#flFirst', 'Wren'); await p.fill('#flMoveIn', '2027-02-01'); await p.selectOption('#flBeds', '2 Bed'); await p.fill('#flNotes', 'wants a balcony');
    await p.evaluate(() => { const n = document.getElementById('flNotes'); n.setSelectionRange(5, 5); });   // the cursor after "wants"
    await bump('t-daniel'); await p.waitForTimeout(500);   // an iPad saving another tour
    const kept = await p.evaluate(() => { const n = document.getElementById('flNotes'); return [document.getElementById('flFirst').value, document.getElementById('flMoveIn').value, document.getElementById('flBeds').value, n.value, document.activeElement.id, n.selectionStart].join('|'); });
    await p.keyboard.type(' really');   // typed where the cursor was kept
    await p.click('.fl-form button:has-text("Add lead")'); await p.waitForTimeout(600);
    const added = await p.evaluate(() => Object.values(window.__STORE.future_leads).find(l => l.name === 'Wren') || null);
    const formGone = await p.evaluate(() => !document.getElementById('flFirst'));
    check('Future Move-Ins: what is typed in "+ Add future lead" stays (the cursor too) when a tour changes, and the lead is added with it',
      kept === 'Wren|2027-02-01|2 Bed|wants a balcony|flNotes|5' && added && added.criteria === '2 Bed · wants really a balcony' && formGone, `${kept} · ${added ? added.criteria : 'not added: ' + await lastToast(p)} · form closed ${formGone}`);
    let fresh = 'form still open';
    if (formGone) {
      await p.click('#queueBody button:has-text("+ Add future lead")'); await p.waitForTimeout(200);
      fresh = await p.evaluate(() => ['flFirst', 'flMoveIn', 'flNotes'].map(i => document.getElementById(i).value).join('|'));
      await p.click('.fl-form button:has-text("Cancel")'); await p.waitForTimeout(200);
    }
    check('…and the form opens empty again after the lead is added', fresh === '||', JSON.stringify(fresh));
    await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; setQueueTab('rotation'); }); await p.waitForTimeout(300);
    await p.fill('#newAssistantName', 'Quinn'); await bump('t-daniel'); await p.waitForTimeout(500);
    const asstKept = await p.evaluate(() => { const el = document.getElementById('newAssistantName'); return el ? `${el.value}|${document.activeElement === el}` : 'no box'; });
    await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = false; });
    check('"Add a leasing assistant": what is typed stays, with the focus, when a tour changes', asstKept === 'Quinn|true', asstKept);
    await p.evaluate(() => setQueueTab('checkin')); await p.waitForTimeout(200);
    const ciVal = id => p.evaluate(i => { const s = document.querySelector(`.checkin-agent[data-id="${CSS.escape(i)}"]`); return s ? s.value : null; }, id);
    const pick = await p.evaluate(() => { const sel = document.querySelector('.checkin-agent'); if (!sel) return null; return { id: sel.dataset.id, first: sel.value, other: [...sel.options].map(o => o.value).find(v => v !== sel.value) }; });
    if (pick) { await p.selectOption(`.checkin-agent[data-id="${pick.id}"]`, pick.other); await p.focus(`.checkin-agent[data-id="${pick.id}"]`); }
    await bump('t-daniel'); await p.waitForTimeout(500);
    const pickKept = pick && await ciVal(pick.id);
    const pickFocus = pick && await p.evaluate(i => document.activeElement && document.activeElement.matches(`.checkin-agent[data-id="${CSS.escape(i)}"]`), pick.id);
    check('Check-In: the "sent by" name picked on a row stays picked (and focused) when a tour changes', pick && pickKept === pick.other && pickFocus, `${pick ? pick.first + ' → ' + pick.other : 'no row'} → ${pickKept} · focused ${pickFocus}`);
    // v1.37: after a mark, the rows nobody changed show the name just used; a row changed by hand keeps its own
    const others = pick ? await p.evaluate(id => [...document.querySelectorAll('.checkin-agent')].map(s => s.dataset.id).filter(i => i !== id), pick.id) : [];
    const [held, loose] = others;
    if (held && loose) {
      await p.selectOption(`.checkin-agent[data-id="${held}"]`, pick.first);   // picked by hand (the name it already showed)
      await p.click(`.queue-row:has(.checkin-agent[data-id="${pick.id}"]) button:has-text("Mark sent")`); await p.waitForTimeout(800);
  }
  const markedBy = pick && await p.evaluate(i => (window.__STORE.tours[i] || {}).checkInSentBy, pick.id);
  const ciAfter = held && loose ? { loose: await ciVal(loose), held: await ciVal(held), agent: await p.evaluate(() => localStorage.getItem('ld_agent')) } : null;
  check('Check-In: after one is marked sent by a name, the rows nobody changed show that name, and a row changed by hand keeps its own (v1.37)',
    ciAfter && markedBy === pick.other && ciAfter.loose === pick.other && ciAfter.held === pick.first && ciAfter.agent === pick.other,
    ciAfter ? `marked by ${markedBy} · untouched row → ${ciAfter.loose} · row changed by hand → ${ciAfter.held} · ld_agent ${ciAfter.agent}` : 'not enough Check-In rows');
  await p.evaluate(() => setQueueTab('queue')); await p.waitForTimeout(200);
  await bump('t-daniel', { assistant: 'Tariq' }); await p.waitForTimeout(500);   // another Desk assigns Daniel's tour
  const assignShown = await p.evaluate(() => { const s = document.querySelector('.queue-assign[data-id="t-daniel"]'); return s ? s.value : '(no picker)'; });
  check('A waiting tour assigned on another Desk still shows the new assistant (that picker is not held)', assignShown === 'Tariq', assignShown);
  await p.close();
  }

  const failed = steps.filter(s => !s.ok).length;
  return JSON.stringify({ passed: steps.length - failed, failed, steps, errors }, null, 1);
}
