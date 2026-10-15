// Fake Firebase for tests/future_flows.js: four tours around the 45-day Future Move-Ins rule, and an in-memory
// future_leads collection (window.__LEADS) whose listeners re-fire on every write. Dates are relative to "now".
(function () {
  const now = Date.now();
  const iso = ms => new Date(ms).toISOString();
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const tours = {
    far: { id: 'far', kind: 'tour', assistant: 'Rosa', prospect: 'Karen M.', createdAtIso: iso(now - 864e5), updatedAtIso: iso(now - 864e5), startedAtIso: iso(now - 864e5), finishedAtIso: iso(now - 864e5 + 3600e3), stops: [{ unit: '2903' }, { unit: '505' }], profile: { beds: ['1 Bed'], priceMin: 3500, priceMax: 4000, moveIn: inDays(120), mustHaves: 'W/D' } },
    near: { id: 'near', kind: 'tour', assistant: 'Jun', prospect: 'Lee B.', createdAtIso: iso(now), updatedAtIso: iso(now), startedAtIso: iso(now), stops: [], profile: { beds: ['Studio'], moveIn: inDays(20) } },
    insp: { id: 'insp', kind: 'inspection', assistant: 'Jun', prospect: 'Res', createdAtIso: iso(now), updatedAtIso: iso(now), startedAtIso: iso(now), stops: [], profile: { moveIn: inDays(200) } },
    soon: { id: 'soon', kind: 'tour', assistant: 'Nadia', prospect: 'Ana P.', createdAtIso: iso(now - 50 * 864e5 + 1), updatedAtIso: iso(now), startedAtIso: iso(now - 50 * 864e5), stops: [], profile: { beds: ['2 Bed'], moveIn: inDays(10) } },
  };
  const leads = window.__LEADS = {};
  const listeners = [];
  const notify = () => setTimeout(() => listeners.forEach(cb => cb({ forEach(f) { Object.values(leads).forEach(x => f({ data: () => JSON.parse(JSON.stringify(x)) })); } })), 0);
  const col = name => ({
    doc(id) {
      return {
        onSnapshot(o, cb) { if (typeof o === 'function') cb = o; cb({ exists: false, metadata: { fromCache: false } }); },
        get: () => Promise.resolve({ exists: false }),
        set(d, o) { if (name === 'future_leads') { leads[id] = Object.assign({}, o && o.merge ? leads[id] || {} : {}, JSON.parse(JSON.stringify(d))); notify(); } return Promise.resolve(); },
        delete() { if (name === 'future_leads') { delete leads[id]; notify(); } return Promise.resolve(); },
      };
    },
    onSnapshot(cb) { if (name === 'future_leads') { listeners.push(cb); notify(); } },
    where() { return { orderBy() { return { limit() { return { onSnapshot(cb) { cb({ forEach(f) { Object.values(tours).forEach(x => f({ data: () => x })); } }); }, get: () => Promise.resolve({ forEach() {} }) }; } }; } }; },
  });
  const firestore = () => ({ enablePersistence: () => Promise.resolve(), collection: col });
  firestore.FieldValue = { serverTimestamp: () => 'ts' };
  window.firebase = { initializeApp() {}, apps: [1], firestore };
})();
