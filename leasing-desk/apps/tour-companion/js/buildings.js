// Building facts, staff directory and talking points (demo data).

export const BUILDING_ORDER = ['2050','2230','2120','2040','2110'];
export const BUILDING_NOTES = { '2050': 'Amenity fee $40/mo', '2110': 'Incentive applied to last month' };

// ---------- Building info (from the leasing cheat sheet; parking + shuttle from the toolkit) ----------
export const BUILDING_INFO = {
  '2050': { opened: 'May 2016', layouts: 'Studio, 1, 2, 3 · studio home office · 1BR supreme (W/D) · 1BR home office', units: '640 units · 38 floors · dual elevators',
    outdoor: ['7th floor — 40,000 sq ft', 'Indoor/outdoor playground, 2 tennis courts ($20/hr), fitness center, bocce court, BBQ grills, lawn, cabanas', 'Hours: Sun 8–10, Mon–Thu 7–10, Fri–Sat 8–11:30'],
    gym: '7th floor — largest · 24 hrs', lounge: '7th floor — $180/hr, $400 deposit, 2–4 hrs, max 40 people · Mon–Thu and 2nd & 4th weekends, no holidays', laundry: 'Every floor · in-unit W/D in 2/2 & 3BR · main room 6th floor', extra: 'Amenity fee $40/mo · 1 free bike storage spot' },
  '2120': { opened: 'March 2015', layouts: 'Studio, 1, 2', units: '288 units · 35 floors', outdoor: ['None'], gym: '2nd floor — smallest · 24 hrs', lounge: 'None', laundry: '5th floor · in-unit W/D in 2/2' },
  '2040': { opened: 'July 2015', layouts: 'Studio, 1, 2', units: '276 units · 30 floors', outdoor: ['2nd floor — quaint industrial patio, slightly obstructed', 'Open 8 AM – 10 PM'], gym: 'None', lounge: 'None', laundry: '2nd floor · in-unit W/D in 2/2', extra: 'The Harbor Ferry stop is next door' },
  '2110': { opened: 'April 2018', layouts: 'Studio, 1, 2, 3 · studio alcove', units: '512 units · 24 floors', outdoor: ['1st floor — enclosed park near the old harbor crane, with work stations', '8th floor — very small "landscape terrace," next to the lounge'], gym: '7th floor — nice view · 24 hrs', lounge: '8th floor — seating only, next to the outdoor space', laundry: '7th floor · in-unit W/D in 2/2 & 3BR', extra: 'Incentives are applied to the last month of the lease · lobby & common areas by a hospitality design studio' },
  '2230': { opened: 'July 2009', layouts: 'Studio, 1, 2*, 3 · studio alcove', units: '420 units · 31 floors · dual elevators', outdoor: ['1st floor — enclosed park; indoor play area on the 2nd floor', '11th floor — very large industrial patio, sectioned off', 'Open 10 AM – 10 PM'], gym: '1st floor — nice view · 24 hrs', lounge: '1st floor — $120/hr, $400 deposit, 2–4 hrs, max 40 people · Mon–Thu and 2nd & 4th weekends, no holidays', laundry: 'Every floor · in-unit W/D in 3BR · 2nd floor*', extra: 'Citywide Fiber available' }
};
export const TALKING_POINTS = `
  <h4>Utilities</h4><ul><li>Included: heat (gas source with electric fan), gas, water</li><li>Not included: electricity (incl. A/C), internet, cable</li></ul>
  <h4>Internet providers</h4><ul><li>All buildings: Metro Cable and Bluewave Internet</li><li>2040 and 2110: also Brightline Fiber (2 months free with code LARK23)</li><li>2120: also Brightline Fiber (2 months free with code LARK24)</li><li>2230: also Citywide Fiber</li></ul>
  <h4>Apartments</h4><ul><li>Standard ceilings 8.5 ft</li><li>Double-pane / thermal glass</li><li>Square footage does not include outdoor space</li></ul>
  <h4>Vouchers &amp; guarantors</h4><ul><li>We participate in all voucher programs (NYCHA, HPD, CityFHEPS and others)</li><li>Third-party guarantors are accepted — refer the prospect to the agent for qualifying criteria</li></ul>
  <h4>Pets</h4><ul><li>2 pets up to 60 lbs combined (non-aggressive breeds); no pet fee. Photos and breed names go to the property manager.</li></ul>
  <h4>Lounge rentals (private functions)</h4><ul><li>2050 lounge $180/hr · 2230 lounge $120/hr · $400 deposit · 2–4 hours · max 40 people</li><li>Reservable Monday–Thursday and on the 2nd and 4th weekends of the month · no holidays</li></ul>
  <h4>Services</h4><ul><li>Dry cleaning pick-up/drop-off and wash-and-fold at every building — sign up in 2050 or 2230</li><li>Storage: 1 free bike spot at 2050; a self-storage partner nearby gives residents a discount; no cold storage at front desks</li></ul>
  <h4>Parking (garage attached to 2050 — managed by a third party)</h4><ul><li>Resident pricing: unreserved sedan $250 · unreserved SUV $350 · reserved sedan $450 · reserved SUV $550</li><li>Rates are a guide; final pricing and vehicle class set by garage management. Residents visit the garage in person for resident pricing. Garage: 332-555-0160</li></ul>
  <h4>Shuttle to the subway</h4><ul><li>Pick up at 2040 and 2230 about every 20 min: 6:30–10:30 AM (extra shuttles 7:30–9 AM) and 4:30–8:30 PM Mon–Fri; 9 AM–1 PM and 2–6:30 PM weekends and holidays</li><li>To/from the Harbor Street subway station, one stop from Midtown</li><li>Real-time tracking in the shuttle app</li></ul>
  <h4>Subway</h4><ul><li>Harbor Line — Harbor Street (Harbor St & 3rd Ave), 7 blocks; Pier Street (Pier St & 1st Ave), 8 blocks</li><li>Crosstown Line — Market Square (Market Sq & Foundry Ave), 7 blocks; 9th St (9th St & Foundry Ave), 6 blocks</li><li>Express Line — Market Square/10th St (10th St & Canal Dr), 7 blocks</li></ul>
  <h4>Harbor Ferry</h4><ul><li>Tidemark Landing stop (next to 2040) → Midtown, Downtown and more</li><li>Harbor Point South stop (south of Waterfront Park) → Crosstown</li><li>North Pier stop → Midtown and Downtown</li></ul>
  <h4>Landmark</h4><ul><li>The old harbor crane (1931, 90 ft) was restored when the waterfront park opened</li></ul>`;


// ---------- Staff directory (from the front-desk contact sheets) ----------
export const STAFF = {
  '2050': { ls: 'Renee Okafor', bm: 'Samir Haddad', bmNote: 'Kofi Mensah (Asst. BM)', desk: '(718) 555-0150' },
  '2120': { ls: 'Renee Okafor', bm: 'Gregory Tan', desk: '(718) 555-0120' },
  '2040': { ls: 'Renee Okafor', bm: 'Victor Lindqvist', desk: '(718) 555-0140' },
  '2110': { ls: 'Helena Brandt', bm: 'Rafael Ortiz', desk: '(718) 555-0111' },
  '2230': { ls: 'Helena Brandt', bm: 'Pavel Novak', desk: '(718) 555-0123' }
};
export const STAFF_ALL = [
  ['Property Management (all buildings)', 'Diane Whitlock'],
  ['Resident Services Specialist', 'Tamsin Reyes'],
  ['Construction Manager', 'Ilya Petrov'],
  ['Billing & Accounts', 'billing@example.com'],
  ['Larkspur Residential leasing office', '(718) 555-0100'],
  ['Larkspur Residential main office', '(212) 555-0101']
];
export const ROLE_RULES = [
  ['Lease renewals', 'Leasing Specialist for that building'],
  ['Installing something in the apartment (mounting, fixtures, alterations)', 'Building Manager'],
  ['Repairs and building operations', 'Building Manager'],
  ['Move-in scheduling and resident questions after signing', 'Resident Services Specialist'],
  ['Billing questions', 'Billing & Accounts'],
];
