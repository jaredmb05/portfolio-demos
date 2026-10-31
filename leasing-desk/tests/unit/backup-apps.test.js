// An orange unit cell on the showsheet = "Backup apps welcome" (production Desk v1.35 / iPad v1.29, D49): an application is in but
// likely won't go through, so the unit stays on the market. Reading the fill, the parsed unit, and the email's one neutral line.
import { describe, expect, it } from 'vitest';
import { BACKUP_LINE, backupAppsLine } from '../../apps/desk/js/rules/backup-apps.js';
import { liveStatus, reportModel } from '../../apps/desk/js/rules/reports.js';
import { parseShowsheetRows, unitCellFill } from '../../apps/desk/js/rules/showsheet-parse.js';

// A unit-number cell as SheetJS returns it with cellStyles on
const filled = (rgb, where = 'fgColor') => ({ v: 1207, s: { patternType: 'solid', [where]: { rgb } } });

describe('the unit cell\'s fill', () => {
  it('red FF0000 is App pending; orange FFC000 is Backup apps welcome', () => {
    expect([unitCellFill(filled('FF0000')), unitCellFill(filled('FFC000'))]).toEqual(['red', 'orange']);
  });
  it('8-digit ARGB from some writers ("FFFFC000"), lower case, or the color in bgColor or a nested fill: the same', () => {
    expect([unitCellFill(filled('FFFFC000')), unitCellFill(filled('ffc000')), unitCellFill(filled('FFC000', 'bgColor')), unitCellFill({ s: { fill: { fgColor: { argb: 'FFFFC000' } } } })])
      .toEqual(['orange', 'orange', 'orange', 'orange']);
  });
  it('a theme orange (Excel\'s "Gold, Accent 4") comes back from the library as the same FFC000, with its theme number', () => {
    expect(unitCellFill({ s: { fgColor: { theme: 7, rgb: 'FFC000' } } })).toBe('orange');
  });
  it('another shade of orange, yellow, no fill or no cell: nothing', () => {
    expect([unitCellFill(filled('FFA500')), unitCellFill(filled('FFFF00')), unitCellFill({ v: 1, s: {} }), unitCellFill({ v: 1 }), unitCellFill(undefined)]).toEqual(['', '', '', '', '']);
  });
});

describe('the parsed showsheet', () => {
  const rows = [
    ['2040 TIDEMARK BLVD'], ['1 BEDROOMS'], ['UNIT', 'TYPE', 'VIEW', 'SQ FT', 'AVAIL', 'NOTES', 'MONTHLY', 'NET EFF', 'INCENTIVE'],
    [1101, '1 Bed, 1 Bath', 'Courtyard', 680, '', '', 3700, 3392, '1 Month Free OR 1 Mo. OP'],   // red
    [1102, '1 Bed, 1 Bath', 'Courtyard', 680, '', '', 3725, 3415, '1 Month Free OR 1 Mo. OP'],   // no fill
    [1103, '1 Bed, 1 Bath', 'Harbor', 700, '', '$75 gift card. 12/15 deadline', 3850, 3529, '1 Month Free OR 1 Mo. OP'],   // orange (a yellow notes cell doesn't matter)
  ];
  const units = parseShowsheetRows(rows, new Set([3]), new Date('2026-10-06T12:00:00'), new Set([5]));
  const unit = n => units.find(u => u.unit === n);
  it('an orange unit is backupApps, and never hasApp: it stays on the market', () => {
    expect(unit('1103')).toMatchObject({ hasApp: false, backupApps: true });
  });
  it('red is still App pending; a unit with neither has no backupApps field at all', () => {
    expect(unit('1101')).toMatchObject({ hasApp: true }); expect('backupApps' in unit('1101')).toBe(false);
    expect('backupApps' in unit('1102')).toBe(false);
  });
  it('without orange rows (as before) nothing is marked', () => {
    expect(parseShowsheetRows(rows, new Set()).some(u => u.backupApps)).toBe(false);
  });
});

describe('Reports: still on the market', () => {
  it('status today says "Backup apps welcome", and the unit counts as available now (App pending doesn\'t)', () => {
    const U = (unit, extra) => ({ building: '2040 TIDEMARK BLVD', bedroomGroup: '1 BEDROOMS', unit, type: '1 Bed, 1 Bath', monthly: 3750, netEff: null, incentive: 'No Incentive', avail: 'Immediately', ...extra });
    expect(liveStatus(U('1207', { backupApps: true }))).toBe('Backup apps welcome');
    const m = reportModel({ tours: [], units: [U('1207', { backupApps: true }), U('1208', { hasApp: true }), U('1209')], quiz: [], weeks: 1, now: new Date('2026-10-06T14:10:00') });
    expect(m.availNow['1 Bed']).toBe(2);
  });
});

describe('the email line (Tour and Inquiry Follow-Up)', () => {
  const units = [{ building: '2040 TIDEMARK BLVD', unit: '1207', backupApps: true }, { building: '2050 TIDEMARK BLVD', unit: '1812' }];
  const P = `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><em>${BACKUP_LINE}</em></p>`;
  it('an orange apartment on today\'s showsheet: the one neutral line, in the email\'s own <p> style', () => {
    expect(backupAppsLine({ key: '2040 TIDEMARK BLVD::1207' }, units)).toBe(P);
    expect(BACKUP_LINE).toBe("An application is in progress on this apartment; we're happy to take a backup application.");
  });
  it('it follows today\'s showsheet: gone when the orange comes off, or when the unit is no longer on it', () => {
    expect(backupAppsLine({ key: '2040 TIDEMARK BLVD::1207' }, [{ building: '2040 TIDEMARK BLVD', unit: '1207' }])).toBe('');
    expect(backupAppsLine({ key: '2040 TIDEMARK BLVD::1207' }, [])).toBe('');
  });
  it('no line for another apartment, or one typed in by hand (even with the same number)', () => {
    expect(backupAppsLine({ key: '2050 TIDEMARK BLVD::1812' }, units)).toBe('');
    expect(backupAppsLine({ key: '2040 TIDEMARK BLVD::1207', custom: true }, units)).toBe('');
  });
  it('never the word "weak"', () => { expect(/weak/i.test(P)).toBe(false); });
});
