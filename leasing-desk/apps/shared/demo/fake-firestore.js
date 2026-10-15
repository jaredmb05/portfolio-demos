// Seeded, reactive fake Firebase for the Leasing Desk and the iPad app, with fictional data. It runs the in-browser demo
// (shared/boot.js loads it with ?demo) and the browser tests (tests/*_flows.js and *_capture.js serve it in place of the SDK).
// Writes go to an in-memory store and re-fire listeners, so Start / Finish / Mark Sent move rows between tabs.
// Options (set window.__SEED_OPTS before this loads):
//   { dbx, empty, offline, seedLocal (Desk browser storage), ipadCache (iPad's last-received showsheet copy), stale (publish is 2 days old),
//     hostile (quotes, markup and a javascript: link in shared fields, as anyone could write them) }
// Dates are relative to "now", so pin the clock (Playwright clock.setFixedTime) for repeatable screenshots.
(function () {
  const O = window.__SEED_OPTS || {};
  const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  const NOW = new Date();
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // The scene is a busy Tuesday at 2:10 PM. The tests pin the clock there; the demo shifts every seeded time so that "now" is 2:10 PM.
  const scene = new Date(NOW); scene.setHours(14, 10, 0, 0);
  const SHIFT = O.demo ? NOW.getTime() - scene.getTime() : 0;
  // at(-1, '17:40') → ISO for yesterday 5:40 PM local (shifted in the demo)
  const at = (dayOff, hm) => { const d = new Date(NOW); d.setDate(d.getDate() + dayOff); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return new Date(d.getTime() + SHIFT).toISOString(); };
  const inDays = n => { const d = new Date(NOW); d.setDate(d.getDate() + n); return ymd(d); };
  const TODAY = ymd(NOW);

  // ---------- showsheet units (same shape the Desk parses from the Excel file) ----------
  const U = (building, bedroomGroup, unit, type, sqft, view, monthly, incentive, extra) => {
    const free = /2 months free/i.test(incentive) ? 2 : /1 month free/i.test(incentive) ? 1 : /½|1\/2 month free/i.test(incentive) ? 0.5 : 0;
    const term = /24-month/i.test(incentive) ? 24 : 12;
    return Object.assign({ building, bedroomGroup, unit, type, sqft, direction: '', view, monthly, netEff: free ? Math.round(monthly * (term - free) / term) : null, incentive, avail: 'Immediately', priority: false, hasApp: false }, extra || {});
  };
  const V1 = 'Manhattan Skyline, River, Waterfront Park', V2 = 'Partial Manhattan Skyline, River', V3 = 'Tidemark Blvd', V4 = 'Tidemark Harbor', V5 = 'Manhattan Skyline, River, Harbor Bridge';
  const units = [
    U('2050 TIDEMARK BLVD', 'STUDIOS', '506', 'Studio, 1 Bath Alc', 520, V3, 3295, 'No Incentive'),
    U('2050 TIDEMARK BLVD', 'STUDIOS', '1104', 'Studio, 1 Bath', 495, V4, 3350, '1 Month Free OR 1 Mo. OP', { avail: 'November 1, 2026' }),
    U('2050 TIDEMARK BLVD', '1 BEDROOMS', '1812', '1 Bed, 1 Bath W/D', 712, V2, 4150, '1 Month Free OR 1 Mo. OP', { priority: true }),
    U('2050 TIDEMARK BLVD', '1 BEDROOMS', '2203', '1 Bed, 1 Bath W/D Balc', 745, V1, 4495, '1 Month Free OR 1 Mo. OP', { hasApp: true }),
    U('2050 TIDEMARK BLVD', '2 BEDROOMS', '2901', '2 Bed, 2 Bath W/D WIC', 1105, V1, 6450, '1 Month Free and 1/2 Mo. OP'),
    U('2050 TIDEMARK BLVD', '2 BEDROOMS', '3402', '2 Bed, 2 Bath W/D Balc', 1140, V5, 6895, 'No Incentive', { avail: 'October 15, 2026' }),
    U('2230 TIDEMARK BLVD', 'STUDIOS', '714', 'Studio, 1 Bath', 480, V4, 3195, '1 Month Free OR 1 Mo. OP'),
    U('2230 TIDEMARK BLVD', '1 BEDROOMS', '1509', '1 Bed, 1 Bath W/D', 698, V2, 3995, '1 Month Free OR 1 Mo. OP', { priority: true }),
    U('2230 TIDEMARK BLVD', '1 BEDROOMS', '2405', '1 Bed, 1 Bath W/D HC', 730, V1, 4380, 'No Incentive', { hasApp: true }),
    U('2230 TIDEMARK BLVD', '2 BEDROOMS', '3107', '2 Bed, 2 Bath W/D', 1060, V1, 6295, '1 Month Free OR 1 Mo. OP'),
    U('2230 TIDEMARK BLVD', '3 BEDROOMS', '4201', '3 Bed, 2 Bath W/D Terr', 1420, V1, 8950, '2 Months Free on 24-Month Lease', { avail: 'December 1, 2026' }),
    U('2120 TIDEMARK BLVD', 'STUDIOS', '308', 'Studio, 1 Bath', 455, V3, 3050, 'No Incentive'),
    U('2120 TIDEMARK BLVD', '1 BEDROOMS', '906', '1 Bed, 1 Bath W/D', 680, V2, 3895, '1 Month Free OR 1 Mo. OP'),
    U('2120 TIDEMARK BLVD', '2 BEDROOMS', '1611', '2 Bed, 1 Bath W/D', 905, V4, 5195, '1 Month Free OR 1 Mo. OP', { priority: true }),
    U('2040 TIDEMARK BLVD', '1 BEDROOMS', '1207', '1 Bed, 1 Bath', 655, V4, 3750, 'No Incentive'),
    U('2040 TIDEMARK BLVD', '1 BEDROOMS', '3104', '1 Bed, 1 Bath W/D Balc', 705, V1, 4295, '1 Month Free OR 1 Mo. OP', { hasApp: true }),
    U('2040 TIDEMARK BLVD', '2 BEDROOMS', '2608', '2 Bed, 2 Bath W/D', 1010, V2, 5895, '1 Month Free OR 1 Mo. OP'),
    U('2110 TIDEMARK BLVD', 'STUDIOS', '411', 'Studio, 1 Bath', 470, V3, 3150, '1 Month Free OR 1 Mo. OP'),
    U('2110 TIDEMARK BLVD', '1 BEDROOMS', '1201', '1 Bed, 1 Bath W/D', 690, V2, 4050, '1 Month Free OR 1 Mo. OP', { avail: 'Occupied' }),
    U('2110 TIDEMARK BLVD', '2 BEDROOMS', '2305', '2 Bed, 2 Bath W/D DA', 1085, V1, 6150, '1 Month Free OR 1 Mo. OP'),
    U('2110 TIDEMARK BLVD', '3 BEDROOMS', '3801', '3 Bed, 3 Bath W/D Terr', 1510, V5, 9450, 'No Incentive')
  ];
  // Floor plan links for most units (every 7th is missing, so "No Floor Plan" badges show)
  const floorPlans = {};
  units.forEach((u, i) => { if (i % 7 !== 3) floorPlans[`${u.building.slice(0, 4)}|${u.unit}`] = `https://www.dropbox.com/scl/fi/fp${i}x/${u.building.slice(0, 4)}_${u.unit}.pdf?rlkey=r${i}&dl=0`; });
  // hostile: the collections are world-writable, so a field can hold anything. None of this may become markup, run, or link (B4).
  const PWN = tag => `<img id="pwn-${tag}" src="x" onerror="window.__pwned='${tag}'">`;
  if (O.hostile) {
    units.push({ building: '2050 TIDEMARK BLVD', bedroomGroup: '1 BEDROOMS', unit: "1');window.__pwned=('unit", type: '1 Bed, 1 Bath', sqft: PWN('sqft'), direction: '',
      view: 'River', monthly: 4100, netEff: 3758, incentive: '1 Month Free OR 1 Mo. OP', avail: 'Immediately', priority: false, hasApp: false });
    floorPlans[`${units[0].building.slice(0, 4)}|${units[0].unit}`] = "javascript:window.__pwned='floorplan'";
  }
  // seedLocal: this computer already has today's showsheet + floor plans loaded and has seen the guided tour
  if (O.seedLocal && !O.empty) {
    try {
      localStorage.setItem('ld_showsheet', JSON.stringify(units));
      localStorage.setItem('ld_ssMeta', JSON.stringify({ filename: 'Showsheet.xlsx', count: units.length, loadedAt: at(0, '09:12') }));
      localStorage.setItem('ld_ssAdoptedIso', at(0, '09:12'));
      localStorage.setItem('ld_floorPlans', JSON.stringify(floorPlans));
      localStorage.setItem('ld_fpMeta', JSON.stringify({ filename: 'Floor_Plan_Master.xlsx', count: Object.keys(floorPlans).length, loadedAt: at(0, '09:12') }));
    } catch (e) {}
  }

  // ---------- tours ----------
  const stop = (b, u) => { const x = units.find(z => z.building.startsWith(b) && z.unit === u) || { building: b + ' TIDEMARK BLVD', unit: u, type: '' }; return { key: `${b}|${u}`, building: x.building, unit: u, type: x.type, monthly: x.monthly, netEff: x.netEff, incentive: x.incentive, avail: x.avail, rent: '', free: 0, term: 12, op: 0, opMode: 'or', credit: '', notes: '' }; };
  const T = (id, o) => Object.assign({ id, kind: 'tour', assistant: '', prospect: '', prospectFirst: '', prospectInitial: '', prospectEmail: '', broker: false, brokerLast: '', brokerFirst: '', stops: [], profile: null, source: 'ipad', createdAtIso: null, queuedAtIso: null, startedAtIso: null, finishedAtIso: null }, o);
  const name = (first, init) => ({ prospect: `${first} ${init}.`, prospectFirst: first, prospectInitial: init });
  const tours = [
    // In progress today
    T('t-priya', Object.assign(name('Priya', 'S'), { assistant: 'Rosa', createdAtIso: at(0, '13:31'), queuedAtIso: at(0, '13:31'), startedAtIso: at(0, '13:45'), stops: [stop('2050', '1812'), stop('2230', '2405'), stop('2120', '906')], profile: { beds: ['1 Bed'], priceMin: 3800, priceMax: 4500, moveIn: inDays(25), flexible: false, mustHaves: 'W/D in unit' } })),
    T('t-marcus', Object.assign(name('Marcus', 'T'), { kind: 'inspection', assistant: 'Jun', createdAtIso: at(0, '13:50'), queuedAtIso: at(0, '13:50'), startedAtIso: at(0, '13:58'), stops: [{ key: '2040|3104', building: '2040 TIDEMARK BLVD', unit: '3104', type: 'Inspection', custom: true }] })),
    // Waiting
    T('t-daniel', Object.assign(name('Daniel', 'R'), { source: 'toolkit', prospectEmail: 'daniel.r@example.com', createdAtIso: at(0, '13:52'), queuedAtIso: at(0, '13:52'), stops: [stop('2050', '1104'), stop('2230', '714')], profile: { beds: ['Studio', '1 Bed'], priceMin: 3000, priceMax: 3600, moveIn: inDays(30), flexible: true, mustHaves: '' } })),
    T('t-elena', Object.assign(name('Elena', 'V'), { source: 'toolkit', broker: true, brokerLast: 'Cohen', brokerFirst: 'Dana', createdAtIso: at(0, '14:03'), queuedAtIso: at(0, '14:03'), profile: { beds: ['2 Bed'], priceMin: 5500, priceMax: 6500, moveIn: inDays(40), flexible: false, mustHaves: 'High floor, has a large dog' } })),
    T('t-ruth', Object.assign(name('Ruth', 'K'), { kind: 'inspection', source: 'toolkit', createdAtIso: at(0, '14:06'), queuedAtIso: at(0, '14:06'), stops: [{ key: '2110|2305', building: '2110 TIDEMARK BLVD', unit: '2305', type: 'Inspection', custom: true }] })),
    // Started yesterday, never finished (the "start time is …" warning row)
    T('t-kevin', Object.assign(name('Kevin', 'L'), { assistant: 'Nadia', createdAtIso: at(-1, '17:31'), queuedAtIso: at(-1, '17:31'), startedAtIso: at(-1, '17:40'), stops: [stop('2110', '2305'), stop('2040', '2608')], profile: { beds: ['2 Bed'], priceMin: 5500, priceMax: 6200, moveIn: inDays(20) } })),
    // Finished → follow-ups to send
    T('t-aisha', Object.assign(name('Aisha', 'B'), { assistant: 'Tariq', createdAtIso: at(0, '11:40'), queuedAtIso: at(0, '11:40'), startedAtIso: at(0, '11:48'), finishedAtIso: at(0, '12:30'), stops: [stop('2050', '2901'), stop('2230', '3107'), stop('2040', '2608')], profile: { beds: ['2 Bed'], priceMin: 5800, priceMax: 6600, moveIn: inDays(35), mustHaves: 'Two full baths' } })),
    T('t-tom', Object.assign(name('Tom', 'W'), { assistant: 'Nadia', broker: true, brokerLast: 'Greenberg', createdAtIso: at(0, '10:30'), queuedAtIso: at(0, '10:30'), startedAtIso: at(0, '10:35'), finishedAtIso: at(0, '11:15'), stops: [stop('2230', '1509'), stop('2120', '906')], profile: { beds: ['1 Bed'], priceMin: 3700, priceMax: 4100, moveIn: inDays(28) } })),
    T('t-grace', Object.assign(name('Grace', 'H'), { assistant: 'Rosa', createdAtIso: at(-1, '16:02'), queuedAtIso: at(-1, '16:02'), startedAtIso: at(-1, '16:10'), finishedAtIso: at(-1, '16:50'), stops: [stop('2110', '411')], profile: { beds: ['Studio'], priceMax: 3300, moveIn: inDays(120), mustHaves: 'Starting grad school in February' } })),
    // Follow-up sent → Leasing Manager Check-In
    T('t-omar', Object.assign(name('Omar', 'F'), { assistant: 'Rosa', createdAtIso: at(-1, '13:00'), queuedAtIso: at(-1, '13:00'), startedAtIso: at(-1, '13:05'), finishedAtIso: at(-1, '13:50'), followUpSentAtIso: at(-1, '15:10'), followUpSentBy: 'Rosa', stops: [stop('2050', '3402')], profile: { beds: ['2 Bed'] } })),
    T('t-lucia', Object.assign(name('Lucia', 'M'), { assistant: 'Tariq', createdAtIso: at(-3, '12:00'), queuedAtIso: at(-3, '12:00'), startedAtIso: at(-3, '12:05'), finishedAtIso: at(-3, '12:55'), followUpSentAtIso: at(-3, '14:20'), followUpSentBy: 'Tariq', stops: [stop('2230', '4201')], profile: { beds: ['3 Bed'] } })),
    T('t-ben', Object.assign(name('Ben', 'C'), { assistant: 'Jun', createdAtIso: at(0, '10:05'), queuedAtIso: at(0, '10:05'), startedAtIso: at(0, '10:10'), finishedAtIso: at(0, '10:50'), followUpSentAtIso: at(0, '11:30'), followUpSentBy: 'Jun', stops: [stop('2120', '1611')], profile: { beds: ['2 Bed'] } })),
    // Done (History)
    T('t-hannah', Object.assign(name('Hannah', 'J'), { assistant: 'Nadia', createdAtIso: at(-4, '15:00'), queuedAtIso: at(-4, '15:00'), startedAtIso: at(-4, '15:05'), finishedAtIso: at(-4, '15:45'), followUpSentAtIso: at(-4, '17:00'), followUpSentBy: 'Nadia', checkInSentAtIso: at(-2, '10:20'), checkInSentBy: 'Alex', stops: [stop('2050', '2203'), stop('2230', '1509')], profile: { beds: ['1 Bed'], priceMax: 4500 } }))
  ];
  // A week of finished, fully-handled tours and inspections so Rotation and History look like a real office
  const crew = ['Rosa', 'Tariq', 'Jun', 'Nadia', 'Marco', 'Ellis'];
  const firsts = ['Liam', 'Maya', 'Noah', 'Sofia', 'Ethan', 'Chloe', 'Lucas', 'Ava', 'Mason', 'Isla', 'Leo', 'Zoe', 'Owen', 'Ruby', 'Caleb', 'Nora', 'Jonah', 'Ivy', 'Felix', 'Ada', 'Hugo', 'Mila', 'Theo', 'Lena'];
  const pool = [['2050', '1812'], ['2230', '1509'], ['2120', '906'], ['2040', '1207'], ['2110', '2305'], ['2050', '2901'], ['2230', '714'], ['2110', '411']];
  let k = 0;
  for (let day = -6; day <= -1; day++) {
    for (let j = 0; j < 4; j++, k++) {
      const insp = k % 5 === 4; const who = crew[(k * 7 + day + 12) % crew.length]; const h = 10 + j * 2;
      const s1 = pool[k % pool.length], s2 = pool[(k + 3) % pool.length];
      tours.push(T('h-' + k, Object.assign(name(firsts[k % firsts.length], String.fromCharCode(65 + (k * 5) % 26)), {
        kind: insp ? 'inspection' : 'tour', assistant: who,
        createdAtIso: at(day, `${h}:00`), queuedAtIso: at(day, `${h}:00`), startedAtIso: at(day, `${h}:10`), finishedAtIso: at(day, `${h}:55`),
        followUpSentAtIso: insp ? null : at(day, `${h + 1}:30`), followUpSentBy: insp ? '' : who,
        checkInSentAtIso: insp || day > -2 ? null : at(day + 1, '11:00'), checkInSentBy: insp || day > -2 ? '' : (k % 2 ? 'Alex' : 'Morgan'),
        stops: insp ? [{ key: s1.join('|'), building: s1[0] + ' TIDEMARK BLVD', unit: s1[1], type: 'Inspection', custom: true }] : [stop(s1[0], s1[1]), stop(s2[0], s2[1])],
        profile: insp ? null : { beds: ['1 Bed'], priceMin: 3500, priceMax: 4500, moveIn: inDays(20 + k) }
      })));
    }
  }
  // Today: two tours + one inspection already done this morning (rotation counts)
  tours.push(T('h-am1', Object.assign(name('Clara', 'D'), { assistant: 'Rosa', createdAtIso: at(0, '10:00'), queuedAtIso: at(0, '10:00'), startedAtIso: at(0, '10:04'), finishedAtIso: at(0, '10:40'), followUpSentAtIso: at(0, '11:00'), followUpSentBy: 'Rosa', stops: [stop('2050', '506')], profile: { beds: ['Studio'] } })));
  tours.push(T('h-am2', Object.assign(name('Peter', 'N'), { kind: 'inspection', assistant: 'Tariq', createdAtIso: at(0, '10:20'), queuedAtIso: at(0, '10:20'), startedAtIso: at(0, '10:22'), finishedAtIso: at(0, '10:45'), stops: [{ key: '2230|3107', building: '2230 TIDEMARK BLVD', unit: '3107', type: 'Inspection', custom: true }] })));
  tours.forEach(t => { t.updatedAtIso = t.checkInSentAtIso || t.followUpSentAtIso || t.finishedAtIso || t.startedAtIso || t.queuedAtIso; });

  // ---------- other collections ----------
  const store = { tours: {}, future_leads: {}, quiz_results: {}, settings: {}, showsheet: {}, showsheet_history: {} };
  if (!O.empty) tours.forEach(t => { store.tours[t.id] = t; });
  store.settings.assistants = { names: crew.slice() };
  store.settings.schedule = { byName: { Ellis: [1, 3, 5] } };   // Ellis is off on Tuesdays → out automatically
  store.settings.availability = { byDate: { [TODAY]: O.empty ? [] : ['Marco'] }, inByDate: {} };
  store.settings.appointments = { byDate: O.empty ? {} : { [TODAY]: { '14.5': { tours: 1, insp: 0, asked: true } } } };
  if (O.dbx) store.settings.dropboxSync = { showsheetUrl: 'https://www.dropbox.com/scl/fi/k2x9q/Showsheet.xlsx?rlkey=a1b2c3&dl=0', floorplanUrl: 'https://www.dropbox.com/scl/fi/p7m4w/Floor_Plan_Master.xlsx?rlkey=d4e5f6&dl=0', ssHash: 'seed', fpHash: 'seed', lastSyncIso: at(0, '09:12'), lastCheckIso: at(0, '14:05') };
  const fpList = Object.entries(floorPlans).map(([key, url]) => ({ key, url }));
  if (!O.empty) store.showsheet.current = { units, floorPlans: fpList, unitCount: units.length, floorPlanCount: fpList.length, filename: 'Showsheet.xlsx', publishedBy: O.dbx ? 'Dropbox sync' : 'Alex', publishedAtIso: O.stale ? at(-2, '09:12') : at(0, '09:12') };
  if (O.ipadCache && store.showsheet.current) { try { localStorage.setItem('showsheet_cache', JSON.stringify(store.showsheet.current)); } catch (e) {} }
  if (!O.empty) [
    { id: 'tour-x-ana', source: 'tour', name: 'Ana P.', assistant: 'Nadia', tourDate: inDays(-50), moveIn: inDays(10), followUpDate: inDays(-20), criteria: '2 Bed · $0–$6,500', units: '#1901, #3601', status: 'open' },
    { id: 'm-jordan', source: 'manual', name: 'Jordan K.', assistant: '', tourDate: inDays(-2), moveIn: inDays(150), followUpDate: inDays(120), criteria: '2 Bed · up to $5,000', units: '', status: 'open' },
    { id: 'tour-x-will', source: 'tour', name: 'Will S.', assistant: 'Rosa', tourDate: inDays(-40), moveIn: inDays(30), followUpDate: inDays(0), criteria: '1 Bed · $3,800–$4,200 · W/D', units: '#1812, #906', status: 'open' },
    { id: 'tour-x-mei', source: 'tour', name: 'Mei L.', assistant: 'Tariq', tourDate: inDays(-60), moveIn: inDays(5), followUpDate: inDays(-25), criteria: 'Studio · up to $3,300', units: '#714', status: 'contacted', statusBy: 'Alex', statusAtIso: at(-20, '10:00') }
  ].forEach(l => { store.future_leads[l.id] = l; });
  if (!O.empty) [
    { name: 'Rosa', score: 28, total: 30, pct: 93, passed: true, dateIso: at(-1, '09:40'), missed: [{ category: 'Broker quoting', q: 'Broker + OR concession: who gets what?', chosen: 'Net effective to prospect and OP to broker', correct: 'OP to broker; net only if the broker waives' }, { category: 'Requirements', q: 'Guarantor income requirement?', chosen: '45× monthly rent', correct: '75× monthly rent' }] },
    { name: 'Marco', score: 21, total: 30, pct: 70, passed: false, dateIso: at(-2, '16:15'), missed: [{ category: 'Requirements', q: 'Application fee?', chosen: '$50 per person', correct: '$20 per person' }, { category: 'Buildings', q: 'Which building applies the incentive to the last month?', chosen: '2050', correct: '2110' }, { category: 'Requirements', q: 'Tenant income requirement?', chosen: '40× monthly rent', correct: '45× monthly rent' }] },
    { name: 'Ellis', score: 26, total: 30, pct: 87, passed: true, dateIso: at(-3, '11:05'), missed: [{ category: 'Lounges', q: 'Which weekends can the lounge be reserved?', chosen: '1st and 3rd', correct: '2nd and 4th' }] },
    { name: 'Jun', score: 30, total: 30, pct: 100, passed: true, dateIso: at(-5, '10:30'), missed: [] },
    { name: 'Tariq', score: 24, total: 30, pct: 80, passed: true, dateIso: at(-8, '14:00'), missed: [{ category: 'Broker quoting', q: 'No broker: what do you quote?', chosen: 'Free month or OP', correct: 'Prospect incentive only, never mention OP' }] }
  ].forEach((r, i) => { store.quiz_results['q' + i] = r; });
  if (O.hostile) {
    const t = { id: "t-pwn' onmouseover='window.__pwned=1", kind: 'tour', source: 'ipad', assistant: '', prospect: 'Hostile H.', prospectFirst: 'Hostile',
      createdAtIso: at(0, '14:05'), queuedAtIso: at(0, '14:05'), updatedAtIso: at(0, '14:05'), stops: [], profile: null };
    store.tours[t.id] = t;
    store.quiz_results["q'pwn"] = { name: 'Hostile', score: PWN('score'), total: PWN('total'), pct: PWN('pct'), passed: false, dateIso: at(-1, '10:00'), missed: [] };
    store.settings.assistants.names.push("Zed' onmouseover='window.__pwned=1");
  }

  // ---------- fake Firestore ----------
  window.__W = [];                      // write log: [collection, id, data, options]
  window.__STORE = store;
  const listeners = [];
  const fire = col => listeners.filter(l => l.col === col).forEach(l => setTimeout(l.run, 0));
  const cmp = (a, op, b) => op === '>=' ? a >= b : op === '<=' ? a <= b : op === '>' ? a > b : op === '<' ? a < b : op === '==' ? a === b : true;
  const docSnap = (col, id) => { const d = store[col][id]; return { id, exists: !!d, data: () => clone(d), metadata: { fromCache: false } }; };
  function query(col, wh, ob, lim) {
    const run = () => {
      let rows = Object.keys(store[col]).map(id => ({ id, d: store[col][id] }));
      wh.forEach(([f, op, v]) => { rows = rows.filter(r => cmp(r.d[f], op, v)); });
      if (ob) rows.sort((a, b) => (a.d[ob[0]] || '') < (b.d[ob[0]] || '') ? (ob[1] === 'desc' ? 1 : -1) : (ob[1] === 'desc' ? -1 : 1));
      if (lim) rows = rows.slice(0, lim);
      const docs = rows.map(r => ({ id: r.id, data: () => clone(r.d) }));
      return { size: docs.length, docs, forEach: fn => docs.forEach(fn), metadata: { fromCache: false } };
    };
    return {
      where: (f, op, v) => query(col, wh.concat([[f, op, v]]), ob, lim),
      orderBy: (f, dir) => query(col, wh, [f, dir || 'asc'], lim),
      limit: n => query(col, wh, ob, n),
      add(data) { const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); window.__W.push([col, id, clone(data), 'add']); store[col][id] = clone(data); fire(col); return Promise.resolve({ id }); },
      get: () => O.offline ? Promise.reject(new Error('Failed to get documents from server')) : Promise.resolve(run()),
      onSnapshot(cb, err) {
        if (O.offline) { setTimeout(() => err && err(new Error('Could not reach Cloud Firestore backend')), 0); return () => {}; }
        const l = { col, run: () => cb(run()) }; listeners.push(l); setTimeout(l.run, 0); return () => listeners.splice(listeners.indexOf(l), 1);
      },
      doc: id => ({
        get: () => Promise.resolve(docSnap(col, id)),
        onSnapshot(a, b, c) {
          const cb = typeof a === 'function' ? a : b, err = typeof a === 'function' ? b : c;
          if (O.offline) { setTimeout(() => err && err(new Error('offline')), 0); return () => {}; }
          const l = { col, run: () => cb(docSnap(col, id)) }; listeners.push(l); setTimeout(l.run, 0); return () => listeners.splice(listeners.indexOf(l), 1);
        },
        set(data, opts) {
          window.__W.push([col, id, clone(data), opts || null]);
          const prev = store[col][id];
          store[col][id] = Object.assign({}, opts && opts.merge && prev ? prev : {}, clone(data));
          fire(col); return Promise.resolve();
        },
        delete() { window.__W.push([col, id, null, 'delete']); delete store[col][id]; fire(col); return Promise.resolve(); }
      })
    };
  }
  const db = { enablePersistence: () => Promise.resolve(), collection: name => { store[name] = store[name] || {}; return query(name, [], null, 0); } };
  const firestore = () => db; firestore.FieldValue = { serverTimestamp: () => 'ts' };
  window.firebase = { apps: [1], initializeApp() {}, firestore };
})();
