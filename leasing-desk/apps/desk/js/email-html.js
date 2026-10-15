// Building blocks for the Outlook-safe email HTML: inline styles on every element, empty paragraphs as spacers.
// Outlook re-flows anything else, so the output is checked byte for byte (tests/compare_emails.js).

export const EMAIL_FONT = 'font-family:Calibri,Arial,sans-serif; font-size:11pt; font-weight:normal; text-decoration:none;';
export const p = (html) => `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;">${html}</p>`;
export const bold = (t) => `<strong style="font-weight:bold;">${t}</strong>`;

// Outlook-friendly paragraph spacer — empty content is robust against Outlook's
// "Don't add space between paragraphs" setting and Word's paste normalization.
// Empty paragraphs get rendered as visible whitespace; non-empty CSS margins often don't.
export const SEP = '<p style="margin:0; padding:0; mso-line-height-rule:exactly; mso-line-height-alt:14pt; line-height:14pt; font-size:11pt; font-family:Calibri,Arial,sans-serif;">&nbsp;</p>';

// Insert SEP between top-level <p>/<ul>/<ol> blocks in stored template bodies (welcome, PFA).
// Lets us keep the raw templates clean (no &nbsp; clutter) but render Outlook-safe HTML.
export function addOutlookSpacers(html) {
  if (!html) return '';
  return html
    .replace(/<\/p>\s*<p\b/gi, '</p>' + SEP + '<p')
    .replace(/<\/p>\s*<ul\b/gi, '</p>' + SEP + '<ul')
    .replace(/<\/p>\s*<ol\b/gi, '</p>' + SEP + '<ol')
    .replace(/<\/ul>\s*<p\b/gi, '</ul>' + SEP + '<p')
    .replace(/<\/ul>\s*<ul\b/gi, '</ul>' + SEP + '<ul')
    .replace(/<\/ul>\s*<ol\b/gi, '</ul>' + SEP + '<ol')
    .replace(/<\/ol>\s*<p\b/gi, '</ol>' + SEP + '<p')
    .replace(/<\/ol>\s*<ul\b/gi, '</ol>' + SEP + '<ul');
}
