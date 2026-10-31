// Builds <out>/fixture_fills.xlsx: a small showsheet with real cell fills, stored the way Excel stores them, to test the colors
// the Desk reads from the unit-number cell (column B; production D49): red FF0000 = App pending; orange FFC000 = an application
// that likely won't go through, "Backup apps welcome", once as a standard color and once as a theme color (Gold, Accent 4); a
// yellow NOTES cell on an orange row changes nothing. Invented building row, units and prices.
// SheetJS can't write fills, so the workbook is written plain and its styles, theme and sheet XML are patched in the zip.
//   node tests/fixture_fills.cjs <out-folder>
const XLSX = require('xlsx'), fs = require('fs'), out = process.argv[2];
const aoa = [
  [null, '2120 TIDEMARK BLVD'],
  [null, '1 BEDROOMS'],
  [null, 'UNIT', 'TYPE', 'VIEW', 'SQ FT', 'AVAIL', 'NOTES', 'MONTHLY', 'NET EFF', 'INCENTIVE'],
  [null, 1101, '1 Bed, 1 Bath', 'Tidemark Blvd', 680, '', '', 3700, 3392, '1 Month Free OR 1 Mo. OP'],   // row 4: unit cell red
  [null, 1102, '1 Bed, 1 Bath', 'Tidemark Blvd', 680, '', '', 3725, 3415, '1 Month Free OR 1 Mo. OP'],   // row 5: no fill
  [null, 1103, '1 Bed, 1 Bath, Corner', 'Partial Manhattan Skyline, River', 715, '', '$75 gift card. 12/15 deadline', 3950, 3621, '1 Month Free OR 1 Mo. OP'],   // row 6: whole row orange, NOTES yellow
  [null, 1104, '1 Bed, 1 Bath', 'Tidemark Harbor', 690, '', '', 3800, 3483, '1 Month Free OR 1 Mo. OP'],   // row 7: unit cell orange from the theme
];
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Inventory');
const cfb = XLSX.CFB.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
const part = p => XLSX.CFB.find(cfb, '/' + p), text = p => Buffer.from(part(p).content).toString('utf8');   // the lookup needs the leading slash
const themePath = 'xl/theme/theme1.xml', sheetPath = 'xl/worksheets/sheet1.xml';
const orig = { styles: text('xl/styles.xml'), theme: text(themePath), sheet: text(sheetPath) };   // read everything before changing the zip
const put = (p, s) => { const f = part(p); f.content = Buffer.from(s, 'utf8'); f.size = f.content.length; };
const solid = c => `<fill><patternFill patternType="solid"><fgColor ${c}/><bgColor indexed="64"/></patternFill></fill>`;
// fills 2–5: red, orange, yellow (standard colors, ARGB) and orange from theme index 7 (accent4); styles 1–4 use them
put('xl/styles.xml', orig.styles
  .replace(/<fills count="\d+">([\s\S]*?)<\/fills>/, (m, inner) => `<fills count="6">${inner}${solid('rgb="FFFF0000"')}${solid('rgb="FFFFC000"')}${solid('rgb="FFFFFF00"')}${solid('theme="7"')}</fills>`)
  .replace(/<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/, (m, inner) => `<cellXfs count="5">${inner}` +
    [2, 3, 4, 5].map(f => `<xf numFmtId="0" fontId="0" fillId="${f}" borderId="0" xfId="0" applyFill="1"/>`).join('') + '</cellXfs>'));
// the theme's accent4 is Office's "Gold" (FFC000), as in Excel 2013 and later
put(themePath, orig.theme.replace(/<a:accent4>[\s\S]*?<\/a:accent4>/, '<a:accent4><a:srgbClr val="FFC000"/></a:accent4>'));
// red unit cell on row 4; orange on every cell of row 6 except NOTES (G6, yellow); theme orange on the unit cell of row 7
const styleOf = { B4: 1, G6: 3, B7: 4 }; 'BCDEFHIJ'.split('').forEach(col => { styleOf[col + '6'] = 2; });
put(sheetPath, orig.sheet.replace(/<c r="([A-Z]+\d+)"/g, (m, ref) => styleOf[ref] ? `<c r="${ref}" s="${styleOf[ref]}"` : m));
fs.writeFileSync(out + '/fixture_fills.xlsx', XLSX.CFB.write(cfb, { type: 'buffer', fileType: 'zip' }));
// Self-check: read it back the way the Desk does and print the unit cells' fill colors
const ws = XLSX.read(fs.readFileSync(out + '/fixture_fills.xlsx'), { type: 'buffer', cellStyles: true }).Sheets.Inventory;
console.log('fixture_fills.xlsx: ' + ['B4', 'B5', 'B6', 'G6', 'B7'].map(r => `${r}=${ws[r] && ws[r].s && ws[r].s.fgColor ? ws[r].s.fgColor.rgb : '-'}`).join(' '));
