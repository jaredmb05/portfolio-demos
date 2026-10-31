// Reading the daily showsheet and the floor plan master, from rows as SheetJS returns them.
import { describe, expect, it } from 'vitest';
import { parseFloorPlanRows, parseShowsheetRows } from '../../apps/desk/js/rules/showsheet-parse.js';
import { availStatusFlag, availStatusLabel } from '../../apps/shared/avail-status.js';

const HEADER = ['UNIT', 'TYPE', 'VIEW', 'SQ FT', 'AVAIL', 'NOTES', 'MONTHLY', 'NET EFF', 'INCENTIVE'];
const NOV_10_2026 = 46336;   // Excel serial date (days since Dec 30, 1899)

describe('showsheet', () => {
  const rows = [
    ['2050 TIDEMARK BLVD • 18 units'],
    ['1 BEDROOMS'],
    HEADER,
    [1812, '1 Bed, 1 Bath W/D', 'River', 712, '', '', 4150, 3804, '1 Month Free OR 1 Mo. OP'],
    [2203, '1 Bed, 1 Bath W/D Balc', 'River', 745, NOV_10_2026, '', 4495, 4120, '1 Month Free OR 1 Mo. OP'],
    [2204, '1 Bed, 1 Bath', 'Courtyard', 690, '', 'Occupied', 3995, 3662, '1 Month Free OR 1 Mo. OP'],
    [2205, '1 Bed, 1 Bath', 'Courtyard', 690, 'PRIORITY', '', 3995, 3662, 'No Incentive'],
    ['2 BEDROOMS'],
    ['2501', '2 Bed, 2 Bath', 'River', 1050, new Date(Date.UTC(2026, 10, 10)), '', 6250, 5729, NOV_10_2026],
    ['2230 TIDEMARK BLVD'],
    ['STUDIOS'],
    [714, 'Studio, 1 Bath', 'Harbor', 480, '', '', 3195, 2929, '1 Month Free OR 1 Mo. OP'],
  ];
  const units = parseShowsheetRows(rows, new Set([4]));
  const unit = n => units.find(u => u.unit === n);

  it('reads each unit under its building and bedroom group, dropping the notes after "•" in the building name', () => {
    expect(unit('1812')).toMatchObject({ building: '2050 TIDEMARK BLVD', bedroomGroup: '1 BEDROOMS', type: '1 Bed, 1 Bath W/D', sqft: 712, monthly: 4150, netEff: 3804, incentive: '1 Month Free OR 1 Mo. OP' });
  });
  it('a blank availability means Immediately', () => {
    expect(unit('1812').avail).toBe('Immediately');
  });
  it('a blank availability with "Occupied" in the notes means Occupied, not Immediately', () => {
    expect(unit('2204').avail).toBe('Occupied');
  });
  it('an Excel date is read as that calendar date, not a day early west of UTC', () => {
    expect(unit('2203').avail).toBe('November 10, 2026');
    expect(unit('2501').avail).toBe('November 10, 2026');
  });
  it('PRIORITY marks the unit as a priority and reads as Immediately', () => {
    expect(unit('2205')).toMatchObject({ priority: true, avail: 'Immediately' });
  });
  it('a red row means an application is pending (D1)', () => {
    expect(unit('2203').hasApp).toBe(true);
    expect(unit('1812').hasApp).toBe(false);
  });
  it('a bedroom section with no header row of its own uses the building\'s columns', () => {
    expect(unit('2501')).toMatchObject({ bedroomGroup: '2 BEDROOMS', monthly: 6250 });
  });
  it('a date that lands in the incentive column is dropped', () => {
    expect(unit('2501').incentive).toBe('');
  });
  it('a new building forgets the previous building\'s columns until its own header row', () => {
    expect(unit('714')).toBeUndefined();
  });
});

// Production Desk v1.26 / iPad v1.23 (D30). The notes below are invented; each row stands for one wording rule.
describe('Occupied / Currently Undergoing Renovation, from NOTES on a unit with an available date', () => {
  const DEC_1_2026 = 46357;   // Excel serial date
  const notes = [
    ['3301', DEC_1_2026, 'occupied'],
    ['3302', DEC_1_2026, 'Still OCCUPIED, tenant out 11/30'],
    ['3303', DEC_1_2026, 'Tenant-occupied until the 30th'],
    ['3304', DEC_1_2026, 'in reno'],
    ['3305', DEC_1_2026, 'Reno: new floors'],
    ['3306', DEC_1_2026, 'RENOVATION'],
    ['3307', DEC_1_2026, 'Kitchen renovations underway'],
    ['3308', DEC_1_2026, 'Newly renovated'],
    ['3309', DEC_1_2026, 'Renovated last spring'],
    ['3310', DEC_1_2026, 'Unoccupied since September'],
    ['3311', DEC_1_2026, 'Occupied; reno once vacated'],
    ['3312', DEC_1_2026, 'Reno after the tenant leaves, occupied till then'],
    ['3313', DEC_1_2026, 'Great light, ask about parking'],
    ['3314', DEC_1_2026, ''],
    ['3315', '', 'OCCUPIED'],
    ['3316', '', 'Reno in progress'],
    ['3317', 'PRIORITY', 'Renovation'],
    ['3318', 'December 1', 'occupied by the owner'],
    ['3319', new Date(Date.UTC(2026, 11, 1)), 'Reno'],
  ];
  const rows = [['2120 TIDEMARK BLVD'], ['2 BEDROOMS'], HEADER].concat(notes.map(([u, avail, note]) => [u, '2 Bed, 2 Bath', 'River', 1010, avail, note, 5900, 5408, '1 Month Free OR 1 Mo. OP']));
  const units = parseShowsheetRows(rows, new Set());
  const status = n => units.find(u => u.unit === n).availStatus;

  it('a date and a note with the word "occupied" (any case, any wording): Occupied', () => {
    expect(['3301', '3302', '3303', '3318'].map(status)).toEqual(['occupied', 'occupied', 'occupied', 'occupied']);
  });
  it('a date and a note with "reno" or "renovation(s)" (any case): being renovated, so vacant', () => {
    expect(['3304', '3305', '3306', '3307', '3319'].map(status)).toEqual(['reno', 'reno', 'reno', 'reno', 'reno']);
  });
  it('"Newly renovated" (already finished) and "Unoccupied" don\'t count', () => {
    expect(['3308', '3309', '3310'].map(status)).toEqual([undefined, undefined, undefined]);
  });
  it('both words in one note: Occupied, whichever comes first', () => {
    expect(['3311', '3312'].map(status)).toEqual(['occupied', 'occupied']);
  });
  it('a date with any other note, or no note: no label (the unit is vacant)', () => {
    expect(['3313', '3314'].map(status)).toEqual([undefined, undefined]);
  });
  it('a date typed as text or an Excel date cell counts as a date', () => {
    expect(units.find(u => u.unit === '3318')).toMatchObject({ avail: 'December 1', availStatus: 'occupied' });
    expect(units.find(u => u.unit === '3319')).toMatchObject({ avail: 'December 1, 2026', availStatus: 'reno' });
  });
  it('no date: as before (an "Occupied" note → Occupied, otherwise Immediately; PRIORITY is no date), and no label', () => {
    expect(['3315', '3316', '3317'].map(n => units.find(u => u.unit === n)).map(u => [u.avail, u.availStatus])).toEqual([['Occupied', undefined], ['Immediately', undefined], ['Immediately', undefined]]);
  });
  it('a unit carries availStatus only when it has one (no empty field)', () => {
    expect(units.filter(u => 'availStatus' in u).every(u => u.availStatus === 'occupied' || u.availStatus === 'reno')).toBe(true);
    expect('availStatus' in units.find(u => u.unit === '3314')).toBe(false);
  });
  it('only the label is kept: the note text never reaches the unit the Desk publishes', () => {
    const published = JSON.stringify(units);
    notes.filter(([, , note]) => note.includes(' ')).forEach(([, , note]) => expect(published).not.toContain(note));
    const FIELDS = ['building', 'bedroomGroup', 'unit', 'type', 'sqft', 'direction', 'view', 'monthly', 'netEff', 'incentive', 'avail', 'priority', 'hasApp', 'availStatus'];
    expect(units.flatMap(u => Object.keys(u)).filter(k => !FIELDS.includes(k))).toEqual([]);
  });
  it('the label each app shows, and nothing for a vacant unit', () => {
    expect([availStatusLabel('occupied'), availStatusLabel('reno'), availStatusLabel(''), availStatusLabel(undefined)]).toEqual(['Occupied', 'Currently Undergoing Renovation', '', '']);
    expect(availStatusFlag({ availStatus: 'reno' })).toBe('<span class="flag">Currently Undergoing Renovation</span>');
    expect([availStatusFlag({}), availStatusFlag(null)]).toEqual(['', '']);
  });
});

// Production Desk v1.29 (D35): the one note that is kept. The notes below are invented.
describe('leasing assistant contest: a NOTES cell that mentions a gift card', () => {
  const OCT_6 = new Date('2026-10-06T14:10:00');
  const DEC_1_2026 = 46357;   // Excel serial date
  const notes = [
    ['3401', '', '$250 gift card, deadline 10/31'],
    ['3402', '', 'GIFT CARD $175 - ends Nov 15'],
    ['3403', '', '$250 giftcard 10/5'],
    ['3404', '', '$125 gift card'],
    ['3405', '', 'Keys at the front desk'],
    ['3406', '', ''],
    ['3407', '', 'Occupied'],
    ['3408', DEC_1_2026, 'Occupied, $150 gift card if leased by 11/20'],
    ['3409', '', '$150 gift card for a lease by 11/15. ' + 'Show the terrace first and mention the new gym. '.repeat(4)],
    ['3410', '', '  $75   Gift\n Card,  1/15  '],
  ];
  const rows = [['2040 TIDEMARK BLVD'], ['1 BEDROOMS'], HEADER].concat(notes.map(([u, avail, note]) => [u, '1 Bed, 1 Bath', 'River', 700, avail, note, 4000, 3667, '1 Month Free OR 1 Mo. OP']));
  const units = parseShowsheetRows(rows, new Set(), OCT_6);
  const unit = n => units.find(u => u.unit === n);
  const contestOf = n => [unit(n).contest, unit(n).contestUntil];

  it('the note is kept on the unit as written (any capitals, "giftcard" too), with its date as YYYY-MM-DD', () => {
    expect(contestOf('3401')).toEqual(['$250 gift card, deadline 10/31', '2026-10-31']);
    expect(contestOf('3402')).toEqual(['GIFT CARD $175 - ends Nov 15', '2026-11-15']);
    expect(contestOf('3403')).toEqual(['$250 giftcard 10/5', '2026-10-05']);
  });
  it('a gift card note with no date: the note only, no date field', () => {
    expect(unit('3404').contest).toBe('$125 gift card');
    expect('contestUntil' in unit('3404')).toBe(false);
  });
  it('any other note, or none: no contest fields at all', () => {
    ['3405', '3406', '3407'].forEach(n => { expect('contest' in unit(n)).toBe(false); expect('contestUntil' in unit(n)).toBe(false); });
  });
  it('read alongside Occupied: a date in AVAIL and a note with both keeps the label and the contest', () => {
    expect(unit('3408')).toMatchObject({ avail: 'December 1, 2026', availStatus: 'occupied', contest: 'Occupied, $150 gift card if leased by 11/20', contestUntil: '2026-11-20' });
  });
  it('a long note is cut at 120 characters; spaces and line breaks collapse to one space', () => {
    expect(unit('3409').contest).toHaveLength(120);
    expect(unit('3409').contestUntil).toBe('2026-11-15');
    expect(unit('3410').contest).toBe('$75 Gift Card, 1/15');
  });
  it('no year: the year follows the day the showsheet is read (1/15 read on Oct 6 is next January)', () => {
    expect(unit('3410').contestUntil).toBe('2027-01-15');
    const dec = parseShowsheetRows(rows, new Set(), new Date('2026-12-10T09:00:00'));
    expect(['3401', '3403'].map(n => dec.find(u => u.unit === n).contestUntil)).toEqual(['2026-10-31', '2027-10-05']);
  });
  it('every other note still stays off the unit the Desk publishes (D30)', () => {
    const published = JSON.stringify(units.filter(u => !u.contest));
    ['Keys at the front desk'].forEach(n => expect(published).not.toContain(n));
    const FIELDS = ['building', 'bedroomGroup', 'unit', 'type', 'sqft', 'direction', 'view', 'monthly', 'netEff', 'incentive', 'avail', 'priority', 'hasApp', 'availStatus', 'contest', 'contestUntil'];
    expect(units.flatMap(u => Object.keys(u)).filter(k => !FIELDS.includes(k))).toEqual([]);
  });
});

describe('floor plan master', () => {
  it('finds the building, unit and link columns by their headers and keys links by building number + unit', () => {
    const rows = [['Notes', 'Building', 'Unit', 'Floor plan link'], ['', '2050 Tidemark Blvd', 1812, 'https://example.com/fp/1812.pdf']];
    expect(parseFloorPlanRows(rows)).toEqual({ links: { '2050|1812': 'https://example.com/fp/1812.pdf' }, added: 1, skipped: 0 });
  });
  it('with no header row, columns A, B and C are building, unit and link', () => {
    expect(parseFloorPlanRows([['2230 Tidemark Blvd', '0714', 'https://example.com/fp/714.pdf']]).links).toEqual({ '2230|714': 'https://example.com/fp/714.pdf' });
  });
  it('rows with a missing value or a link that isn\'t http(s) are skipped and counted', () => {
    const rows = [['Building', 'Unit', 'Link'], ['2050 Tidemark Blvd', 1812, 'javascript:alert(1)'], ['2050 Tidemark Blvd', '', 'https://example.com/x.pdf'], ['2050 Tidemark Blvd', 2203, 'https://example.com/fp/2203.pdf']];
    expect(parseFloorPlanRows(rows)).toEqual({ links: { '2050|2203': 'https://example.com/fp/2203.pdf' }, added: 1, skipped: 2 });
  });
});
