// Training quiz: 30 questions from the bank, 80% to pass; leaving early needs the manager PIN.
import { escapeHtml as esc } from '../../shared/html.js';
import { APPLICATION_FEE, GUARANTOR_MULTIPLE, INCOME_MULTIPLE } from '../../shared/requirements.js';
import { team } from '../../shared/team.js';
import { STAFF } from './buildings.js';
import { CONFIG } from './firebase.js';
import { $ } from './ui.js';

// ---------- Quiz bank ----------
// Each: [question, correct, [distractors...], category]
const BLDGS = ['2050','2120','2040','2110','2230'];
const others = (correct, pool) => pool.filter(x => x !== correct);
const QUIZ_BANK = [
  // Application
  ['A tenant must earn at least how many times the monthly rent?', `${INCOME_MULTIPLE}×`, ['40×', '50×', `${GUARANTOR_MULTIPLE}×`], 'Application'],
  ['A guarantor must earn at least how many times the monthly rent?', `${GUARANTOR_MULTIPLE}×`, [`${INCOME_MULTIPLE}×`, '60×', '80×'], 'Application'],
  ['What is the application fee?', `$${APPLICATION_FEE} per person`, ['$50 per person', `$${APPLICATION_FEE} per application`, '$100 per apartment'], 'Application'],
  ['What is due at lease signing?', 'Security deposit (one month) and first month\'s rent', ['First month\'s rent only', 'First and last month\'s rent', 'Two months\' security'], 'Application'],
  ['How many recent paystubs does a W-2 applicant upload?', 'Three', ['One', 'Two', 'Six'], 'Application'],
  ['Which tax returns does a self-employed applicant upload?', 'Personal returns only, all pages, for the two most recent years', ['Business returns only', 'Personal and business returns', 'The most recent year only'], 'Application'],
  ['A self-employed applicant who prepared their own returns uploads what in place of a CPA letter?', 'IRS tax transcripts for each year', ['A bank letter', 'A notarized statement', 'Nothing — the returns are enough'], 'Application'],
  ['Which two documents are specific to a student applicant?', 'School schedule and I-20', ['Paystubs and W-2', 'CPA letter and transcripts', 'Offer letter and passport'], 'Application'],
  ['Which of these is NOT accepted as an uploaded document?', 'A screenshot', ['An original PDF with all pages', 'A bank statement, all pages', 'A landlord reference letter'], 'Application'],
  // Buildings — opened / size
  ['When did 2050 Tidemark Blvd open?', 'May 2016', ['July 2009', 'March 2015', 'April 2018'], 'Buildings'],
  ['When did 2230 Tidemark Blvd open?', 'July 2009', ['May 2016', 'July 2015', 'April 2018'], 'Buildings'],
  ['When did 2110 Tidemark Blvd open?', 'April 2018', ['May 2016', 'March 2015', 'July 2009'], 'Buildings'],
  ['When did 2120 Tidemark Blvd open?', 'March 2015', ['July 2015', 'May 2016', 'April 2018'], 'Buildings'],
  ['When did 2040 Tidemark Blvd open?', 'July 2015', ['March 2015', 'July 2009', 'May 2016'], 'Buildings'],
  ['How many units are in 2050 Tidemark Blvd?', '640', ['420', '512', '288'], 'Buildings'],
  ['How many units are in 2230 Tidemark Blvd?', '420', ['640', '276', '512'], 'Buildings'],
  ['How many units are in 2110 Tidemark Blvd?', '512', ['420', '288', '640'], 'Buildings'],
  ['How many units are in 2120 Tidemark Blvd?', '288', ['276', '420', '512'], 'Buildings'],
  ['How many units are in 2040 Tidemark Blvd?', '276', ['288', '420', '512'], 'Buildings'],
  ['Which buildings have dual elevators?', '2050 and 2230', ['2110 and 2120', '2040 and 2050', '2120 and 2230'], 'Buildings'],
  ['Which building has no gym?', '2040', ['2120', '2110', '2230'], 'Buildings'],
  ['Which building has no outdoor space?', '2120', ['2040', '2110', '2050'], 'Buildings'],
  ['On what floor is the 2050 outdoor space?', '7th', ['1st', '11th', '2nd'], 'Buildings'],
  ['On what floors is the 2230 outdoor space?', '1st and 11th', ['1st and 8th', '7th', '2nd and 11th'], 'Buildings'],
  ['On what floors is the 2110 outdoor space?', '1st and 8th', ['1st and 11th', '7th', '2nd'], 'Buildings'],
  ['At which building are incentives applied to the last month of the lease?', '2110', ['2050', '2230', '2040'], 'Buildings'],
  ['Which building charges a $40/month amenity fee?', '2050', ['2230', '2110', '2120'], 'Buildings'],
  ['Which buildings have laundry on every floor?', '2050 and 2230', ['2110 and 2120', '2040 and 2110', '2120 and 2230'], 'Buildings'],
  ['Which building is next to the Tidemark Landing ferry stop?', '2040', ['2050', '2230', '2110'], 'Buildings'],
  // Amenities & policies
  ['What is the hourly rate to rent the 2050 lounge?', '$180/hr', ['$120/hr', '$150/hr', '$400/hr'], 'Policies'],
  ['What is the hourly rate to rent the 2230 lounge?', '$120/hr', ['$180/hr', '$60/hr', '$400/hr'], 'Policies'],
  ['When can a lounge be reserved for a private function?', 'Monday–Thursday and the 2nd and 4th weekends, no holidays', ['Any day of the week', 'Weekends only', 'Monday–Friday only'], 'Policies'],
  ['What is the pet policy?', '2 pets up to 60 lbs combined (non-aggressive breeds), no pet fee', ['1 dog under 50 lbs, $500 fee', '2 cats only', 'Any pets with a monthly fee'], 'Policies'],
  ['Which utilities are included in the rent?', 'Heat, gas, and water', ['Electricity and internet', 'Heat and electricity', 'All utilities'], 'Policies'],
  ['What is the standard ceiling height?', '8.5 ft', ['9 ft', '10 ft', '8 ft'], 'Policies'],
  ['Which building offers Citywide Fiber?', '2230', ['2050', '2110', '2040'], 'Policies'],
  ['Which internet providers are available in every building?', 'Metro Cable and Bluewave Internet', ['Citywide Fiber and Metro Cable', 'Brightline Fiber and Citywide Fiber', 'Bluewave Internet only'], 'Policies'],
  ['A prospect asks, "What voucher programs do you participate in?" What do you say?', 'We participate in all programs', ['NYCHA only', 'HPD only', 'CityFHEPS only'], 'Policies'],
  ['A prospect asks whether we accept third-party guarantors. What do you say?', 'Yes — speak to the agent for the qualifying criteria', ['No, only personal guarantors', 'Yes, with no additional requirements', 'Only for students'], 'Policies'],
  ['Does the listed square footage include outdoor space?', 'No', ['Yes', 'Only for terraces', 'Only for balconies'], 'Policies'],
  ['Who manages the parking garage attached to 2050?', 'A third party', ['Larkspur Residential', 'The 2050 building manager', 'Resident Services'], 'Policies'],
  // Transit
  ['Where does the shuttle pick up?', '2040 and 2230', ['2050 and 2110', '2120 and 2230', 'All five buildings'], 'Transit'],
  ['Which subway station does the shuttle serve?', 'Harbor Street (Harbor Line)', ['Market Square (Crosstown Line)', 'Pier Street (Harbor Line)', 'Market Square/10th St (Express Line)'], 'Transit'],
  ['How far is the Crosstown Line at Market Square?', 'About 7 blocks', ['About 2 blocks', 'About 12 blocks', 'About 20 blocks'], 'Transit'],
  ['Which subway station is one stop from Midtown?', 'Harbor Street', ['Market Square', 'Pier Street', '9th St'], 'Transit'],
  ['Which ferry stop is south of Waterfront Park?', 'Harbor Point South', ['Tidemark Landing', 'North Pier', 'Canal Basin'], 'Transit'],
  // People
  ...BLDGS.map(b => [`Who is the leasing specialist for ${b} Tidemark Blvd?`, STAFF[b].ls, others(STAFF[b].ls, ['Renee Okafor','Helena Brandt','Diane Whitlock','Tamsin Reyes']), 'People']),
  ...BLDGS.map(b => [`Who is the building manager for ${b} Tidemark Blvd?`, STAFF[b].bm, others(STAFF[b].bm, ['Samir Haddad','Gregory Tan','Victor Lindqvist','Rafael Ortiz','Pavel Novak']).slice(0,3), 'People']),
  ['A resident asks about renewing their lease. Who handles that?', 'The Leasing Specialist for their building', ['The Building Manager', 'Resident Services', 'The leasing assistant who toured them'], 'People'],
  ['A resident wants to install something in their apartment. Who do they ask?', 'The Building Manager', ['The Leasing Specialist', 'Property Management', 'The front desk'], 'People'],
  ['Who is Property Management for all five buildings?', 'Diane Whitlock', ['Tamsin Reyes', 'Ilya Petrov', 'Samir Haddad'], 'People'],
  ['Who is the Resident Services Specialist?', 'Tamsin Reyes', ['Diane Whitlock', 'Helena Brandt', 'Kofi Mensah'], 'People'],
  // Quoting
  ['What does "OP" stand for?', 'Owner Pays (the broker fee)', ['Open Pricing', 'Optional Payment', 'Occupancy Premium'], 'Quoting'],
  ['How is net effective rent calculated?', 'Monthly rent averaged over the lease term after the concession', ['Rent minus the security deposit', 'Rent minus one month, divided by 11', 'Gross rent minus the amenity fee'], 'Quoting'],
  ['Where is a concession applied at every building except 2110?', 'Up front', ['The last month', 'Spread evenly across the lease', 'At renewal'], 'Quoting'],
];
const QUIZ_LENGTH = 30, QUIZ_PASS = 0.8;

// ---------- Quiz engine ----------
let quiz = null;   // { name, items:[{q,correct,options,category}], idx, answers:[], startedAt }
export let quizActive = false;
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
export function fillQuizNames() {
  const sel = $('quizNameSel'); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">Select your name…</option>` + team.assistants.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') + `<option value="__other__">Not on the list — type it</option>`;
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}
export function startQuiz() {
  fillQuizNames();
  const sel = $('quizNameSel');
  const name = sel.value === '__other__' ? ($('quizNameOther').value || '').trim() : (sel.value || '').trim();
  if (!name) { $('quizMsg').textContent = '⚠ Select your name to begin.'; $('quizMsg').className = 'savemsg err'; (sel.value === '__other__' ? $('quizNameOther') : sel).focus(); return; }
  // Balanced draw: take from each category proportionally, then shuffle
  const byCat = {}; QUIZ_BANK.forEach(q => { (byCat[q[3]] = byCat[q[3]] || []).push(q); });
  const cats = Object.keys(byCat); let picked = [];
  cats.forEach(c => { const n = Math.round(QUIZ_LENGTH * byCat[c].length / QUIZ_BANK.length); picked = picked.concat(shuffle(byCat[c]).slice(0, n)); });
  const rest = shuffle(QUIZ_BANK.filter(q => !picked.includes(q)));
  while (picked.length < QUIZ_LENGTH && rest.length) picked.push(rest.pop());
  picked = shuffle(picked).slice(0, QUIZ_LENGTH);
  quiz = { name, items: picked.map(([q, correct, d, category]) => ({ q, correct, category, options: shuffle([correct, ...d.slice(0, 3)]) })), idx: 0, answers: [], startedAt: new Date().toISOString() };
  quizActive = true;
  document.body.classList.add('quiz-mode'); $('quizBack').style.display = 'none';
  $('quizIntro').style.display = 'none'; $('quizResult').style.display = 'none'; $('quizRun').style.display = '';
  renderQuizQ();
}
function renderQuizQ() {
  const it = quiz.items[quiz.idx];
  $('quizProgress').textContent = `Question ${quiz.idx + 1} of ${quiz.items.length}`;
  $('quizBar').style.transform = `scaleX(${quiz.idx / quiz.items.length})`;
  $('quizCat').textContent = it.category;
  $('quizQ').textContent = it.q;
  $('quizOpts').innerHTML = it.options.map((o, i) => `<button class="qopt" onclick="answerQuiz(${i})">${esc(o)}</button>`).join('');
  window.scrollTo(0, 0);
}
export function answerQuiz(i) {
  const it = quiz.items[quiz.idx];
  quiz.answers.push({ q: it.q, category: it.category, chosen: it.options[i], correct: it.correct, ok: it.options[i] === it.correct });
  quiz.idx++;
  if (quiz.idx < quiz.items.length) renderQuizQ(); else finishQuiz();
}
async function finishQuiz() {
  const total = quiz.items.length, right = quiz.answers.filter(a => a.ok).length, pct = Math.round(right / total * 100), passed = right / total >= QUIZ_PASS;
  const missed = quiz.answers.filter(a => !a.ok);
  const result = { name: quiz.name, dateIso: new Date().toISOString(), startedAtIso: quiz.startedAt, score: right, total, pct, passed, missed: missed.map(m => ({ q: m.q, chosen: m.chosen, correct: m.correct, category: m.category })) };
  quizActive = false; document.body.classList.remove('quiz-mode'); $('quizBack').style.display = '';
  $('quizRun').style.display = 'none'; $('quizResult').style.display = '';
  $('quizScore').innerHTML = `<div class="big">${pct}%</div><div class="lbl">${right} of ${total} correct · ${passed ? 'PASSED' : 'Not passed — 80% needed'}</div>`;
  $('quizScore').className = 'result ' + (passed ? 'pass' : 'fail');
  $('quizMissed').innerHTML = missed.length ? `<h3>Review (${missed.length} missed)</h3>` + missed.map(m => `<div class="miss"><div class="mq">${esc(m.q)}</div><div class="mw">Your answer: ${esc(m.chosen)}</div><div class="mc">Correct: ${esc(m.correct)}</div></div>`).join('') : '<p class="lead">Perfect score.</p>';
  let saved = 'Result saved.';
  try { await firebase.firestore().collection('quiz_results').add(result); } catch (e) { console.error(e); saved = 'Result could not be saved (' + (e.message || e) + '). Take a screenshot of this screen.'; }
  $('quizSaved').textContent = saved;
}
// Exiting mid-quiz needs the supervisor PIN (same one that unlocks results on the Leasing Desk),
// so a test-taker can't bail out, study the cheat sheet, and restart.
export const QUIZ_EXIT_PIN = CONFIG.managerPin;   // from config.js (.env); a deterrent, not security (D4)
export function quitQuiz() {
  const pin = prompt('Supervisor PIN to exit the quiz (answers so far will not be saved):');
  if (pin === null) return;
  if (pin.trim() !== QUIZ_EXIT_PIN) { alert('Incorrect PIN. The quiz stays open — finish it or ask a manager to exit.'); return; }
  quizActive = false; document.body.classList.remove('quiz-mode'); $('quizBack').style.display = '';
  $('quizRun').style.display = 'none'; $('quizIntro').style.display = '';
}
export function resetQuiz() { $('quizResult').style.display = 'none'; $('quizIntro').style.display = ''; $('quizMsg').textContent = ''; }
