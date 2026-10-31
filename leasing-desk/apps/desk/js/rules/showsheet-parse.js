// Reading the daily showsheet and the floor plan master from spreadsheet rows (as SheetJS returns them).
import { fpKey } from '../units.js';
import { contestDeadline, contestNote } from './contest.js';

// The fill of a unit-number cell (column B) as SheetJS reports it: 'red' = App pending, off the market (D1); 'orange' = an
// application that likely won't go through, "Backup apps welcome", still on the market (production D49); '' for anything else.
// SheetJS keeps the fill in fgColor or bgColor, sometimes nested, as 6-digit RGB ('FF0000'); some writers emit 8-digit ARGB
// ('FFFF0000'), so the alpha byte is stripped only when it's there. A theme orange (Excel's "Gold, Accent 4") comes back as the
// same FFC000. Another shade of orange isn't read.
export const RED_FILL = 'FF0000', ORANGE_FILL = 'FFC000';
export function unitCellFill(cell) {
  const s = cell && cell.s; if (!s) return '';
  const cands = [s.fgColor, s.bgColor, s.patternColor, s.fill && s.fill.fgColor, s.fill && s.fill.bgColor].filter(Boolean);
  for (const c of cands) {
    let rgb = String(c.rgb || c.argb || '').toUpperCase(); if (rgb.length === 8) rgb = rgb.slice(2);
    if (rgb === RED_FILL) return 'red';
    if (rgb === ORANGE_FILL) return 'orange';
  }
  return '';
}
// Units by building and bedroom group. redRows: row indexes with the red "app pending" fill (D1); orangeRows: the orange
// "backup apps welcome" fill (production D49). now: the day the sheet is read, which gives a contest date written without a
// year its year (D35).
export function parseShowsheetRows(rows, redRows, now = new Date(), orangeRows) {
  redRows = redRows || new Set(); orangeRows = orangeRows || new Set();
  const units = [];
  let currentBuilding = null;
  let currentBedroom = null;
  let columnMap = null;
  // Building name MUST start with a numeric address prefix (3-5 digits) to avoid
  // false-positive matches on standalone words like "DRIVE" or "PLACE" that may
  // appear in unit descriptions, view fields, etc.
  const buildingRegex = /^\d{3,5}\b.*(TIDEMARK BLVD|MARKET SQUARE|FOUNDRY AVE|BLVD|BOULEVARD|AVENUE|STREET|PLACE|DRIVE|ROAD)/i;
  const bedroomLabels = ['STUDIOS','STUDIO','1 BEDROOMS','1 BEDROOM','2 BEDROOMS','2 BEDROOM','3 BEDROOMS','3 BEDROOM','PENTHOUSES','PENTHOUSE','JR 1 BEDROOMS','JR 1 BEDROOM','CONVERTIBLES','CONVERTIBLE'];

  // Helper: get the first MEANINGFUL non-empty cell as a string (skips whitespace-only cells).
  // Returns the trimmed string, or null if no meaningful cell exists.
  const firstMeaningfulStr = (row) => {
    for (const c of row) {
      if (c === null || c === undefined || c === '') continue;
      const s = String(c).trim();
      if (s === '') continue; // skip whitespace-only cells
      return s;
    }
    return null;
  };

  // Helper: scan a row for a bedroom label. To avoid false positives (e.g. a unit
  // data row whose TYPE column contains "Penthouse"), we only treat a row as a
  // bedroom-label row if it contains exactly ONE meaningful (non-whitespace) cell,
  // and that cell's normalized value is in bedroomLabels.
  const findBedroomLabel = (row) => {
    let bedroomLabel = null;
    let meaningfulCellCount = 0;
    for (const c of row) {
      if (c === null || c === undefined || c === '') continue;
      const isString = typeof c === 'string';
      if (isString && c.trim() === '') continue; // whitespace-only cell
      meaningfulCellCount++;
      if (isString) {
        const norm = c.trim().replace(/\s+/g, ' ').toUpperCase();
        if (bedroomLabels.includes(norm)) bedroomLabel = norm;
      }
    }
    return (meaningfulCellCount === 1 && bedroomLabel) ? bedroomLabel : null;
  };

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.every(c => c === null || c === '' || (typeof c === 'string' && c.trim() === ''))) continue;

    // Building detection: scan row for any cell that looks like a building header
    // (must start with 3-5 digit numeric prefix).
    let buildingMatch = null;
    for (const c of row) {
      if (c === null || c === undefined || c === '') continue;
      if (typeof c !== 'string') continue;
      const s = c.trim();
      if (s === '') continue;
      if (buildingRegex.test(s) && !s.toUpperCase().includes('LOCKED') && s.length < 120) {
        buildingMatch = s;
      }
      break; // only consider the first meaningful cell for building detection
    }
    if (buildingMatch) {
      currentBuilding = buildingMatch.split('•')[0].split(' - ')[0].trim();
      currentBedroom = null;
      columnMap = null;  // reset only on new building
      continue;
    }

    // Bedroom-group detection: scan ALL cells, not just the first non-empty.
    // This handles cases where the label is preceded by whitespace cells or sits
    // in a non-first column. Intentionally does NOT reset columnMap — some sections
    // (e.g. 2 BEDROOMS at 2110) skip the header row and reuse the previous layout.
    const bedroomMatch = findBedroomLabel(row);
    if (bedroomMatch) {
      currentBedroom = bedroomMatch;
      continue;
    }

    // For the remaining checks we still need a representative first cell.
    const cellStr = firstMeaningfulStr(row);
    if (cellStr === null) continue;
    if (cellStr.toUpperCase() === 'UNIT' || (row.includes('UNIT') && row.includes('TYPE'))) {
      columnMap = {};
      row.forEach((c, i) => {
        if (c && typeof c === 'string') {
          const k = c.toString().trim().toUpperCase();
          if (k) columnMap[k] = i;
        }
      });
      continue;
    }
    if (!currentBuilding || !currentBedroom || !columnMap) continue;
    const unitIdx = columnMap['UNIT'];
    if (unitIdx === undefined) continue;
    const unitVal = row[unitIdx];
    if (unitVal === null || unitVal === '') continue;
    if (typeof unitVal === 'string' && unitVal.trim() === '') continue;
    if (typeof unitVal !== 'number' && !/^[a-z0-9][a-z0-9-]{0,9}$/i.test(String(unitVal).trim())) continue;
    const get = (key) => {
      const i = columnMap[key];
      return i !== undefined ? row[i] : null;
    };
    const monthly = get('MONTHLY') ?? row[6];
    const netEff = get('NET EFF') ?? row[7];
    // Fall back to column I (index 8) when a section header row omits the INCENTIVE label
    // (e.g. 2110 1BR) — same positional fallback MONTHLY / NET EFF already use.
    let incentiveRaw = get('INCENTIVE') ?? row[8] ?? '';
    // Defensive: discard Date objects OR numeric Excel serial dates in the INCENTIVE column
    if (incentiveRaw instanceof Date) incentiveRaw = '';
    if (typeof incentiveRaw === 'number' && incentiveRaw > 40000 && incentiveRaw < 60000) incentiveRaw = '';
    const incentive = String(incentiveRaw).trim();
    const avail = get('AVAIL');
    let availStr = '';
    if (avail instanceof Date) {
      // SheetJS parses Excel date cells at UTC midnight. Format in UTC so a
      // stored Oct 10 doesn't render as Oct 9 in a west-of-UTC timezone (e.g. NY).
      availStr = avail.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric', timeZone:'UTC'});
    } else if (typeof avail === 'number' && avail > 40000 && avail < 60000) {
      // Excel serial date — convert to JS Date (Excel epoch is Dec 30, 1899).
      // The result lands on UTC midnight, so format in UTC to avoid the -1 day shift.
      const jsDate = new Date(Math.round((avail - 25569) * 86400 * 1000));
      availStr = jsDate.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric', timeZone:'UTC'});
    } else if (avail) {
      availStr = String(avail);
    }
    // A date in AVAIL: NOTES says whether the unit is occupied or being renovated until then (production v1.26, D30). Any
    // wording with the word "occupied", or "reno" / "renovation(s)", any case; occupied wins if both appear. "Renovated"
    // (already done, e.g. "newly renovated") and "unoccupied" don't count. The note itself isn't kept, so internal comments
    // never reach the iPads (the gift card note below is the one exception).
    let availStatus = '';
    if (availStr && availStr !== 'PRIORITY' && availStr.toUpperCase() !== 'AVAIL') {
      const n = String(get('NOTES') ?? '');
      availStatus = /\boccupied\b/i.test(n) ? 'occupied' : /\b(reno|renovations?)\b/i.test(n) ? 'reno' : '';
    }
    if (!availStr || availStr === 'PRIORITY' || availStr.toUpperCase() === 'AVAIL') {
      // No availability date. Before defaulting to "Immediately", check the NOTES
      // column — an occupied unit with a blank date is NOT available immediately.
      const notesRaw = get('NOTES');
      const notes = notesRaw != null ? String(notesRaw).trim() : '';
      if (/^occupied$/i.test(notes)) {
        availStr = 'Occupied';
      } else {
        availStr = 'Immediately';
      }
    }
    // Leasing assistant contest (production v1.29, D35): a NOTES cell with the words "gift card" (e.g. "$150 gift card for a
    // lease by 11/15") marks the unit. Only this note is kept; the Desk's unit list shows it through the date in it. Never in emails.
    const contest = contestNote(get('NOTES'));
    const contestUntil = contest ? contestDeadline(contest, now) : '';
    units.push({
      building: currentBuilding,
      bedroomGroup: currentBedroom,
      unit: String(unitVal).trim(),
      type: get('TYPE') || '',
      sqft: get('SQ FT') || '',
      direction: get('DIRECTION') || '',
      view: get('VIEW') || '',
      monthly: monthly,
      netEff: netEff,
      incentive: incentive,
      avail: availStr,
      priority: avail === 'PRIORITY',
      hasApp: redRows.has(rowIdx),
      ...(orangeRows.has(rowIdx) ? { backupApps: true } : {}),   // still on the market: never hasApp (D49)
      ...(availStatus ? { availStatus } : {}),
      ...(contest ? { contest, ...(contestUntil ? { contestUntil } : {}) } : {})
    });
  }
  return units;
}
// Floor plan links keyed by building + unit. Columns are found by their headers, or default to A, B, C.
export function parseFloorPlanRows(rows) {
  let headerRowIdx = -1;
  let buildingCol = -1, unitCol = -1, linkCol = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const lower = row.map(c => String(c||'').toLowerCase().trim());
    const bIdx = lower.findIndex(c => /^(building|bldg|property|address|complex)/i.test(c));
    const uIdx = lower.findIndex(c => /^(unit|apt|apartment|#)/i.test(c));
    const lIdx = lower.findIndex(c => /(link|url|dropbox|floorplan|floor.?plan)/i.test(c));
    if (bIdx >= 0 && uIdx >= 0 && lIdx >= 0) {
      headerRowIdx = i;
      buildingCol = bIdx;
      unitCol = uIdx;
      linkCol = lIdx;
      break;
    }
  }
  if (headerRowIdx < 0) {
    headerRowIdx = -1;
    buildingCol = 0;
    unitCol = 1;
    linkCol = 2;
  }
  const newFp = {};
  let added = 0, skipped = 0;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const b = row[buildingCol];
    const u = row[unitCol];
    const l = row[linkCol];
    if (!b || u === null || u === undefined || u === '' || !l) { skipped++; continue; }
    const linkStr = String(l).trim();
    if (!/^https?:\/\//i.test(linkStr)) { skipped++; continue; }
    const key = fpKey(b, u);
    if (!key.includes('|') || key.startsWith('|') || key.endsWith('|')) { skipped++; continue; }
    newFp[key] = linkStr;
    added++;
  }
  return { links: newFp, added, skipped };
}
