// Escaping text for HTML built from strings.

export function escapeHtml(s) { return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// A value passed to an inline handler (onclick="fn(${jsArg(id)})"): a JSON literal, escaped for the attribute it sits in, so
// quotes or markup in shared data can't end the attribute or the string (B4)
export const jsArg = v => escapeHtml(JSON.stringify(v));
// A floor plan link from shared data, in an email or on the iPad: https only, an http:// link upgraded; anything else
// (javascript:, data:, no scheme, a space or quote inside) counts as no link (B4, production D43)
export const webUrl = u => { const s = String(u == null ? '' : u).trim().replace(/^http:\/\//i, 'https://'); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ''; };
