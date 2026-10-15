// Reading the daily showsheet and the floor plan master, from rows as SheetJS returns them.
import { describe, expect, it } from 'vitest';
import { parseFloorPlanRows, parseShowsheetRows } from '../../apps/desk/js/rules/showsheet-parse.js';

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
