// Quote and concession rules. The Desk email rules (first half) and the iPad quote rules (second half) are both here; Phase 3 reconciles them (AUDIT.md M1–M5).
import { formatRent } from './format.js';

// Format the concession line for the email, respecting OP-only checkbox
export function isAndStyleConcession(i) { return /\band\b/i.test(String(i||'')) && /\bOP\b/i.test(String(i||'')) && !/\bor\b/i.test(String(i||'')); }
// The prospect's parts and the broker's part of an AND-style incentive: "1 Month Free and 1/2 Mo. OP" → ["1 Month Free"], "1/2 Mo. OP"
const nonOpParts = i => i.split(/\s+and\s+/i).filter(p => !/\bOP\b/i.test(p));
const opPart = i => (i.split(/\s+and\s+/i).find(p => /\bOP\b/i.test(p)) || '').trim();
// An offer with nothing for the prospect: every part is an OP ("1 Mo. OP")
export function opOnlyOffer(text) { const t = String(text || '').trim(); if (!t || /^no incentives?$/i.test(t)) return false; return t.split(/\s+(?:or|and)\s+/i).every(p => /\bOP\b/i.test(p)); }
function formatConcession(incentive, opOnly, showNetEff, noBroker) {
  if (!incentive) return '';
  const i = String(incentive).trim();
  if (!i || /^no incentives?$/i.test(i)) return '';
  const hasOr = /\bor\b/i.test(i);
  // AND-style (renter gets X AND broker gets OP): with no broker, drop the OP part
  if (noBroker && isAndStyleConcession(i)) {
    const nonOp = nonOpParts(i);
    if (nonOp.length) return nonOp.join(' and ').trim();
  }
  // OP only checked — show just the OP part
  if (opOnly && hasOr) {
    const parts = i.split(/\s+or\s+/i);
    const opPart = parts.find(p => /\bOP\b/i.test(p));
    if (opPart) return opPart.trim();
  }
  // Net effective shown — prospect is taking the free month, strip the "OR OP" part
  if (showNetEff && hasOr) {
    const parts = i.split(/\s+or\s+/i);
    const nonOpPart = parts.find(p => !/\bOP\b/i.test(p));
    if (nonOpPart) return nonOpPart.trim();
  }
  return i;
}


export const OTHER_FREE_OPTIONS = [[0,'None'],[0.25,'¼ month free'],[0.5,'½ month free'],[0.75,'¾ month free'],[1,'1 month free'],[1.5,'1½ months free'],[2,'2 months free']];
export const OTHER_OP_OPTIONS = [[0,'None'],[0.25,'1/4 Mo. OP'],[0.5,'1/2 Mo. OP'],[0.75,'3/4 Mo. OP'],[1,'1 Mo. OP'],[2,'2 Mo. OP']];
// Broker OP: preset months, or a custom value typed as months ("1.5") or dollars ("$3000" / "3000").
export function resolveOp(s) {
  if (s.otherOp !== 'custom') {
    const v = parseFloat(s.otherOp) || 0;
    return { amount: v, label: (OTHER_OP_OPTIONS.find(([x]) => x === v) || [0,''])[1] };
  }
  const raw = String(s.otherOpCustom || '').trim();
  if (!raw) return { amount: 0, label: '' };
  const isDollar = raw.startsWith('$') || parseFloat(raw.replace(/[^0-9.]/g,'')) > 12;
  const n = parseFloat(raw.replace(/[^0-9.]/g,'')) || 0;
  if (!n) return { amount: 0, label: '' };
  if (isDollar) return { amount: n, label: `$${formatRent(Math.round(n))} OP` };
  const frac = { 0.25:'1/4', 0.5:'1/2', 0.75:'3/4' }[n];
  return { amount: n, label: `${frac || String(n)} Mo. OP` };
}
// Resolve the concession text + net effective for one selected unit, honoring "Other concession".
export function resolveConcession(s) {
  const rent = parseFloat(String(s.monthly||'').replace(/[^0-9.]/g,'')) || 0;
  const base = formatConcession(s.incentive, s.opOnly, s.showNetEff, s.noBroker);
  const hasOr = s.incentive && /\bor\b/i.test(String(s.incentive));
  const hideOp = s.noBroker && opOnlyOffer(s.incentive);   // no broker: an OP-only offer isn't mentioned
  let text = hideOp ? '' : base;
  let netEff = (!hideOp && s.showNetEff && !(s.opOnly && hasOr) && s.netEff !== null && s.netEff !== undefined && s.netEff !== '') ? Number(s.netEff) : null;
  if (!s.otherConc) return { text, netEff };
  const free = parseFloat(s.otherFree) || 0;
  const term = Math.max(1, parseInt(s.otherTerm, 10) || leaseTerm(s.incentive));   // blank: the unit's own term
  const credit = parseFloat(String(s.otherCredit||'').replace(/[^0-9.]/g,'')) || 0;
  const creditLabel = (s.otherCreditLabel || 'one-time credit').trim();
  const freeLabel = (OTHER_FREE_OPTIONS.find(([v]) => v === free) || [0,''])[1];
  const { amount: op, label: opLabel } = resolveOp(s);
  const opMode = s.otherOpMode === 'and' ? 'and' : 'or';
  // An override changes amounts, never the broker rule (D19): on an OR offer the broker takes the OP unless they waive
  // ("OP only" unticked), and the prospect's free months and net effective apply only then.
  let ne = null;
  if (free > 0 && op > 0) {
    if (opMode === 'or' && s.opOnly) { text = opLabel; netEff = null; }   // the broker takes the OP: no net for the prospect
    else {   // Both (AND) quotes the OP too, unless "No broker" is ticked; Either/or here means no broker, or the broker waived
      text = opMode === 'and' && !s.noBroker ? `${freeLabel} and ${opLabel} on a ${term}-month lease` : `${freeLabel} on a ${term}-month lease`;
      if (rent) ne = rent * (term - free) / term;   // NE assumes the renter takes the free months
    }
  } else if (free > 0) {
    if (!(s.opOnly && hasOr)) {                     // otherwise the showsheet OP still goes to the broker
      const sheetOp = isAndStyleConcession(s.incentive) && !s.noBroker ? opPart(String(s.incentive)) : '';   // AND: the broker keeps it
      text = sheetOp ? `${freeLabel} and ${sheetOp} on a ${term}-month lease` : `${freeLabel} on a ${term}-month lease`;
      if (rent) ne = rent * (term - free) / term;
    }
  } else if (op > 0) {
    const prospect = isAndStyleConcession(s.incentive) && !s.noBroker ? nonOpParts(String(s.incentive)).join(' and ').trim() : '';
    text = prospect ? `${prospect} and ${opLabel}` : opLabel;   // AND: the prospect keeps the showsheet concession
    if (prospect) ne = netEff;
  } else if (rent && netEff !== null) {
    ne = netEff;
  }
  if (credit > 0) {
    const creditText = `$${formatRent(Math.round(credit))} ${creditLabel}`;
    text = text ? `${text} plus a ${creditText}` : creditText.charAt(0).toUpperCase() + creditText.slice(1);
  }
  if (ne !== null) netEff = Math.round(ne);
  return { text, netEff };
}
export const FREE_OPTS = [[0,'Showsheet concession'],[0.25,'¼ month free'],[0.5,'½ month free'],[0.75,'¾ month free'],[1,'1 month free'],[1.5,'1½ months free'],[2,'2 months free']];
export const OP_OPTS = [[0,'None'],[0.25,'1/4 Mo. OP'],[0.5,'1/2 Mo. OP'],[0.75,'3/4 Mo. OP'],[1,'1 Mo. OP'],[2,'2 Mo. OP']];

// What to say for a stop, honoring per-tour overrides and broker mode
// Parse a showsheet incentive into the prospect part, the broker (OP) part, and how they're joined.
export function parseIncentive(sheet) {
  const t = String(sheet || '').trim();
  if (!t || /^no incentives?$/i.test(t)) return { conc: '', opText: '', mode: null, freeMonths: 0 };
  // Any "OR" makes it an OR incentive (D19), split into its two offers: "1 Month Free and $500 Credit OR 1 Mo. OP"
  const isOr = /\bor\b/i.test(t);
  const parts = t.split(isOr ? /\s+or\s+/i : /\s+and\s+/i);
  const opText = (parts.find(p => /\bOP\b/i.test(p)) || '').trim();
  const conc = (parts.find(p => !/\bOP\b/i.test(p)) || (opText ? '' : t)).trim();
  // "1 Month", "1.5 Months", "1/2 Month", "½ Month"; a whole number before a fraction adds to it: "1 1/2" = "1½" = 1.5
  const m = conc.match(/(\d+(?:\.\d+)?)?\s*(½|\d\/\d)\s*(?:month|mo)|(\d+(?:\.\d+)?)\s*(?:month|mo)/i);
  const fraction = f => f === '½' ? 0.5 : f.split('/').reduce((a, b) => a / b);
  const freeMonths = !m ? 0 : m[2] ? (parseFloat(m[1]) || 0) + fraction(m[2]) : parseFloat(m[3]);
  return { conc, opText, mode: (conc && opText) ? (isOr ? 'or' : 'and') : null, freeMonths };
}
// The lease term an incentive states ("on 24-Month Lease", "24-Mo Lease", "24 month lease"); 12 months when it states none
export function leaseTerm(incentive) {
  const m = String(incentive || '').match(/(\d{1,2})\s*-?\s*(?:months?|mos?)\.?\s+lease\b/i);
  return m && parseInt(m[1], 10) > 0 ? parseInt(m[1], 10) : 12;
}
// What this stop quotes: showsheet by default; rent, prospect concession, OP (broker only), and credit can be overridden.
export function resolveStop(s) {
  const rent = parseFloat(String(s.rent || s.monthly || '').replace(/[^0-9.]/g,'')) || 0;
  const term = leaseTerm(s.incentive);
  const sheet = parseIncentive(s.incentive);
  const free = parseFloat(s.free) || 0;          // 0 = showsheet
  const op = parseFloat(s.op) || 0;              // 0 = showsheet
  const credit = parseFloat(String(s.credit || '').replace(/[^0-9.]/g,'')) || 0;
  const conc = free > 0 ? FREE_OPTS.find(([v]) => v === free)[1] : sheet.conc;
  let freeAmt = free > 0 ? rent * free : (sheet.freeMonths ? rent * sheet.freeMonths : (s.netEff && Number(s.netEff) && !free ? (rent - Number(s.netEff)) * term : 0));
  const opText = op > 0 ? OP_OPTS.find(([v]) => v === op)[1] : sheet.opText;
  const mode = (conc && opText) ? (sheet.mode || 'and') : null;   // an OP added on top of a showsheet free month is offered together
  const net = rent ? Math.round(rent - freeAmt / term) : 0;   // a credit is quoted next to the rent, never in the net (D19)
  const creditText = credit ? `$${Math.round(credit).toLocaleString('en-US')} credit` : '';
  return { rent, net, conc, opText, mode, creditText, term, sheet };
}
// Saved with each stop so the Desk email quotes the same offer: how the prospect's concession and the OP combine, and the term
export function savedQuoteFields(st) { const r = resolveStop(st); return { opMode: r.mode || 'or', term: r.term }; }
// The quoting rule assistants see on a broker tour (D19; wording approved by the owner)
export const BROKER_NOTE = "OR incentives: quote the OP to the broker; quote the prospect's concession and net rent only if the broker waives it. AND incentives: quote both.";
// Whole dollars for the iPad quote: '$4,150'; '' for zero or not a number
export const money = n => { const v = Number(String(n).replace(/[^0-9.]/g,'')); return isFinite(v) && v ? '$' + Math.round(v).toLocaleString('en-US') : ''; };
// Net effective rent: monthly rent averaged over the lease after the free months (not rounded). Credits are quoted
// next to the rent and never included (D19).
export const netEffective = (rent, term, free) => rent * (term - free) / term;
// What to quote for one stop: line 1 is the offer, line 2 the net effective (or what the prospect gets if the broker waives).
export function quoteLines(s, broker) {
  const r = resolveStop(s);
  const rentTxt = money(r.rent);
  const concFull = [r.conc, r.creditText].filter(Boolean).join(' + ');
  let line1 = '', line2 = '';
  if (broker && r.opText) {
    if (r.mode === 'and') {            // prospect gets the free month AND the broker gets the OP
      line1 = `${rentTxt} · ${concFull} AND ${r.opText}`;
      line2 = `Net effective ${money(r.net)} · broker also gets the OP`;
    } else {                            // OR (or OP only): the OP goes to the broker unless they waive it
      line1 = `${rentTxt} · ${r.opText} to the broker${r.creditText ? ' + ' + r.creditText : ''}`;
      line2 = r.conc ? `If the broker waives the OP: ${concFull} → net ${money(r.net)}` : '';
    }
  } else {                              // no broker: the prospect's incentive only — never mention the OP
    line1 = concFull ? `${rentTxt} · ${concFull}` : `${rentTxt} · no concession`;
    line2 = concFull ? `Net effective ${money(r.net)}` : '';
  }
  return { line1, line2 };
}
