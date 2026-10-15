// Escaping text for HTML built from strings.

export function escapeHtml(s) { return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// A value passed to an inline handler (onclick="fn(${jsArg(id)})"): a JSON literal, escaped for the attribute it sits in, so
// quotes or markup in shared data can't end the attribute or the string (B4)
export const jsArg = v => escapeHtml(JSON.stringify(v));
// A link from shared data, kept only when it is http(s); anything else (javascript:, data:, no scheme) counts as no link (B4)
export const safeUrl = u => /^https?:\/\//i.test(String(u == null ? '' : u)) ? String(u) : '';
