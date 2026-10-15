// Invented showsheet units in the demo's shape, and the two ways the apps turn a unit into a quote.
import { quoteLines, resolveConcession, savedQuoteFields } from '../../apps/shared/pricing.js';
import { selectionFromStop } from '../../apps/desk/js/rules/tour-selection.js';

// Net effective as the showsheet gives it: rent × (term − free months) ÷ term, rounded. Credits are never in it (D19).
export const OR_UNIT = { building: '2050 Tidemark Blvd', unit: '1812', type: '1 Bed, 1 Bath W/D', monthly: 4150, netEff: 3804, incentive: '1 Month Free OR 1 Mo. OP' };
export const AND_UNIT = { building: '2230 Tidemark Blvd', unit: '714', type: 'Studio, 1 Bath', monthly: 6450, netEff: 5913, incentive: '1 Month Free and 1/2 Mo. OP' };
export const FREE_ONLY_UNIT = { building: '2120 Tidemark Blvd', unit: '905', type: '1 Bed, 1 Bath', monthly: 4150, netEff: 3804, incentive: '1 Month Free' };
export const OP_ONLY_UNIT = { building: '2040 Tidemark Blvd', unit: '1102', type: '1 Bed, 1 Bath', monthly: 4150, netEff: '', incentive: '1 Mo. OP' };
export const NO_INCENTIVE_UNIT = { building: '2040 Tidemark Blvd', unit: '310', type: 'Studio, 1 Bath', monthly: 3600, netEff: '', incentive: 'No Incentive' };
export const LONG_LEASE_UNIT = { building: '2110 Tidemark Blvd', unit: '2903', type: '2 Bed, 2 Bath', monthly: 8950, netEff: 8204, incentive: '2 Months Free on 24-Month Lease' };
export const MIXED_UNIT = { building: '2050 Tidemark Blvd', unit: '2203', type: '1 Bed, 1 Bath W/D Balc', monthly: 4150, netEff: 3804, incentive: '1 Month Free and $500 Credit OR 1 Mo. OP' };

// The Desk email for one unit: the tour's stop as the iPad saves it (the unit, any per-tour overrides, and the iPad's
// opMode and term) loaded into the Email Builder, then any changes made at the Desk (checkboxes, "Other concession").
// Returns { text, netEff } as the email shows them.
export function deskEmail(unit, { broker = false, stop = {}, edit = {} } = {}) {
  const ipadStop = { ...unit, ...stop };
  const st = { ...ipadStop, ...savedQuoteFields(ipadStop) };
  const selected = { ...selectionFromStop(st, unit, { broker, floorPlans: {}, now: 0 }), ...edit };
  return resolveConcession(selected);
}

// The iPad's quote for one stop: the showsheet unit plus any per-tour overrides (free, op, credit, rent)
export const ipadQuote = (unit, { broker = false, stop = {} } = {}) => quoteLines({ ...unit, ...stop }, broker);
