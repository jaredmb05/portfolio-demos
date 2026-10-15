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
    if (/dl\.dropboxusercontent\.com\/.*Showsheet\.xlsx/.test(u)) return route.fulfill({ path: OUT + '/fixture_showsheet.xlsx', contentType: 'application/octet-stream' });
    if (/dl\.dropboxusercontent\.com\/.*Floor_Plan_Master\.xlsx/.test(u)) return route.fulfill({ path: OUT + '/fixture_floorplans.xlsx', contentType: 'application/octet-stream' });
    return route.abort();
  });

  async function open(opts) {
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push(`${tag}: console: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`${tag}: page error: ${e.message}`));
    p.__dialogs = []; p.__dismiss = false;   // set p.__dismiss = true to answer the next dialogs with Cancel
    p.on('dialog', d => { p.__dialogs.push(d.message()); (p.__dismiss ? d.dismiss() : d.accept(d.type() === 'prompt' ? (d.defaultValue() || 'Alex') : undefined)).catch(() => {}); });
    await p.addInitScript(o => { window.__SEED_OPTS = o; try { localStorage.clear(); localStorage.setItem('ld_tourSeen', '1'); } catch (e) {} }, opts);
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
  check('Footer shows Build v1.21 (both copies)', stamps.length >= 2 && stamps.every(s => s === 'Build v1.21'), stamps.join(', '));
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
  const zeeOpt = await daniel.locator('select.queue-assign option[value="Rosa"]').textContent();
  check('Waiting-row dropdown says who is on a tour', /on a tour · back ~/.test(zeeOpt), zeeOpt);
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
  await p.check('#planBeds input[value="1 Bed"]'); await p.fill('#planMin', '3800'); await p.fill('#planMax', '4500');
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
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; await toggleTraining(); });
  await p.waitForTimeout(300);
  await p.locator('#trainingBody .queue-row', { hasText: 'Hostile' }).first().locator('button:has-text("Details")').click(); await p.waitForTimeout(200);
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
  await p.evaluate(async () => { (await import(new URL('js/state.js', location.href).href)).state.trainingUnlocked = true; renderTourQueue(); });
  await p.waitForTimeout(300);
  const totals = await p.evaluate(() => {
    const t = document.querySelector('#queueBody .totals-table'); if (!t) return null;
    const today = new Date().toDateString(), s = Object.values(window.__STORE.tours).filter(r => r.assistant && r.startedAtIso && new Date(r.startedAtIso).toDateString() === today);
    return { team: [...t.querySelectorAll('tr.team td')].map(td => td.textContent.trim()),
      expected: [s.filter(r => r.kind !== 'inspection').length, s.filter(r => r.kind === 'inspection').length, s.length, s.filter(r => !r.finishedAtIso).length, s.filter(r => r.finishedAtIso).length].map(String) };
  });
  check('Unlocked: Today\'s totals per assistant, with a Team row matching today\'s tours and inspections', !!totals && JSON.stringify(totals.team) === JSON.stringify(totals.expected), JSON.stringify(totals));
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

  const failed = steps.filter(s => !s.ok).length;
  return JSON.stringify({ passed: steps.length - failed, failed, steps, errors }, null, 1);
}
