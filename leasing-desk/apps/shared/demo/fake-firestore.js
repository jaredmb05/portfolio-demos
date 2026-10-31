// Seeded, reactive fake Firebase for the Leasing Desk and the iPad app, with fictional data. It runs the in-browser demo
// (shared/boot.js loads it with ?demo) and the browser tests (tests/*_flows.js and *_capture.js serve it in place of the SDK).
// Writes go to an in-memory store and re-fire listeners, so Start / Finish / Mark Sent move rows between tabs.
// Options (set window.__SEED_OPTS before this loads):
//   { dbx, empty, offline, seedLocal (Desk browser storage), ipadCache (iPad's last-received showsheet copy), stale (publish is 2 days old),
//     hostile (quotes, markup and a javascript: link in shared fields, as anyone could write them),
//     noAnswer (the database hasn't answered yet: every snapshot comes from the saved copy, fromCache, until __NET.answer(), or
//     __NET.hold = false and the next enableNetwork(); disableNetwork / enableNetwork calls are logged in __NET.calls) }
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
  const monthDay = n => { const d = new Date(NOW); d.setDate(d.getDate() + n); return `${d.getMonth() + 1}/${d.getDate()}`; };   // "11/15"
  const TODAY = ymd(NOW);

  // ---------- showsheet units (same shape the Desk parses from the Excel file) ----------
  // A unit with an available date carries availStatus when its NOTES said occupied or reno (D30); the note itself isn't published.
  // A NOTES cell that mentions a gift card is the one note kept: contest (as written) and contestUntil (its date, D35).
  // A red unit cell is hasApp (App pending, off the market); an orange one is backupApps (still on the market, production D49).
  const U = (building, bedroomGroup, unit, type, sqft, view, monthly, incentive, extra) => {
    const free = /2 months free/i.test(incentive) ? 2 : /1 month free/i.test(incentive) ? 1 : /½|1\/2 month free/i.test(incentive) ? 0.5 : 0;
    const term = /24-month/i.test(incentive) ? 24 : 12;
    return Object.assign({ building, bedroomGroup, unit, type, sqft, direction: '', view, monthly, netEff: free ? Math.round(monthly * (term - free) / term) : null, incentive, avail: 'Immediately', priority: false, hasApp: false }, extra || {});
  };
  const V1 = 'Manhattan Skyline, River, Waterfront Park', V2 = 'Partial Manhattan Skyline, River', V3 = 'Tidemark Blvd', V4 = 'Tidemark Harbor', V5 = 'Manhattan Skyline, River, Harbor Bridge';
  const units = [
    U('2050 TIDEMARK BLVD', 'STUDIOS', '506', 'Studio, 1 Bath Alc', 520, V3, 3295, 'No Incentive'),
    U('2050 TIDEMARK BLVD', 'STUDIOS', '1104', 'Studio, 1 Bath', 495, V4, 3350, '1 Month Free OR 1 Mo. OP', { avail: 'November 1, 2026', availStatus: 'occupied' }),   // NOTES "Occupied, tenant out 10/31"
    U('2050 TIDEMARK BLVD', '1 BEDROOMS', '1812', '1 Bed, 1 Bath W/D', 712, V2, 4150, '1 Month Free OR 1 Mo. OP', { priority: true }),
    U('2050 TIDEMARK BLVD', '1 BEDROOMS', '2203', '1 Bed, 1 Bath W/D Balc', 745, V1, 4495, '1 Month Free OR 1 Mo. OP', { hasApp: true }),
    U('2050 TIDEMARK BLVD', '2 BEDROOMS', '2901', '2 Bed, 2 Bath W/D WIC', 1105, V1, 6450, '1 Month Free and 1/2 Mo. OP'),
    U('2050 TIDEMARK BLVD', '2 BEDROOMS', '3402', '2 Bed, 2 Bath W/D Balc', 1140, V5, 6895, 'No Incentive', { avail: 'October 15, 2026', availStatus: 'reno' }),   // NOTES "Reno: new floors"
    U('2230 TIDEMARK BLVD', 'STUDIOS', '714', 'Studio, 1 Bath', 480, V4, 3195, '1 Month Free OR 1 Mo. OP'),
    U('2230 TIDEMARK BLVD', '1 BEDROOMS', '1509', '1 Bed, 1 Bath W/D', 698, V2, 3995, '1 Month Free OR 1 Mo. OP', { priority: true }),
    U('2230 TIDEMARK BLVD', '1 BEDROOMS', '2405', '1 Bed, 1 Bath W/D HC', 730, V1, 4380, 'No Incentive', { hasApp: true }),
    U('2230 TIDEMARK BLVD', '2 BEDROOMS', '3107', '2 Bed, 2 Bath W/D', 1060, V1, 6295, '1 Month Free OR 1 Mo. OP', { contest: `$150 gift card for a lease by ${monthDay(16)}`, contestUntil: inDays(16) }),
    U('2230 TIDEMARK BLVD', '3 BEDROOMS', '4201', '3 Bed, 2 Bath W/D Terr', 1420, V1, 8950, '2 Months Free on 24-Month Lease', { avail: 'December 1, 2026' }),   // NOTES "Great light": vacant, no label
    U('2120 TIDEMARK BLVD', 'STUDIOS', '308', 'Studio, 1 Bath', 455, V3, 3050, 'No Incentive'),
    U('2120 TIDEMARK BLVD', '1 BEDROOMS', '906', '1 Bed, 1 Bath W/D', 680, V2, 3895, '1 Month Free OR 1 Mo. OP'),
    U('2120 TIDEMARK BLVD', '2 BEDROOMS', '1611', '2 Bed, 1 Bath W/D', 905, V4, 5195, '1 Month Free OR 1 Mo. OP', { priority: true }),
    U('2040 TIDEMARK BLVD', '1 BEDROOMS', '1207', '1 Bed, 1 Bath', 655, V4, 3750, 'No Incentive', { backupApps: true }),   // unit cell orange: "Backup apps welcome" (D49)
    U('2040 TIDEMARK BLVD', '1 BEDROOMS', '3104', '1 Bed, 1 Bath W/D Balc', 705, V1, 4295, '1 Month Free OR 1 Mo. OP', { hasApp: true }),
    U('2040 TIDEMARK BLVD', '2 BEDROOMS', '2608', '2 Bed, 2 Bath W/D', 1010, V2, 5895, '1 Month Free OR 1 Mo. OP', { contest: '$100 Gift Card (until further notice)' }),   // no date: stays
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
  // Every tour in the scene below has what a tour needs since production D45 (a size, a top price or "budget flexible", a move-in
  // date or flexible), so any of them can be reopened and sent again. The Reports history further down keeps some sign-ins
  // without a size, price or date, as tours planned before that rule were saved.
  // A stop as the iPad saves it, with the unit's lease term from its incentive text ("on 24-Month Lease", else 12), as
  // leaseTerm in apps/shared/pricing.js reads it (this file isn't a module). over = what was changed on the tour.
  const leaseTerm = inc => { const m = String(inc || '').match(/(\d{1,2})\s*-?\s*(?:months?|mos?)\.?\s+lease\b/i); return m && parseInt(m[1], 10) > 0 ? parseInt(m[1], 10) : 12; };
  const stop = (b, u, over) => { const x = units.find(z => z.building.startsWith(b) && z.unit === u) || { building: b + ' TIDEMARK BLVD', unit: u, type: '' }; return Object.assign({ key: `${b}|${u}`, building: x.building, unit: u, type: x.type, monthly: x.monthly, netEff: x.netEff, incentive: x.incentive, avail: x.avail, rent: '', free: 0, term: leaseTerm(x.incentive), op: 0, opMode: 'or', credit: '', notes: '' }, over || {}); };
  const T = (id, o) => Object.assign({ id, kind: 'tour', assistant: '', prospect: '', prospectFirst: '', prospectInitial: '', broker: false, brokerLast: '', brokerFirst: '', stops: [], profile: null, source: 'ipad', createdAtIso: null, queuedAtIso: null, startedAtIso: null, finishedAtIso: null }, o);
  const name = (first, init) => ({ prospect: `${first} ${init}.`, prospectFirst: first, prospectInitial: init });
  const tours = [
    // In progress today
    T('t-priya', Object.assign(name('Priya', 'S'), { assistant: 'Rosa', createdAtIso: at(0, '13:31'), queuedAtIso: at(0, '13:31'), startedAtIso: at(0, '13:45'), stops: [stop('2050', '1812'), stop('2230', '2405'), stop('2120', '906')], profile: { beds: ['1 Bed'], priceMin: 3800, priceMax: 4500, moveIn: inDays(25), flexible: false, mustHaves: 'W/D in unit' } })),
    T('t-marcus', Object.assign(name('Marcus', 'T'), { kind: 'inspection', assistant: 'Jun', createdAtIso: at(0, '13:50'), queuedAtIso: at(0, '13:50'), startedAtIso: at(0, '13:58'), stops: [{ key: '2040|3104', building: '2040 TIDEMARK BLVD', unit: '3104', type: 'Inspection', custom: true }] })),
    // Waiting
    T('t-daniel', Object.assign(name('Daniel', 'R'), { source: 'toolkit', createdAtIso: at(0, '13:52'), queuedAtIso: at(0, '13:52'), stops: [stop('2050', '1104'), stop('2230', '714')], profile: { beds: ['Studio', '1 Bed'], priceMin: 3000, priceMax: 3600, moveIn: inDays(30), flexible: true, mustHaves: '' } })),
    T('t-elena', Object.assign(name('Elena', 'V'), { source: 'toolkit', broker: true, brokerLast: 'Cohen', brokerFirst: 'Dana', createdAtIso: at(0, '14:03'), queuedAtIso: at(0, '14:03'), profile: { beds: ['2 Bed'], priceMin: 5500, priceMax: 6500, moveIn: inDays(40), flexible: false, mustHaves: 'High floor, has a large dog' } })),
    T('t-ruth', Object.assign(name('Ruth', 'K'), { kind: 'inspection', source: 'toolkit', createdAtIso: at(0, '14:06'), queuedAtIso: at(0, '14:06'), stops: [{ key: '2110|2305', building: '2110 TIDEMARK BLVD', unit: '2305', type: 'Inspection', custom: true }] })),
    // Started yesterday, never finished (the "start time is …" warning row)
    T('t-kevin', Object.assign(name('Kevin', 'L'), { assistant: 'Nadia', createdAtIso: at(-1, '17:31'), queuedAtIso: at(-1, '17:31'), startedAtIso: at(-1, '17:40'), stops: [stop('2110', '2305'), stop('2040', '2608')], profile: { beds: ['2 Bed'], priceMin: 5500, priceMax: 6200, moveIn: inDays(20) } })),
    // Finished → follow-ups to send
    T('t-aisha', Object.assign(name('Aisha', 'B'), { assistant: 'Tariq', createdAtIso: at(0, '11:40'), queuedAtIso: at(0, '11:40'), startedAtIso: at(0, '11:48'), finishedAtIso: at(0, '12:30'), stops: [stop('2050', '2901'), stop('2230', '3107'), stop('2040', '2608')], profile: { beds: ['2 Bed'], priceMin: 5800, priceMax: 6600, moveIn: inDays(35), mustHaves: 'Two full baths' } })),
    T('t-tom', Object.assign(name('Tom', 'W'), { assistant: 'Nadia', broker: true, brokerLast: 'Greenberg', createdAtIso: at(0, '10:30'), queuedAtIso: at(0, '10:30'), startedAtIso: at(0, '10:35'), finishedAtIso: at(0, '11:15'), stops: [stop('2230', '1509'), stop('2120', '906')], profile: { beds: ['1 Bed'], priceMin: 3700, priceMax: 4100, moveIn: inDays(28) } })),
    T('t-grace', Object.assign(name('Grace', 'H'), { assistant: 'Rosa', createdAtIso: at(-1, '16:02'), queuedAtIso: at(-1, '16:02'), startedAtIso: at(-1, '16:10'), finishedAtIso: at(-1, '16:50'), stops: [stop('2110', '411')], profile: { beds: ['Studio'], priceMax: 3300, moveIn: inDays(120), mustHaves: 'Starting grad school in February' } })),
    // Follow-up sent → Leasing Manager Check-In
    T('t-omar', Object.assign(name('Omar', 'F'), { assistant: 'Rosa', createdAtIso: at(-1, '13:00'), queuedAtIso: at(-1, '13:00'), startedAtIso: at(-1, '13:05'), finishedAtIso: at(-1, '13:50'), followUpSentAtIso: at(-1, '15:10'), followUpSentBy: 'Rosa', stops: [stop('2050', '3402')], profile: { beds: ['2 Bed'], priceMax: 6500, moveIn: inDays(30) } })),
    T('t-lucia', Object.assign(name('Lucia', 'M'), { assistant: 'Tariq', createdAtIso: at(-3, '12:00'), queuedAtIso: at(-3, '12:00'), startedAtIso: at(-3, '12:05'), finishedAtIso: at(-3, '12:55'), followUpSentAtIso: at(-3, '14:20'), followUpSentBy: 'Tariq', stops: [stop('2230', '4201')], profile: { beds: ['3 Bed'], priceFlexible: true, moveIn: inDays(21) } })),
    T('t-ben', Object.assign(name('Ben', 'C'), { assistant: 'Jun', createdAtIso: at(0, '10:05'), queuedAtIso: at(0, '10:05'), startedAtIso: at(0, '10:10'), finishedAtIso: at(0, '10:50'), followUpSentAtIso: at(0, '11:30'), followUpSentBy: 'Jun', stops: [stop('2120', '1611')], profile: { beds: ['2 Bed'], priceMin: 5500, priceMax: 6200, flexible: true } })),
    // Done (History)
    T('t-hannah', Object.assign(name('Hannah', 'J'), { assistant: 'Nadia', createdAtIso: at(-4, '15:00'), queuedAtIso: at(-4, '15:00'), startedAtIso: at(-4, '15:05'), finishedAtIso: at(-4, '15:45'), followUpSentAtIso: at(-4, '17:00'), followUpSentBy: 'Nadia', checkInSentAtIso: at(-2, '10:20'), checkInSentBy: 'Alex', stops: [stop('2050', '2203'), stop('2230', '1509')], profile: { beds: ['1 Bed'], priceMax: 4500, moveIn: inDays(18) } }))
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
  tours.push(T('h-am1', Object.assign(name('Clara', 'D'), { assistant: 'Rosa', createdAtIso: at(0, '10:00'), queuedAtIso: at(0, '10:00'), startedAtIso: at(0, '10:04'), finishedAtIso: at(0, '10:40'), followUpSentAtIso: at(0, '11:00'), followUpSentBy: 'Rosa', stops: [stop('2050', '506')], profile: { beds: ['Studio'], priceMax: 3400, moveIn: inDays(14) } })));
  tours.push(T('h-am2', Object.assign(name('Peter', 'N'), { kind: 'inspection', assistant: 'Tariq', createdAtIso: at(0, '10:20'), queuedAtIso: at(0, '10:20'), startedAtIso: at(0, '10:22'), finishedAtIso: at(0, '10:45'), stops: [{ key: '2230|3107', building: '2230 TIDEMARK BLVD', unit: '3107', type: 'Inspection', custom: true }] })));
  // ---------- Reports history (production Desk v1.28–v1.31): six weeks of handled tours before the week above ----------
  // Invented and repeatable (a seeded random number generator), so Reports has something to show out of the box. Every one
  // is finished with its follow-up and check-in sent, so none shows in the Current Queue, Follow-Ups or Check-In; the last
  // five days only get a few more, beside the week above. Move-ins stay within 45 days of the tour (no Future Move-Ins lead),
  // except one tour older than the Desk's 30-day window. Unlike the scene above, these times aren't shifted in the demo:
  // weeks-old tours keep office hours whatever time of day the demo is opened.
  if (!O.empty) {
    const onDay = (dayOff, h, m) => { const d = new Date(NOW); d.setDate(d.getDate() + dayOff); d.setHours(h, m || 0, 0, 0); return d; };
    const plus = (d, min) => new Date(d.getTime() + min * 60000), iso = d => d.toISOString();
    let seed = 20261006; const rnd = () => (seed = seed * 48271 % 2147483647) / 2147483647;
    const pickOf = a => a[Math.floor(rnd() * a.length)];
    const weighted = pairs => { let x = rnd() * pairs.reduce((a, p) => a + p[1], 0); for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[0][0]; };
    const sizeOf = u => /^Studio/.test(u.type) ? 'Studio' : /^1 Bed/.test(u.type) ? '1 Bed' : /^2 Bed/.test(u.type) ? '2 Bed' : '3 Bed';
    const PRICE = { 'Studio': [3000, 3500], '1 Bed': [3700, 4600], '2 Bed': [5400, 6900], '3 Bed': [8200, 9800] };
    const people = ['Aria', 'Cora', 'Dev', 'Elif', 'Finn', 'Gia', 'Hal', 'Iris', 'Jude', 'Kai', 'Lia', 'Milo', 'Nell', 'Pia', 'Quinn', 'Rhea', 'Tess', 'Uma', 'Vic', 'Wren', 'Yara', 'Zane', 'Bea', 'Cal', 'Dina', 'Eli', 'Fay', 'Gus', 'Hana', 'Ines'];
    const who = () => { const f = pickOf(people), i = String.fromCharCode(65 + Math.floor(rnd() * 26)); return { prospect: `${f} ${i}.`, prospectFirst: f, prospectInitial: i }; };
    // A handled tour: set up 4–20 minutes before the start, follow-up sent within two hours of the finish, check-in the
    // next morning (the day after the finish)
    const handled = (id, start, finish, o) => {
      const created = plus(start, -(4 + Math.floor(rnd() * 17))), fu = plus(finish, 20 + Math.floor(rnd() * 100));
      const ciDay = Math.round((new Date(finish).setHours(0, 0, 0, 0) - new Date(NOW).setHours(0, 0, 0, 0)) / 864e5) + 1;
      const ci = onDay(ciDay, 10 + Math.floor(rnd() * 4), Math.floor(rnd() * 60)), assistant = o.assistant || pickOf(crew);
      tours.push(T(id, Object.assign(who(), { assistant, createdAtIso: iso(created), queuedAtIso: iso(created), startedAtIso: iso(start), finishedAtIso: iso(finish),
        followUpSentAtIso: iso(fu), followUpSentBy: assistant, checkInSentAtIso: iso(ci), checkInSentBy: rnd() < 0.5 ? 'Alex' : 'Morgan' }, o)));
    };
    // What the prospect asked for at sign-in: usually the size they toured, sometimes a second size or none; the top of
    // their price range (sometimes none); a move-in 10–44 days after the tour, or none, sometimes flexible
    const profileFor = (size, dayOff) => {
      const [lo, hi] = PRICE[size], r = rnd();
      const beds = r < 0.08 ? [] : r < 0.2 ? [size, size === 'Studio' ? '1 Bed' : size === '3 Bed' ? '2 Bed' : size === '1 Bed' ? 'Studio' : '3 Bed'] : [size === '2 Bed' && rnd() < 0.25 ? '2 Bed/1 Bath' : size];
      const max = rnd() < 0.12 ? null : Math.round((lo + rnd() * (hi - lo)) / 50) * 50;
      const moveIn = rnd() < 0.12 ? '' : ymd(onDay(dayOff + 10 + Math.floor(rnd() * 35), 12));
      return { beds, priceMin: max && rnd() < 0.3 ? max - 500 : null, priceMax: max, moveIn, flexible: rnd() < 0.18, mustHaves: '' };
    };
    // Units shown: 1–3 of the size asked for, and now and then one of another size
    const unitsFor = size => {
      const pool = units.filter(u => sizeOf(u) === size), k = 1 + Math.floor(rnd() * Math.min(3, pool.length)), picks = [];
      while (picks.length < k) { const u = pickOf(pool); if (!picks.includes(u)) picks.push(u); }
      if (rnd() < 0.25) { const u = pickOf(units); if (!picks.includes(u)) picks.push(u); }
      return picks.map(u => stop(u.building.slice(0, 4), u.unit));
    };
    for (let day = -41; day <= -2; day++) {
      const dow = onDay(day, 12).getDay(), full = dow === 6 ? 9 : dow === 0 ? 7 : dow === 1 ? 5 : 6, n = day <= -7 ? full : full - 3;   // weekends busiest
      for (let j = 0; j < n; j++) {
        const size = weighted([['1 Bed', 40], ['2 Bed', 28], ['Studio', 23], ['3 Bed', 9]]);
        const start = onDay(day, weighted([[10, 6], [11, 9], [12, 11], [13, 12], [14, 13], [15, 12], [16, 10], [17, 7], [18, 4]]), Math.floor(rnd() * 50));
        handled(`r${-day}-${j}`, start, plus(start, 22 + Math.floor(rnd() * 44)), { stops: unitsFor(size), profile: profileFor(size, day) });
      }
    }
    // The cases Reports and the tour-times table handle on purpose
    const p = (size, day, extra) => Object.assign(profileFor(size, day), extra || {});
    handled('r-nextday', onDay(-8, 17, 20), onDay(-7, 9, 5), { assistant: 'Tariq', stops: [stop('2120', '1611')], profile: p('2 Bed', -8) });   // Finish tapped the next morning: no length
    handled('r-long', onDay(-8, 11, 0), onDay(-8, 13, 20), { assistant: 'Jun', stops: [stop('2230', '4201'), stop('2110', '3801')], profile: p('3 Bed', -8) });   // 2 h 20 min: left out
    handled('r-tap1', onDay(-7, 15, 0), plus(onDay(-7, 15, 0), 3), { assistant: 'Rosa', stops: [stop('2050', '506')], profile: p('Studio', -7) });   // Start and Finish tapped together after the tour
    handled('r-tap2', onDay(-7, 16, 40), plus(onDay(-7, 16, 40), 1), { assistant: 'Nadia', stops: [stop('2040', '1207')], profile: p('1 Bed', -7) });
    handled('r-tap3', onDay(-15, 12, 30), plus(onDay(-15, 12, 30), 4), { assistant: 'Marco', stops: [stop('2120', '308')], profile: p('Studio', -15) });
    handled('r-leftout', onDay(-7, 13, 0), onDay(-7, 14, 25), { assistant: 'Ellis', stops: [stop('2050', '2901'), stop('2040', '2608')], profile: p('2 Bed', -7),
      timeExcluded: true, timeExcludedBy: 'Morgan', timeExcludedAtIso: iso(onDay(-6, 9, 30)) });   // left out by a manager (the prospect stayed to talk)
    handled('r-setatfinish', onDay(-7, 14, 0), onDay(-7, 14, 38), { assistant: 'Tariq', stops: [stop('2230', '1509'), stop('2120', '906')], profile: p('1 Bed', -7),
      startCorrectedFromIso: iso(new Date(onDay(-7, 14, 37).getTime() + 30000)) });   // Start tapped at Finish; the iPad asked when it began (D26)
    // Concessions typed on the tour (D38): 1.5 months free on an OR unit, a credit only on a unit with no incentive
    handled('r-free15a', onDay(-9, 12, 10), onDay(-9, 12, 50), { stops: [stop('2230', '714', { free: 1.5 }), stop('2110', '411')], profile: p('Studio', -9) });
    handled('r-free15b', onDay(-2, 15, 5), onDay(-2, 15, 45), { stops: [stop('2230', '714', { free: 1.5 })], profile: p('Studio', -2) });
    handled('r-credit1', onDay(-10, 11, 0), onDay(-10, 11, 35), { stops: [stop('2050', '506', { credit: '1200' }), stop('2120', '308')], profile: p('Studio', -10),
      createdAtIso: iso(onDay(-11, 17, 30)), queuedAtIso: iso(onDay(-11, 17, 30)) });   // planned the evening before: counts as arriving at the start
    handled('r-credit2', onDay(-3, 14, 15), onDay(-3, 14, 55), { stops: [stop('2050', '506', { credit: '1200' })], profile: p('Studio', -3) });
    // A broker on an OR concession: the OP goes to the broker, so the prospect's net is the rent (D19)
    handled('r-broker', onDay(-4, 13, 30), onDay(-4, 14, 20), { broker: true, brokerLast: 'Okafor', brokerFirst: 'Lena', stops: [stop('2230', '714'), stop('2120', '906')], profile: p('Studio', -4, { beds: ['Studio', '1 Bed'] }) });
    // Prices that don't count as a top price: typed wrong ($450, $46,000) or "budget flexible"
    handled('r-typo1', onDay(-12, 12, 0), onDay(-12, 12, 40), { stops: [stop('2050', '1812')], profile: p('1 Bed', -12, { priceMax: 450 }) });
    handled('r-typo2', onDay(-19, 15, 0), onDay(-19, 15, 30), { stops: [stop('2110', '2305')], profile: p('2 Bed', -19, { priceMax: 46000 }) });
    handled('r-flex1', onDay(-5, 11, 20), onDay(-5, 12, 5), { stops: [stop('2040', '2608'), stop('2050', '2901')], profile: p('2 Bed', -5, { priceMin: null, priceMax: null, priceFlexible: true }) });
    handled('r-flex2', onDay(-16, 16, 10), onDay(-16, 16, 45), { stops: [stop('2230', '3107')], profile: p('2 Bed', -16, { priceMin: null, priceMax: null, priceFlexible: true }) });
    // A move-in ten months out, on a tour older than the Desk's 30 days (so it doesn't become a Future Move-Ins lead here)
    handled('r-faroff', onDay(-33, 14, 0), onDay(-33, 14, 45), { stops: [stop('2230', '4201')], profile: p('3 Bed', -33, { moveIn: ymd(onDay(-33 + 300, 12)), flexible: false }) });
  }
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
    { name: 'Marco', score: 21, total: 30, pct: 70, passed: false, dateIso: at(-2, '16:15'), missed: [{ category: 'Requirements', q: 'Application fee?', chosen: '$50 per person', correct: '$20 per person' }, { category: 'Buildings', q: 'Which building has no gym?', chosen: '2120', correct: '2040' }, { category: 'Requirements', q: 'Tenant income requirement?', chosen: '40× monthly rent', correct: '45× monthly rent' }, { category: 'Sign-in', q: 'True or false: when signing in a prospective resident, you ask them to fill in only their email address and hand the iPad back to you.', chosen: 'False', correct: 'True' }] },
    { name: 'Ellis', score: 26, total: 30, pct: 87, passed: true, dateIso: at(-3, '11:05'), missed: [{ category: 'Lounges', q: 'Which weekends can the lounge be reserved?', chosen: '1st and 3rd', correct: '2nd and 4th' }] },
    { name: 'Jun', score: 30, total: 30, pct: 100, passed: true, dateIso: at(-5, '10:30'), missed: [] },
    { name: 'Tariq', score: 24, total: 30, pct: 80, passed: true, dateIso: at(-8, '14:00'), missed: [{ category: 'Broker quoting', q: 'No broker: what do you quote?', chosen: 'Free month or OP', correct: 'Prospect incentive only, never mention OP' }] },
    // Earlier attempts, so Reports' quiz pass rate covers every week of the period
    ...[[-10, 'Nadia', 27], [-12, 'Marco', 25], [-15, 'Rosa', 22], [-17, 'Ellis', 29], [-20, 'Jun', 23], [-23, 'Nadia', 26], [-26, 'Tariq', 30], [-29, 'Marco', 20], [-33, 'Rosa', 28], [-38, 'Ellis', 24]].map(([day, name, score]) => {
      const misses = [{ category: 'Requirements', q: 'Guarantor income requirement?', chosen: '45× monthly rent', correct: '75× monthly rent' }, { category: 'Broker quoting', q: 'Broker + OR concession: who gets what?', chosen: 'Net effective to prospect and OP to broker', correct: 'OP to broker; net only if the broker waives' },
        { category: 'Lounges', q: 'Which weekends can the lounge be reserved?', chosen: '1st and 3rd', correct: '2nd and 4th' }, { category: 'Requirements', q: 'Application fee?', chosen: '$50 per person', correct: '$20 per person' }];
      const pct = Math.round(100 * score / 30);
      return { name, score, total: 30, pct, passed: pct >= 80, dateIso: at(day, '10:15'), missed: misses.slice(0, Math.min(misses.length, 30 - score)) };
    })
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
  // Connection (production iPad v1.26, D44): up = the database has answered; hold = it won't after enableNetwork either (noAnswer)
  const net = window.__NET = { up: !O.noAnswer, hold: !!O.noAnswer, calls: [] };
  const fireAll = () => listeners.forEach(l => setTimeout(l.run, 0));
  net.answer = () => { net.hold = false; net.up = true; fireAll(); };
  const fire = col => listeners.filter(l => l.col === col).forEach(l => setTimeout(l.run, 0));
  const cmp = (a, op, b) => op === '>=' ? a >= b : op === '<=' ? a <= b : op === '>' ? a > b : op === '<' ? a < b : op === '==' ? a === b : true;
  const docSnap = (col, id) => { const d = store[col][id]; return { id, exists: !!d, data: () => clone(d), metadata: { fromCache: !net.up } }; };
  function query(col, wh, ob, lim) {
    const run = () => {
      let rows = Object.keys(store[col]).map(id => ({ id, d: store[col][id] }));
      wh.forEach(([f, op, v]) => { rows = rows.filter(r => cmp(r.d[f], op, v)); });
      if (ob) rows.sort((a, b) => (a.d[ob[0]] || '') < (b.d[ob[0]] || '') ? (ob[1] === 'desc' ? 1 : -1) : (ob[1] === 'desc' ? -1 : 1));
      if (lim) rows = rows.slice(0, lim);
      const docs = rows.map(r => ({ id: r.id, data: () => clone(r.d) }));
      return { size: docs.length, docs, forEach: fn => docs.forEach(fn), metadata: { fromCache: !net.up } };
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
  const db = { enablePersistence: () => Promise.resolve(), collection: name => { store[name] = store[name] || {}; return query(name, [], null, 0); },
    disableNetwork() { net.calls.push('disable'); net.up = false; fireAll(); return Promise.resolve(); },
    enableNetwork() { net.calls.push('enable'); net.up = !net.hold; fireAll(); return Promise.resolve(); } };
  const firestore = () => db; firestore.FieldValue = { serverTimestamp: () => 'ts' };
  window.firebase = { apps: [1], initializeApp() {}, firestore };
})();
