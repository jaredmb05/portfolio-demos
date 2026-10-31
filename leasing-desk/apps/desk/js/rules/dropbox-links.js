// Dropbox sync links (production D42). Every Desk downloads and publishes whatever the shared settings point to, so only
// Dropbox share links are accepted, when saving, testing and syncing; a link to another site that reaches the settings some
// other way (written straight into the database) is never downloaded. Changing a link, or turning sync off, needs the manager PIN.

// An https link on dropbox.com or dropboxusercontent.com
export function isDropboxUrl(url) {
  try { const u = new URL(String(url).trim()); return u.protocol === 'https:' && /(^|\.)(dropbox\.com|dropboxusercontent\.com)$/.test(u.hostname); } catch (e) { return false; }
}
// The addresses to download a share link from, the direct one first; none for a link that isn't Dropbox's
export function dbxCandidates(url) {
  const out = [];
  if (!isDropboxUrl(url)) return out;
  try {
    const u = new URL(String(url).trim());
    if (/(^|\.)dropbox\.com$/.test(u.hostname)) {
      const p = new URLSearchParams(u.search); p.delete('dl'); p.delete('raw'); p.delete('st');
      const q = p.toString();
      out.push(`https://dl.dropboxusercontent.com${u.pathname}${q ? '?' + q : ''}`);
      p.set('dl', '1'); out.push(`https://www.dropbox.com${u.pathname}?${p.toString()}`);
      p.delete('dl'); p.set('raw', '1'); out.push(`https://www.dropbox.com${u.pathname}?${p.toString()}`);
    } else out.push(u.toString());
  } catch (e) {}
  return out;
}
// Saving the settings: 'not-dropbox' (refused: a box holds a link to another site), 'pin' (either link changes, which
// includes turning sync off), or 'ok' (saved as they are). An empty box is allowed: that file isn't synced.
export function dbxSaveRule(ss, fp, cfg) {
  if ([ss, fp].some(u => u && !isDropboxUrl(u))) return 'not-dropbox';
  return ss !== (cfg.showsheetUrl || '') || fp !== (cfg.floorplanUrl || '') ? 'pin' : 'ok';
}
