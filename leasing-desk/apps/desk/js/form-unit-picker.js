// The "pick from showsheet" dropdown on the Application Confirmation and Lease Approval forms, for the chosen building.
import { formatRent } from '../../shared/format.js';
import { escapeHtml } from '../../shared/html.js';
import { state } from './state.js';
import { bldgNum } from './units.js';

export function refreshUnitPicker(form) {   // form: the id prefix, "appConf" or "apv"
  const picker = document.getElementById(form + 'UnitPicker');
  const hint = document.getElementById(form + 'UnitPickerHint');
  if (!picker) return;
  const building = document.getElementById(form + 'Building').value;
  const matches = state.units.filter(u => u.building && bldgNum(u.building) === bldgNum(building));
  if (matches.length === 0) {
    picker.style.display = 'none';
    if (hint) hint.textContent = '(type manually — no showsheet loaded for this building)';
    return;
  }
  picker.style.display = 'block';
  if (hint) hint.textContent = '(pick from showsheet or type below)';
  let html = '<option value="">— Pick from showsheet —</option>';
  matches.forEach(u => {
    const label = `#${u.unit}${u.monthly ? ' · $' + formatRent(u.monthly) : ''}${u.bedroomGroup ? ' · ' + u.bedroomGroup.toLowerCase() : ''}`;
    html += `<option value="${escapeHtml(String(u.unit))}">${escapeHtml(label)}</option>`;
  });
  picker.innerHTML = html;
}
