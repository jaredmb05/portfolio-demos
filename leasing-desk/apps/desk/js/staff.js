// Leasing assistants and the weekly schedule (manager PIN).
import { schedule } from '../../shared/availability.js';
import { team } from '../../shared/team.js';
import { fbDb } from './firebase.js';
import { renderTourQueue } from './queue.js';
import { state } from './state.js';
import { TRAINING_PIN } from './training.js';
import { toast } from './ui.js';

export async function setScheduleDay(name, day, on) {
  if (!state.trainingUnlocked) { toast('Unlock with the manager PIN first', true); renderTourQueue(); return; }
  const cur = schedule[name] ? schedule[name].slice() : [0,1,2,3,4,5,6];
  const next = on ? Array.from(new Set(cur.concat(day))).sort() : cur.filter(x => x !== day);
  const byName = Object.assign({}, schedule, { [name]: next });
  try { await firebase.firestore().collection('settings').doc('schedule').set({ byName, updatedAtIso: new Date().toISOString() }); }
  catch (e) { console.error(e); toast('Could not save schedule: ' + (e.message || e), true); }
}
export function watchAssistants() {
  const db = fbDb(); if (!db) return;
  db.collection('settings').doc('assistants').onSnapshot(snap => {
    if (snap.exists && Array.isArray(snap.data().names) && snap.data().names.length) team.assistants = snap.data().names.slice();
    renderTourQueue();
  }, err => console.warn('assistants', err));
}
export function lockManager() {
  state.trainingUnlocked = false;
  const tl = document.getElementById('trainingLock'); if (tl) tl.style.display = 'none';
  const tp = document.getElementById('trainingPanel'); if (tp) { tp.classList.remove('open'); const tt = document.getElementById('trainingToggle'); tt.textContent = 'Show'; tt.setAttribute('aria-expanded', 'false'); }
  renderTourQueue(); toast('Locked');
}
export function unlockManager() {
  const pin = prompt('Manager PIN:'); if (pin === null) return false;
  if (pin.trim() !== TRAINING_PIN) { toast('Incorrect PIN', true); return false; }
  state.trainingUnlocked = true; renderTourQueue(); return true;
}
async function saveAssistantsDesk(list) {
  if (!state.trainingUnlocked) { toast('Unlock with the manager PIN first', true); return; }
  const db = fbDb(); if (!db) return;
  try { await db.collection('settings').doc('assistants').set({ names: list, updatedAtIso: new Date().toISOString() }); team.assistants = list.slice(); renderTourQueue(); }
  catch (e) { console.error(e); toast('Could not save the assistant list: ' + (e.message || e), true); }
}
export function addAssistantDesk() {
  const el = document.getElementById('newAssistantName'); const n = (el.value || '').trim(); if (!n) return;
  if (team.assistants.includes(n)) { toast(`${n} is already on the list`, true); return; }
  saveAssistantsDesk(team.assistants.concat(n)); el.value = '';
}
export function removeAssistantDesk(n) {
  if (!confirm(`Remove ${n} from the leasing assistant list? Their past tours stay in History.`)) return;
  saveAssistantsDesk(team.assistants.filter(x => x !== n));
}
