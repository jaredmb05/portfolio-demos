// Variables that several modules change, or that the HTML's inline handlers assign by name.

export const state = {
  units: [],
  ssMeta: null,   // showsheet metadata (filename, loadedAt)
  selectedUnits: [],
  floorPlans: {},
  fpMeta: null,
  emailBroker: false,   // the Email Builder's "Sending to a broker" switch
  emailMode: 'tour',   // 'tour' | 'inquiry' | 'welcome' | 'pfa'
  includeParking: false,
  includeShuttle: false,
  welcomeBuilding: '2050',   // currently selected welcome building
  adoptingPublish: false,
  activeTour: null,
  trainingUnlocked: false,
  historyQ: '',
  historyWho: '',
  historyKind: '',
  lastRowMoveAt: 0,
  flFormOpen: false,
  apvConcMonthTouched: false,
  apvCreditMonthTouched: false,
  pfaRentManual: false,   // true once the user types the fee directly (stops hours auto-fill from overwriting)
};
