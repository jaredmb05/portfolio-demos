// Leasing assistants: the shared list, the picker, and who is in today.
import { escapeHtml as esc, jsArg } from '../../shared/html.js';
import { team } from '../../shared/team.js';
import { QUIZ_EXIT_PIN } from './quiz.js';
import { state } from './state.js';
import { renderQueue } from './todays-tours.js';
import { renderTakeRow, tourChanged } from './tour-planner.js';
import { $, toast } from './ui.js';

export function watchAssistants() {
  try {
    firebase.firestore().collection('settings').doc('assistants').onSnapshot(snap => {
      if (snap.exists && Array.isArray(snap.data().names) && snap.data().names.length) team.assistants = snap.data().names.slice();
      renderAssistantSelect(); renderAssistantList(); renderQueue(); if (state.tour.active) renderTakeRow();
    }, err => console.warn('assistants', err));
  } catch (e) {}
}
async function saveAssistants() {
  if (!state.managerUnlocked) { alert('Unlock with the manager PIN first.'); return; }
  try { await firebase.firestore().collection('settings').doc('assistants').set({ names: team.assistants, updatedAtIso: new Date().toISOString() }); }
  catch (e) { toast('Couldn’t save the assistant list — ' + (e.message || e), true); }
}
export function renderAssistantSelect() {
  const sel = $('tAssistant'); if (!sel) return;
  const cur = state.tour.assistant || '';
  const names = team.assistants.slice(); if (cur && !names.includes(cur)) names.push(cur);
  names.sort((a, b) => a.localeCompare(b));   // the whole team A to Z, no "suggested next" (D20)
  sel.innerHTML = `<option value="">Unassigned — any assistant can take it</option>` + names.map(n => `<option value="${esc(n)}" ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('') + `<option value="__manage__">Edit list…</option>`;
}
export function onAssistantSelect(v) {
  if (v === '__manage__') {
    renderAssistantSelect();
    if (!state.managerUnlocked) { const pin = prompt('Manager PIN to edit the assistant list:'); if (pin === null) return; if (pin.trim() !== QUIZ_EXIT_PIN) { alert('Incorrect PIN.'); return; } state.managerUnlocked = true; }
    toggleAssistantManage(true); return;
  }
  tourChanged();
}
export function toggleAssistantManage(open) { $('assistantManage').style.display = open ? '' : 'none'; if (open) { renderAssistantList(); $('assistantNew').focus(); } }
function renderAssistantList() {
  const box = $('assistantList'); if (!box) return;
  box.innerHTML = team.assistants.map(n => `<span class="aname">${esc(n)}<button title="Remove ${esc(n)}" onclick="removeAssistant(${jsArg(n)})">×</button></span>`).join('');
}
export async function addAssistant() {
  const n = ($('assistantNew').value || '').trim(); if (!n) return;
  if (!team.assistants.includes(n)) team.assistants.push(n);
  $('assistantNew').value = ''; renderAssistantSelect(); renderAssistantList(); await saveAssistants();
}
export async function removeAssistant(n) {
  if (!confirm(`Remove ${n} from the list?`)) return;
  team.assistants = team.assistants.filter(x => x !== n); renderAssistantSelect(); renderAssistantList(); await saveAssistants();
}
