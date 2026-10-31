// Shared data (world-writable in Firestore) reaching the page: handler arguments (B4) and floor plan links (production D43).
import { describe, expect, it } from 'vitest';
import { jsArg, webUrl } from '../../apps/shared/html.js';

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
  it("an apostrophe in a name, a tour or lead ID or a unit number reaches the handler unchanged (O'Hara, 7'A)", () => {
    for (const v of ["Lena O'Hara", "t-theo-d'angelo", "lead-ines-o'malley", "2050 TIDEMARK BLVD::7'A"]) expect(JSON.parse(decodeAttr(jsArg(v)))).toBe(v);
  });
  it('passes numbers and booleans through as themselves', () => {
    expect(jsArg(3)).toBe('3');
    expect(jsArg(true)).toBe('true');
  });
});

describe('a floor plan link in an email or on the iPad', () => {
  it('is kept as it is when it is https', () => {
    expect(webUrl('https://www.dropbox.com/scl/fi/x/2050_506.pdf?rlkey=r0&dl=0')).toBe('https://www.dropbox.com/scl/fi/x/2050_506.pdf?rlkey=r0&dl=0');
    expect(webUrl('HTTPS://example.com/a.pdf')).toBe('HTTPS://example.com/a.pdf');
  });
  it('an http:// link goes out as https://', () => {
    expect(webUrl('http://example.com/plan-7a.pdf')).toBe('https://example.com/plan-7a.pdf');
    expect(webUrl('HTTP://example.com/a')).toBe('https://example.com/a');
  });
  it('spaces around a pasted link are trimmed', () => {
    expect(webUrl('  https://example.com/a.pdf\n')).toBe('https://example.com/a.pdf');
    expect(webUrl(' http://example.com/a.pdf ')).toBe('https://example.com/a.pdf');
  });
  it('anything else counts as no link: javascript:, data:, ftp:, no scheme, empty', () => {
    for (const u of ["javascript:window.__pwned='x'", ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com/plan-7a.pdf', 'www.dropbox.com/x.pdf', 'https://', '', undefined, null]) expect(webUrl(u)).toBe('');
  });
  it('a link with a space, a quote or an angle bracket inside counts as no link', () => {
    for (const u of ['https://example.com/a b.pdf', 'https://example.com/"onmouseover="x', "https://example.com/'x", 'https://example.com/<b>']) expect(webUrl(u)).toBe('');
  });
});
