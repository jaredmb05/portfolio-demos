// Tab bar and the More menu.
import { renderCheatSheet } from './cheat-sheet.js';
import { fillQuizNames, quizActive } from './quiz.js';
import { $ } from './ui.js';

// ---------- Tabs ----------
export function go(p) {
  if (quizActive) return;   // locked while a quiz is in progress
  ['list','tour','req','more'].forEach(k => {
    $('page' + k[0].toUpperCase() + k.slice(1)).classList.toggle('on', k === p);
    $('tab-' + k).classList.toggle('on', k === p);
    if (k === p) $('tab-' + k).setAttribute('aria-current', 'page'); else $('tab-' + k).removeAttribute('aria-current');
  });
  if (p === 'more') moreBack();
  document.querySelector('header h1').textContent = { list: 'Availability', tour: 'Tour Planner', req: 'Requirements', more: 'More' }[p];
  window.scrollTo(0, 0);
}
export function moreOpen(which) {
  $('moreMenu').style.display = 'none';
  ['Calc','Cheat','Quiz'].forEach(k => { $('more' + k).style.display = k.toLowerCase() === which ? '' : 'none'; });
  document.querySelector('header h1').textContent = { calc: 'Net Rent Calculator', cheat: 'Building Cheat Sheet', quiz: 'Training Quiz' }[which];
  if (which === 'cheat') renderCheatSheet();
  if (which === 'quiz') { fillQuizNames(); $('quizIntro').style.display = ''; $('quizRun').style.display = 'none'; $('quizResult').style.display = 'none'; }
  window.scrollTo(0, 0);
}
export function moreBack() {
  if (quizActive) return;
  $('moreMenu').style.display = '';
  ['Calc','Cheat','Quiz'].forEach(k => { $('more' + k).style.display = 'none'; });
  document.querySelector('header h1').textContent = 'More';
}
