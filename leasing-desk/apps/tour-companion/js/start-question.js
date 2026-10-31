// "Did this tour start earlier?" (production D26): asked instead of the usual Finish confirm when Finish comes within a
// minute of Start on a tour. Resolves to null (Cancel), { startIso: null } (finish as is) or { startIso } (finish with that
// start). Classes are .startq*, because .sheet is already the iPad's page card.
import { clockTime } from '../../shared/dates.js';
import { escapeHtml as esc } from '../../shared/html.js';
import { otherStartIso, pickerStart, setUpStartIso } from '../../shared/start-time.js';

export function askStartTime(r) {
  return new Promise(resolve => {
    const setUp = setUpStartIso(r), back = document.activeElement;
    const bg = document.createElement('div'); bg.className = 'startq-bg';
    bg.innerHTML = `<div class="startq" role="dialog" aria-modal="true" aria-labelledby="startqTitle">
      <h3 id="startqTitle">Did this tour start earlier?</h3>
      <p>Start was tapped less than a minute ago, so ${esc(r.prospect || 'this')}’s tour would count as under a minute. When did it actually start?</p>
      ${setUp ? `<button class="btn" data-a="setup">Started when it was set up · ${esc(clockTime(setUp))}</button>` : ''}
      <div class="startq-time"><input type="time" id="startqTime" aria-label="Start time" value="${pickerStart(r)}"><button class="btn sec" data-a="time">Use this time</button></div>
      <div class="startq-err" id="startqErr" role="alert"></div>
      <button class="btn quiet" data-a="asis">It just started — finish anyway</button>
      <button class="btn quiet" data-a="cancel">Cancel</button></div>`;
    const done = v => { bg.remove(); if (back && back.focus) back.focus(); resolve(v); };
    bg.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'cancel') return done(null);
      if (a.dataset.a === 'asis') return done({ startIso: null });
      if (a.dataset.a === 'setup') return done({ startIso: setUp });
      const startIso = otherStartIso(bg.querySelector('#startqTime').value);
      if (!startIso) { bg.querySelector('#startqErr').textContent = 'Pick a time today, at least a minute before now.'; return; }
      done({ startIso });
    });
    bg.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); });
    document.body.appendChild(bg);
    (bg.querySelector('.btn') || bg).focus();
  });
}
