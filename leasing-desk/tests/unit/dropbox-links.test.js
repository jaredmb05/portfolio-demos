// Dropbox sync links (production D42): only Dropbox share links are saved, tested or downloaded, and changing a link or
// turning sync off needs the manager PIN. Every Desk downloads and publishes whatever the shared settings point to.
import { describe, expect, it } from 'vitest';
import { dbxCandidates, dbxSaveRule, isDropboxUrl } from '../../apps/desk/js/rules/dropbox-links.js';

const SS = 'https://www.dropbox.com/scl/fi/k2x9q/Showsheet.xlsx?rlkey=a1b2c3&dl=0';
const FP = 'https://www.dropbox.com/scl/fi/p7m4w/Floor_Plan_Master.xlsx?rlkey=d4e5f6&dl=0';
const NEW_SS = 'https://www.dropbox.com/scl/fi/zz9/Other_Showsheet.xlsx?rlkey=q1&dl=0';

describe('a Dropbox link', () => {
  it('is an https link on dropbox.com or dropboxusercontent.com (any subdomain)', () => {
    for (const u of [SS, 'https://dropbox.com/s/abc/file.xlsx', 'https://dl.dropboxusercontent.com/scl/fi/k2x9q/Showsheet.xlsx', '  ' + FP + '  ']) expect(isDropboxUrl(u)).toBe(true);
  });
  it('a link on another site is not, even one that looks like Dropbox', () => {
    for (const u of ['https://files.example.com/showsheet.xlsx', 'https://notdropbox.com/s/x.xlsx', 'https://www.dropbox.com.example.com/s/x.xlsx',
      'https://example.com/?u=www.dropbox.com', 'https://www.dropbox.com@example.com/x.xlsx']) expect(isDropboxUrl(u)).toBe(false);
  });
  it('http, other schemes, no scheme and empty are not', () => {
    for (const u of ['http://www.dropbox.com/scl/fi/x/Showsheet.xlsx', 'javascript:alert(1)', 'www.dropbox.com/scl/fi/x/Showsheet.xlsx', '', null, undefined]) expect(isDropboxUrl(u)).toBe(false);
  });
});

describe('the addresses a sync downloads from', () => {
  it('a share link: the direct download first, then dl=1, then raw=1 (dl, raw and st dropped from the link)', () => {
    expect(dbxCandidates(SS)).toEqual([
      'https://dl.dropboxusercontent.com/scl/fi/k2x9q/Showsheet.xlsx?rlkey=a1b2c3',
      'https://www.dropbox.com/scl/fi/k2x9q/Showsheet.xlsx?rlkey=a1b2c3&dl=1',
      'https://www.dropbox.com/scl/fi/k2x9q/Showsheet.xlsx?rlkey=a1b2c3&raw=1',
    ]);
  });
  it('a direct dropboxusercontent.com link is used as it is', () => {
    expect(dbxCandidates('https://dl.dropboxusercontent.com/scl/fi/k2x9q/Showsheet.xlsx?rlkey=a1b2c3')).toEqual(['https://dl.dropboxusercontent.com/scl/fi/k2x9q/Showsheet.xlsx?rlkey=a1b2c3']);
  });
  it('a link on another site (written straight into the database) gives nothing to download', () => {
    for (const u of ['https://files.example.com/showsheet.xlsx', 'http://www.dropbox.com/scl/fi/x/Showsheet.xlsx', '', undefined]) expect(dbxCandidates(u)).toEqual([]);
  });
});

describe('saving the sync settings', () => {
  const cfg = { showsheetUrl: SS, floorplanUrl: FP };
  it('the links already set, saved unchanged: no PIN', () => {
    expect(dbxSaveRule(SS, FP, cfg)).toBe('ok');
  });
  it('a new Dropbox link for either file needs the manager PIN', () => {
    expect(dbxSaveRule(NEW_SS, FP, cfg)).toBe('pin');
    expect(dbxSaveRule(SS, NEW_SS, cfg)).toBe('pin');
  });
  it('turning sync off (both boxes empty) or emptying one box needs the PIN', () => {
    expect(dbxSaveRule('', '', cfg)).toBe('pin');
    expect(dbxSaveRule(SS, '', cfg)).toBe('pin');
  });
  it('setting up sync on a Desk with none needs the PIN; saving it still off does not', () => {
    expect(dbxSaveRule(SS, FP, {})).toBe('pin');
    expect(dbxSaveRule('', '', {})).toBe('ok');
  });
  it('a link on another site is refused before any PIN is asked, in either box', () => {
    expect(dbxSaveRule('https://files.example.com/showsheet.xlsx', FP, cfg)).toBe('not-dropbox');
    expect(dbxSaveRule(SS, 'http://www.dropbox.com/scl/fi/x/Floor_Plan_Master.xlsx', cfg)).toBe('not-dropbox');
  });
});
