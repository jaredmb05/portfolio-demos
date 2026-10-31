// Net Rent Calculator.
import { money, netEffective } from '../../shared/pricing.js';
import { $ } from './ui.js';

// ---------- Net rent calculator (same formula as the toolkit) ----------
export function calc() {
  const rent = parseFloat(($('cRent').value || '').replace(/[^0-9.]/g,'')) || 0;
  const term = Math.max(1, parseInt($('cTerm').value, 10) || 12);
  const free = parseFloat($('cFree').value) || 0;
  const credit = parseFloat(($('cCredit').value || '').replace(/[^0-9.]/g,'')) || 0;
  if (!rent) { $('cNet').textContent = '—'; $('cNetSub').textContent = ''; $('cRows').innerHTML = ''; return; }
  const freeAmt = rent * free;
  const net = netEffective(rent, term, free);
  $('cNet').textContent = money(net);
  $('cNetSub').textContent = `per month over ${term} months`;
  $('cRows').innerHTML = `
    <span>Gross rent × ${term}</span><b>${money(rent * term)}</b>
    ${free ? `<span>Free rent (${free} mo)</span><b>− ${money(freeAmt)}</b>` : ''}
    ${credit ? `<span>Credit</span><b>− ${money(credit)}</b>` : ''}
    <span>Total paid</span><b>${money(rent * term - freeAmt - credit)}</b>
    <span>Monthly savings</span><b>${money(rent - net)}</b>`;
}
