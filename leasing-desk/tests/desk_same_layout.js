// Same layout? — a Playwright CLI run-code function. Run it with tests/desk_same_layout.sh (fills __OLD__ / __NEW__ / __OUT__).
// Opens the Desk twice side by side, the version extracted from git in __OLD__ (https://old.test/) and this folder's in __NEW__
// (https://new.test/), on the same seeded fake Firestore and pinned clock, at 1440, 1280 and 768 wide. In each screen state
// (the queue, each tab, Plan a tour, Help, the email templates, Dropbox settings, the Email Builder in every template, Reports,
// Choose what to print, the guided tour) it compares every element's position and size and its full computed style; words
// aren't compared, so a new build stamp passes. Screenshots can't prove "unchanged" on their own: two runs of the same code
// differ by a few pixels of font smoothing (production D40). Before each comparison every running animation is stopped at the
// same frame on both pages, so a highlight caught mid-fade doesn't count as a change.
// Returns { statesCompared, identicalStates, differentStates, details, elements }.
async page => {
  const ROOTS = { old: '__OLD__', new: '__NEW__' }, NEW = '__NEW__';
  const ctx = page.context();
  await ctx.clock.setFixedTime(new Date('2026-10-06T14:10:00-04:00'));
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css', webmanifest: 'application/manifest+json', png: 'image/png' };
  await ctx.route('**/*', route => {
    const u = route.request().url();
    const app = u.match(/^https:\/\/(old|new)\.test\/([^?#]*)/);   // https://old.test/<path> serves __OLD__/apps/<path>; the Desk is at /desk/
    if (app) {
      let p = app[2]; if (p === '' || p.endsWith('/')) p += 'index.html';
      if (p === 'shared/config.js') return route.fulfill({ path: NEW + '/tests/config.test.js', contentType: TYPES.js });
      return route.fulfill({ path: ROOTS[app[1]] + '/apps/' + p, contentType: TYPES[p.split('.').pop()] }).catch(() => route.fulfill({ status: 404, body: '' }));
    }
    if (u.includes('firebase-app-compat')) return route.fulfill({ path: NEW + '/apps/shared/demo/fake-firestore.js', contentType: 'application/javascript' });   // the same data for both
    if (u.includes('firebase-firestore-compat')) return route.fulfill({ body: '', contentType: 'application/javascript' });
    return route.abort();
  });
  const errors = [], details = [];
  let statesCompared = 0, same = 0, elements = 0;
  // Every element: what it is, where it is, and a hash of every computed property, sorted (the browser lists custom properties
  // in a different order per load). The full properties are read again only for the first element that differs.
  const SNAP = () => {
    const hash = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36); };
    return [...document.querySelectorAll('*')].map(el => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect(), pr = [];
      for (let k = 0; k < cs.length; k++) pr.push(cs[k] + ':' + cs.getPropertyValue(cs[k]));
      return (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().replace(/\s+/g, '.') : '')) + ' @' + [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100).join(',') + ' ' + hash(pr.sort().join(';'));
    });
  };
  const PROPS = i => { const el = document.querySelectorAll('*')[i], cs = getComputedStyle(el), pr = []; for (let k = 0; k < cs.length; k++) pr.push(cs[k] + ':' + cs.getPropertyValue(cs[k])); return pr; };
  const imp = f => `import(new URL('${f}', location.href).href)`;
  // The screen states, each a list of steps run on both pages (a string is evaluated in the page; a function gets the page)
  const STATES = [
    ['queue', [`(() => { const q = document.getElementById('queuePanel'); if (!q.classList.contains('open')) { q.classList.add('open'); renderTourQueue(); } })()`]],
    ['tab followup', [`setQueueTab('followup')`]],
    ['tab checkin', [`setQueueTab('checkin')`]],
    ['tab future', [`setQueueTab('future')`]],
    ['future + add lead form', [p => p.click('#queueBody button:has-text("+ Add future lead")')]],
    ['tab rotation', [p => p.click('#queueBody .fl-form button:has-text("Cancel")'), `setQueueTab('rotation')`]],
    ['rotation unlocked', [`(async () => { (await ${imp('js/state.js')}).state.trainingUnlocked = true; renderTourQueue(); })()`]],
    ['tab history', [`(async () => { (await ${imp('js/state.js')}).state.trainingUnlocked = false; setQueueTab('history'); })()`]],
    ['history details', [p => p.locator('#queueBody button:has-text("Details")').first().click()]],
    ['plan a tour', [`setQueueTab('queue')`, `openPlanTour()`]],
    ['plan a tour, broker', [p => p.check('#planBroker')]],
    ['help', [`document.getElementById('planModal').classList.remove('show')`, `openHelp()`]],
    ['email templates', [`document.getElementById('helpModal').classList.remove('show')`, `openTemplateEditor()`]],
    ['dropbox settings', [`document.getElementById('templateModal').classList.remove('show')`, `openDbxSettings()`]],
    ['email builder, two units', [`document.getElementById('dbxModal').classList.remove('show')`, p => p.click('.unit-row[data-key="2050 TIDEMARK BLVD::1812"] .unit-info'), p => p.click('.unit-row[data-key="2110 TIDEMARK BLVD::2305"] .unit-info')]],
    ['email builder, custom unit', [p => p.click('button:has-text("+ Add Custom Unit")')]],
    ['inquiry', [p => p.click('#modeInquiryBtn')]],
    ['welcome', [p => p.click('#modeWelcomeBtn')]],
    ['pfa', [p => p.click('#modePfaBtn'), p => p.click('#pfaSubSignedBtn')]],
    ['application confirmation, assignment', [p => p.click('#modeAppConfBtn'), p => p.check('#appConfAssignToggle'), p => p.fill('#appConfLeaseEnd', '05312027'), p => p.press('#appConfLeaseEnd', 'Tab')]],
    ['lease approval', [p => p.click('#modeApprovalBtn'), p => p.check('#apvNextRentToggle')]],
    ['reports', [p => p.click('#modeTourBtn'), `window.scrollTo(0, 0)`, `(async () => { (await ${imp('js/state.js')}).state.trainingUnlocked = true; toggleReports(); setReportRange(6); })()`, p => p.waitForTimeout(700)]],
    ['reports, tour times review and a table', [p => p.locator('#rpt-tourtimes .weekly-table tr.team button.wk-cell').nth(1).click(), p => p.click('#rpt-fit .rpt-tbtn')]],
    ['choose what to print', [`openPrintPick()`]],
    ['guided tour', [p => p.keyboard.press('Escape'), `window.scrollTo(0, 0)`, `startGuidedTour()`, p => p.waitForTimeout(700)]],
  ];
  const settle = p => p.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 5000 }).catch(() => {});
  for (const W of [1440, 1280, 768]) {
    const pages = {};
    for (const which of Object.keys(ROOTS)) {
      const p = pages[which] = await ctx.newPage();
      p.on('pageerror', e => errors.push(`${which} ${W}: page error: ${e.message}`));
      p.on('dialog', d => d.accept().catch(() => {}));
      await p.addInitScript(o => { window.__SEED_OPTS = o; try { localStorage.clear(); localStorage.setItem('ld_tourSeen', '1'); } catch (e) {} }, { seedLocal: true });
      await p.setViewportSize({ width: W, height: 900 });
      await p.goto(`https://${which}.test/desk/`);
    }
    await pages.old.waitForTimeout(900);
    for (const [label, steps] of STATES) {
      for (const p of Object.values(pages)) {
        for (const s of steps) { try { if (typeof s === 'string') await p.evaluate(s); else await s(p); } catch (e) { errors.push(`${W} ${label}: ${String(e.message || e).split('\n')[0]}`); } await p.waitForTimeout(120); }
      }
      await Promise.all(Object.values(pages).map(settle));
      await pages.old.waitForTimeout(800);   // longer than the Desk's own short-lived marks (a picked unit's highlight class: 600 ms)
      // Animations stop at the same frame on both pages: finished, or (a pulsing ring) held at its start
      await Promise.all(Object.values(pages).map(p => p.evaluate(() => document.getAnimations().forEach(an => { try { if (an.effect && an.effect.getTiming().iterations === Infinity) { an.pause(); an.currentTime = 0; } else an.finish(); } catch (e) {} }))));
      const [a, b] = await Promise.all([pages.old.evaluate(SNAP), pages.new.evaluate(SNAP)]);
      statesCompared++; elements += a.length;
      const key = `${W} ${label}`;
      if (a.length !== b.length) { details.push(`${key}: ${a.length} elements → ${b.length}`); continue; }
      const bad = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) bad.push(i);
      if (!bad.length) { same++; continue; }
      const [pa, pb] = await Promise.all([pages.old.evaluate(PROPS, bad[0]), pages.new.evaluate(PROPS, bad[0])]);
      const sa = new Set(pa), sb = new Set(pb);
      details.push(`${key}: ${bad.length} elements differ; first ${a[bad[0]].split(' ').slice(0, 2).join(' ')} → ${b[bad[0]].split(' ').slice(0, 2).join(' ')}; old ${pa.filter(x => !sb.has(x)).slice(0, 3).join('; ')}; new ${pb.filter(x => !sa.has(x)).slice(0, 3).join('; ')}`.slice(0, 600));
    }
    for (const p of Object.values(pages)) await p.close();
  }
  return JSON.stringify({ statesCompared, identicalStates: same, differentStates: details.length, details, elements, errors });
}
