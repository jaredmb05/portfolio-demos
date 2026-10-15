// Copy the email for Outlook / Gmail (rich HTML) or as plain text, and warn about blanks left in it.
import { buildEmailHTML } from './email-builder.js';
import { toast } from './ui.js';

export async function copyAsHTML() {
  const html = buildEmailHTML();
  await copyHtmlToClipboard(html);
  warnIfBlanks(html);
}
// "[Prospect]", "[Unit]", "$[Rent]"… still in the email: say so after copying (the copy itself is unchanged)
function warnIfBlanks(html) {
  const gaps = [...new Set((String(html).match(/\[(Prospect|Applicant|Unit|Rent|Amount|Building|building|unit|Lease start date|Lease end date|Select alternative units below)\]/g) || []))];
  if (gaps.length) setTimeout(() => toast(`Copied — but the email still has ${gaps.join(', ')}. Fill it in before sending.`, 'warn'), 50);
}
export async function copyHtmlToClipboard(html) {
  // Method 1: execCommand — works on local files, Outlook-friendly
  try {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.pointerEvents = 'none';
    container.style.opacity = '0';
    document.body.appendChild(container);
    const range = document.createRange();
    range.selectNode(container);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand('copy');
    sel.removeAllRanges();
    document.body.removeChild(container);
    if (ok) { toast('Copied! Paste into Outlook or Gmail'); return; }
  } catch(e) {}
  // Method 2: Clipboard API (requires HTTPS)
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const plainBlob = new Blob([htmlToPlain(html)], { type: 'text/plain' });
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': plainBlob })]);
    toast('Copied! Paste into Outlook or Gmail'); return;
  } catch(e) {}
  // Method 3: plain text fallback
  try {
    await navigator.clipboard.writeText(htmlToPlain(html));
    toast('Copied as plain text (upgrade to HTTPS for rich copy)');
  } catch(err) { toast('Copy failed — try "Copy Plain" instead', true); }
}

export async function copyAsPlainText() {
  const plain = htmlToPlain(buildEmailHTML());
  warnIfBlanks(plain);
  try {
    const el = document.createElement('textarea');
    el.value = plain;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok) { toast('Copied plain text'); return; }
  } catch(e) {}
  try {
    await navigator.clipboard.writeText(plain);
    toast('Copied plain text');
  } catch(e) { toast('Copy failed', true); }
}

function htmlToPlain(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.innerText;
}
