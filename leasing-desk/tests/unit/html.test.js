// Shared data (world-writable in Firestore) reaching the page: handler arguments and links (B4).
import { describe, expect, it } from 'vitest';
import { jsArg, safeUrl } from '../../apps/shared/html.js';

// What the browser does to an attribute value before the handler's JavaScript runs
const decodeAttr = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

describe('a value passed to an inline handler', () => {
  it('stays one JavaScript string, whatever quotes or markup it holds', () => {
    for (const v of ["t'1", 'say "hi"', "1');window.__pwned=('1", '<img src=x onerror=alert(1)>', 'a&b', '2050 TIDEMARK BLVD::1812']) {
      const attr = jsArg(v);
      expect(attr).not.toMatch(/['"<>]/);              // nothing in it can end the attribute or open a tag
      expect(JSON.parse(decodeAttr(attr))).toBe(v);   // the handler receives the original value
    }
  });
  it('passes numbers and booleans through as themselves', () => {
    expect(jsArg(3)).toBe('3');
    expect(jsArg(true)).toBe('true');
  });
});

describe('a link from shared data', () => {
  it('is kept when it is http(s)', () => {
    expect(safeUrl('https://www.dropbox.com/scl/fi/x/2050_506.pdf?rlkey=r0&dl=0')).toBe('https://www.dropbox.com/scl/fi/x/2050_506.pdf?rlkey=r0&dl=0');
    expect(safeUrl('HTTP://example.com/a')).toBe('HTTP://example.com/a');
  });
  it('is dropped otherwise (javascript:, data:, no scheme, empty)', () => {
    for (const u of ["javascript:window.__pwned='x'", ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'www.dropbox.com/x.pdf', '', undefined, null]) expect(safeUrl(u)).toBe('');
  });
});
