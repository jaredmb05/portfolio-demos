// Future Move-Ins checks (ported from the old jsdom test, which can't load ES modules) — a Playwright CLI run-code function.
// Run it with tests/future_flows.sh. The Desk loads unmodified at https://desk.test/desk/ with tests/stub_firebase_future.js
// as Firestore (four tours around the 45-day rule) and the clock pinned to Tue Oct 6 2026, 2:10 PM New York time.
// Returns { passed, failed, steps: [{ step, ok, detail }], errors }.
async page => {
  const ROOT = '__ROOT__';
  const ctx = page.context();
  const errors = [], steps = [];
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css' };
  await ctx.route('**/*', route => {
    const u = route.request().url();
    const app = u.match(/^https:\/\/desk\.test\/([^?#]*)/);
    if (app) {
      let p = app[1]; if (p === '' || p.endsWith('/')) p += 'index.html';
      if (p === 'shared/config.js') return route.fulfill({ path: ROOT + '/tests/config.test.js', contentType: TYPES.js });
      return route.fulfill({ path: ROOT + '/apps/' + p, contentType: TYPES[p.split('.').pop()] }).catch(() => route.fulfill({ status: 404, body: '' }));
    }
    if (u.includes('firebase-app-compat')) return route.fulfill({ path: ROOT + '/tests/stub_firebase_future.js', contentType: TYPES.js });
    if (u.includes('firebase-firestore-compat')) return route.fulfill({ body: '', contentType: TYPES.js });
    return route.abort();
  });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text()); });
  p.on('pageerror', e => errors.push('page error: ' + e.message));
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('ld_tourSeen', '1'); } catch (e) {}
    // Capture the .ics text the app hands to URL.createObjectURL
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = b => { b.text().then(t => { window.__ics = t; }); return orig(b); };
  });
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto('https://desk.test/desk/');
  await p.waitForTimeout(400);

  const step = async (name, fn) => { try { const r = await p.evaluate(fn); steps.push({ step: name, ok: r === true, detail: r === true ? '' : String(r) }); } catch (e) { steps.push({ step: name, ok: false, detail: e.message.split('\n')[0] }); } };
  // Inside the page: the app's own module instances, and dates relative to the pinned clock
  const PRELUDE = `const imp = f => import(new URL(f, location.href).href);
    const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
    const wait = ms => new Promise(r => setTimeout(r, ms)); const leads = window.__LEADS; const d = document;`;
  const fn = body => new Function(`return (async () => { ${PRELUDE} ${body} })();`);

  await step('auto-capture: only tours with move-in >45 days after the tour (not inspections, not near-term)', fn(`
    const ids = Object.keys(leads).sort(); if (JSON.stringify(ids) !== JSON.stringify(['tour-far', 'tour-soon'])) return ids.join(',');
    const k = leads['tour-far']; if (k.followUpDate !== inDays(90)) return 'follow-up ' + k.followUpDate + ' vs ' + inDays(90);
    if (!/1 Bed/.test(k.criteria) || !/#2903/.test(k.units)) return JSON.stringify(k);
    const contact = Object.keys(k).filter(x => /mail|phone/i.test(x)); return !contact.length || 'stored contact info: ' + contact.join(', ');`));
  await step('no duplicates when tours refresh', fn(`
    await (await imp('js/future-leads.js')).flCaptureFromTours(); await wait(30); return Object.keys(leads).length === 2 || Object.keys(leads).length;`));
  await step('tab label + header show due count; overdue lead in "Reach out now"', fn(`
    d.getElementById('queuePanel').classList.add('open'); setQueueTab('future'); await wait(20);
    const tabs = d.getElementById('queueTabs').textContent; if (!/Future Move-Ins \\(2 · 1 due\\)/.test(tabs)) return tabs;
    if (!/1 future move-in to follow up/.test(d.getElementById('queueMeta').textContent)) return d.getElementById('queueMeta').textContent;
    const body = d.getElementById('queueBody').textContent.replace(/\\s+/g, ' '); const due = body.split('Coming up')[0];
    if (!/Ana P\\./.test(due) || !/overdue/.test(due) || /Karen/.test(due)) return due.slice(0, 300);
    if (!/Outlook: search "Karen" around/.test(body)) return 'outlook hint'; return true;`));
  await step('manual add: name + move-in; follow-up = move-in − 30', fn(`
    d.querySelector('[onclick*="flFormOpen=true"]').click(); await wait(10);
    d.getElementById('flFirst').value = 'jordan'; d.getElementById('flInit').value = 'k'; d.getElementById('flMoveIn').value = inDays(150);
    d.getElementById('flBeds').value = '2 Bed'; d.getElementById('flBudget').value = '5000';
    await (await imp('js/future-leads.js')).flAddManual(); await wait(30);
    const l = Object.values(leads).find(x => x.name === 'Jordan K.');
    return !!l && l.followUpDate === inDays(120) && /2 Bed · up to \\$5,000/.test(l.criteria) || JSON.stringify(l);`));
  await step('manual add rejects past move-in', fn(`
    d.querySelector('[onclick*="flFormOpen=true"]').click(); await wait(10);
    d.getElementById('flFirst').value = 'X'; d.getElementById('flMoveIn').value = inDays(-3); const n = Object.keys(leads).length;
    await (await imp('js/future-leads.js')).flAddManual(); await wait(20); flFormOpen = false;
    return Object.keys(leads).length === n || 'added';`));
  await step('Contacted → moves to Done; Reopen brings it back', fn(`
    const fl = await imp('js/future-leads.js');
    await fl.flSetStatus('tour-soon', 'contacted'); await wait(30); renderTourQueue();
    if (fl.flDueCount() !== 0) return 'still due'; if (!/Done \\(1\\)/.test(d.getElementById('queueBody').textContent)) return 'no Done';
    await fl.flSetStatus('tour-soon', 'open'); await wait(30); return fl.flDueCount() === 1 || 'not reopened';`));
  await step('Add to Outlook: valid calendar file on the follow-up date with a reminder', fn(`
    (await imp('js/future-leads.js')).flIcs('tour-far'); await wait(60); const ics = window.__ics || '';
    const dd = inDays(90).replace(/-/g, '');
    for (const need of ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:' + dd + 'T093000', 'BEGIN:VALARM', 'TRIGGER:-PT0M', 'SUMMARY:Follow up: Karen M. (toured', 'END:VCALENDAR'])
      if (!ics.includes(need)) return 'missing ' + need;
    return /\\r\\n/.test(ics) || 'line endings';`));
  // ----- Leads stay done (production Desk v1.34, D46): production's four checks. "Another Desk" is a second page whose leads
  // already in the database are copied in, and whose leads list is held back (the stub's __releaseLeads) so its tours arrive
  // first, as when a Desk opens. All four fail on the code before it. -----
  const secondDesk = async seed => {
    const q = await ctx.newPage();
    q.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push('second Desk console: ' + m.text()); });
    q.on('pageerror', e => errors.push('second Desk page error: ' + e.message));
    await q.addInitScript(s => { window.__LEADS_SEED = s; window.__HOLD_LEADS = true; try { localStorage.clear(); localStorage.setItem('ld_tourSeen', '1'); } catch (e) {} }, seed);
    await q.setViewportSize({ width: 1440, height: 900 });
    await q.goto('https://desk.test/desk/'); await q.waitForTimeout(500);   // its tours have arrived; its leads haven't
    return q;
  };
  // A lead's status on another Desk: as its tours arrive (leads still held back), then once its leads list arrives
  const onSecondDesk = async (seed, id) => {
    const q = await secondDesk(seed);
    const before = await q.evaluate(i => (window.__LEADS[i] || {}).status || '(none)', id);
    await q.evaluate(() => window.__releaseLeads()); await q.waitForTimeout(300);
    const after = await q.evaluate(i => (window.__LEADS[i] || {}).status || '(none)', id);
    await q.close();
    return { before, after };
  };
  const leadsNow = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__LEADS)));
  const push = (name, ok, detail) => steps.push({ step: name, ok: !!ok, detail: ok ? '' : detail });

  // 1. This Desk with its list emptied, as a Desk sees it before its leads arrive (production's check), then another Desk opening
  const here1 = await p.evaluate(new Function(`return (async () => { ${PRELUDE}
    const fl = await imp('js/future-leads.js');
    await fl.flSetStatus('tour-soon', 'contacted'); await wait(30);
    fl.futureLeads.length = 0; await fl.flCaptureFromTours(); await wait(30);
    const s = leads['tour-soon'].status; window.__notifyLeads(); await wait(30); return s; })();`));
  const there1 = await onSecondDesk(await leadsNow(), 'tour-soon');
  push('Contacted stays contacted when a Desk gets its tours before its leads (each new lead is read first, never written over)',
    here1 === 'contacted' && there1.before === 'contacted' && there1.after === 'contacted', `this Desk: ${here1} · another Desk, before its leads: ${there1.before}, after: ${there1.after}`);
  await p.evaluate(new Function(`return (async () => { ${PRELUDE} await (await imp('js/future-leads.js')).flSetStatus('tour-soon', 'open'); await wait(30); })();`));

  // 2. Another Desk, with Karen's lead never captured: nothing until its leads list arrives, then just that one
  const noFar = await leadsNow(); delete noFar['tour-far'];
  const q2 = await secondDesk(noFar);
  const early = await q2.evaluate(() => Object.keys(window.__LEADS).sort().join(','));
  await q2.evaluate(() => window.__releaseLeads()); await q2.waitForTimeout(300);
  const late = await q2.evaluate(() => ({ far: (window.__LEADS['tour-far'] || {}).status || '(none)', soon: window.__LEADS['tour-soon'].status }));
  await q2.close();
  push('Nothing is added before the leads list has loaded; once it has, the missing lead is added and the others are left as they are',
    early === Object.keys(noFar).sort().join(',') && late.far === 'open' && late.soon === 'open', `before the list: ${early} · after: tour-far ${late.far}, tour-soon ${late.soon}`);

  // 3. Delete a lead from a tour: hidden, and added back neither here nor by another Desk opening
  const here3 = await p.evaluate(new Function(`return (async () => { ${PRELUDE}
    const fl = await imp('js/future-leads.js');
    await fl.flDelete('tour-far'); await wait(30); await fl.flCaptureFromTours(); await wait(30); renderTourQueue();
    return { status: (leads['tour-far'] || {}).status || '(erased)', listed: /Karen/.test(d.getElementById('queueBody').textContent), tabs: d.getElementById('queueTabs').textContent }; })();`));
  const there3 = await onSecondDesk(await leadsNow(), 'tour-far');
  push('Delete hides a lead from a tour (marked deleted, off the list) and it isn\'t added back, by this Desk or by another one that gets its tours first',
    here3.status === 'deleted' && !here3.listed && /Future Move-Ins \(2 · 1 due\)/.test(here3.tabs) && there3.before === 'deleted' && there3.after === 'deleted',
    `this Desk: ${JSON.stringify(here3)} · another Desk, before its leads: ${there3.before}, after: ${there3.after}`);

  // 4. Delete a lead added by hand: hidden the same way, not erased
  await step('Delete hides a lead added by hand too: marked deleted (not erased), off every list and count', fn(`
    const id = Object.values(leads).find(x => x.name === 'Jordan K.').id;
    await (await imp('js/future-leads.js')).flDelete(id); await wait(30); renderTourQueue();
    const body = d.getElementById('queueBody').textContent, tabs = d.getElementById('queueTabs').textContent;
    if (!leads[id] || leads[id].status !== 'deleted' || !leads[id].statusAtIso) return JSON.stringify(leads[id]) || 'erased';
    if (/Jordan/.test(body)) return 'still listed';
    return /Future Move-Ins \\(1 · 1 due\\)/.test(tabs) || tabs;`));

  const failed = steps.filter(s => !s.ok).length;
  return JSON.stringify({ passed: steps.length - failed, failed, steps, errors }, null, 1);
}
