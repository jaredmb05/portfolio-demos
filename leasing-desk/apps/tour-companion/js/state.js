// Variables that several modules change, or that the HTML's inline handlers assign by name.

export const state = {
  filter: 'all',
  toursDown: false,   // today's tours failed to load: rotation and the walk-in wait would show made-up zeros
  managerUnlocked: false,
  tour: { id: null, active: false, kind: 'tour', assistant: '', prospect: '', broker: false, brokerLast: '', brokerFirst: '', stops: [], createdAtIso: null, startedAtIso: null },
  queueRows: [],
  savePending: false,
  pickFilter: 'all',
};
