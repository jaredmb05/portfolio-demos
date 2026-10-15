// Training quiz results (manager PIN).
import { escapeHtml, jsArg } from '../../shared/html.js';
import { CONFIG, fbDb } from './firebase.js';
import { state } from './state.js';
import { toast } from './ui.js';

// ===== Training quiz results (PIN-gated view) =====
export const TRAINING_PIN = CONFIG.managerPin;   // from config.js (.env); a deterrent, not security (D4)
export async function toggleTraining() {
  const panel = document.getElementById('trainingPanel');
  const tt = document.getElementById('trainingToggle');
  if (panel.classList.contains('open')) { panel.classList.remove('open'); tt.textContent = 'Show'; tt.setAttribute('aria-expanded', 'false'); return; }
  if (!state.trainingUnlocked) {
    const pin = prompt('Enter the PIN to view quiz results:'); if (pin === null) return;
    if (pin.trim() !== TRAINING_PIN) { toast('Incorrect PIN', true); return; }
    state.trainingUnlocked = true;
  }
  panel.classList.add('open'); tt.textContent = 'Hide'; tt.setAttribute('aria-expanded', 'true');
  document.getElementById('trainingLock').style.display = '';
  await loadTrainingResults();
}
async function loadTrainingResults() {
  const body = document.getElementById('trainingBody'); body.innerHTML = '<div class="empty">Loading quiz results…</div>';
  const db = fbDb(); if (!db) { body.innerHTML = '<div class="empty">The database didn’t load — check the connection and reload the page.</div>'; return; }
  try {
    const snap = await db.collection('quiz_results').orderBy('dateIso', 'desc').limit(200).get();
    const rows = []; snap.forEach(d => rows.push(Object.assign({ _id: d.id }, d.data())));
    document.getElementById('trainingMeta').textContent = `— ${rows.length} attempt${rows.length===1?'':'s'} · ${rows.filter(r => r.passed).length} passed`;
    if (!rows.length) { body.innerHTML = '<div class="empty">No quiz attempts yet.</div>'; return; }
    const fmt = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    body.innerHTML = rows.map((r, i) => `
      <div class="queue-row" style="grid-template-columns: 28px 1fr auto auto;">
        <div class="n">${i + 1}</div>
        <div><div class="who">${escapeHtml(r.name || '(no name)')} <span class="flag ${r.passed ? 'pass' : 'fail'}" style="margin-left:6px;">${r.passed ? 'Passed' : 'Not passed'}</span></div>
          <div class="sub">${(r.missed || []).length ? `Missed: ${Object.entries((r.missed || []).reduce((acc, m) => { acc[m.category] = (acc[m.category] || 0) + 1; return acc; }, {})).map(([c, n]) => `${escapeHtml(c)} ×${n}`).join(', ')}` : 'No misses'}</div></div>
        <div class="when"><strong>${escapeHtml(r.pct)}%</strong> · ${escapeHtml(r.score)}/${escapeHtml(r.total)} · ${fmt(r.dateIso)}</div>
        <div class="row" style="justify-content:flex-end;"><button class="tiny ghost" onclick='toggleMissed(${jsArg(r._id)})'>Details</button></div>
      </div>
      <div id="missed-${escapeHtml(r._id)}" style="display:none; padding:4px 0 10px 40px; font-size:12px;">
        ${(r.missed || []).length ? (r.missed || []).map(m => `<div style="padding:5px 0; border-top:1px solid var(--line-soft);"><div><strong>${escapeHtml(m.q)}</strong></div><div style="color:var(--red);">Answered: ${escapeHtml(m.chosen)}</div><div style="color:var(--green);">Correct: ${escapeHtml(m.correct)}</div></div>`).join('') : '<em>Perfect score.</em>'}
      </div>`).join('');
  } catch (e) { console.error(e); body.innerHTML = `<div class="empty">Couldn't load quiz results — no connection to the database. Hide and show this panel to try again.</div>`; }
}
export function toggleMissed(id) { const el = document.getElementById('missed-' + id); if (el) el.style.display = el.style.display === 'none' ? '' : 'none'; }
