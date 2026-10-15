// How a saved tour's stop becomes a selected unit in the Email Builder: rent, concession and broker defaults.
// st: the tour's stop · live: the same unit on today's showsheet, if it's there · broker: the tour has a broker
import { leaseTerm } from '../../../shared/pricing.js';
import { fpKey, normUnit, unitSelectKey } from '../units.js';

// A unit's broker checkboxes for an email to a prospect (broker false) or to a broker (true). The "Sending to a broker" switch,
// a tour's broker flag and a unit added by hand all start here; "OP only" applies to OR offers (D19).
export function brokerDefaults(u, broker) {
  const inc = String(u.incentive || '').trim(), hasInc = !!inc && !/^no incentive/i.test(inc), hasOr = /\bor\b/i.test(inc);
  return { noBroker: !broker, opOnly: !!broker, showNetEff: hasInc && !!u.netEff && !(broker && hasOr) };
}

export function selectionFromStop(st, live, { broker, floorPlans, now }) {
  const base = live || st;
  const key = live ? unitSelectKey(live) : 'custom-' + now + '-' + normUnit(st.unit);
  const free = parseFloat(st.free) || 0, op = parseFloat(st.op) || 0, credit = parseFloat(String(st.credit||'').replace(/[^0-9.]/g,'')) || 0;
  const rentOverride = parseFloat(String(st.rent||'').replace(/[^0-9.]/g,'')) || 0;
  const d = brokerDefaults(base, broker);
  return {
    key, custom: !live,
    building: base.building, unit: String(base.unit), type: base.type || '', sqft: base.sqft || '', view: base.view || '',
    monthly: rentOverride ? String(Math.round(rentOverride)) : String(base.monthly || ''),
    avail: base.avail || 'Immediately',
    netEff: rentOverride ? '' : (base.netEff || ''), incentive: base.incentive || '',
    showNetEff: d.showNetEff && !rentOverride,   // only an OR offer to a broker hides it, until they waive (D19)
    opOnly: d.opOnly,   // an override doesn't waive the OP; the Desk unticks this when the broker does (D19)
    noBroker: d.noBroker,
    collapsed: true,
    addFloorPlan: true, notes: st.notes || '',
    floorPlan: floorPlans[fpKey(live ? live.building : st.building, live ? live.unit : st.unit)] || '', autoLinked: !!floorPlans[fpKey(live ? live.building : st.building, live ? live.unit : st.unit)],
    otherConc: !!(free || op || credit),
    otherFree: free, otherTerm: parseInt(st.term, 10) || leaseTerm(base.incentive),
    otherOp: op, otherOpMode: st.opMode === 'and' ? 'and' : 'or',
    otherCredit: credit ? String(credit) : '', otherCreditLabel: 'one-time credit'
  };
}
