// What a unit with an available date is doing until then (production Desk v1.26 / iPad v1.23, D30): occupied, or vacant
// and being renovated. The Desk reads it from the showsheet's NOTES (rules/showsheet-parse.js) and publishes only the code
// ('occupied' | 'reno'), never the note. Labels for the unit lists and the iPad's picker and summary; never in emails.
export const availStatusLabel = code => code === 'occupied' ? 'Occupied' : code === 'reno' ? 'Currently Undergoing Renovation' : '';
export function availStatusFlag(u) { const l = availStatusLabel(u && u.availStatus); return l ? `<span class="flag">${l}</span>` : ''; }
