// Tour Companion entry point: exposes the functions the HTML calls, then starts the app.
import { linkFieldLabels } from '../../shared/dom.js';
import { escapeHtml as esc } from '../../shared/html.js';
import { typeSelectHtml, viewSelectHtml } from '../../shared/unit-options.js';
import { chips, render, setFilter } from './availability-list.js';
import { calc } from './calculator.js';
import { go, moreBack, moreOpen } from './navigation.js';
import { answerQuiz, quitQuiz, resetQuiz, startQuiz } from './quiz.js';
import { fillRules, fillSelf, showDoc } from './requirements.js';
import { setFooters, start, trackStickyHeights } from './showsheet-feed.js';
import { addAssistant, onAssistantSelect, removeAssistant, toggleAssistantManage } from './staff.js';
import { state } from './state.js';
import { deleteTour, openTour } from './todays-tours.js';
import { closeTour, editTour, fillBrokerNote, finishFromList, finishTour, loadTourLocal, newEntry, sendToQueue, startTour, takeTour, toggleGuest, toggleNeedBed, tourChanged } from './tour-planner.js';
import { $ } from './ui.js';
import { addCustomStop, renderPickChips, renderPicker, toggleCustomForm, toggleStop, toggleStopCollapse, undoRemoveStop, updStop } from './unit-picker.js';


// The HTML calls these by name from inline on* handlers (in index.html and in the markup the render functions build)
Object.assign(window, {
  addAssistant, addCustomStop, answerQuiz, calc, closeTour, deleteTour, editTour, finishFromList, finishTour,
  go, moreBack, moreOpen, newEntry, onAssistantSelect, openTour, quitQuiz, removeAssistant, render,
  renderPickChips, renderPicker, resetQuiz, sendToQueue, setFilter, showDoc, startQuiz,
  startTour, takeTour, toggleAssistantManage, toggleCustomForm, toggleGuest, toggleNeedBed,
  toggleStop, toggleStopCollapse, tourChanged, undoRemoveStop, updStop
});
// Variables those handlers assign by name, for example onchange="pickFilter='all'"
for (const name of ['managerUnlocked', 'pickFilter']) {
  Object.defineProperty(window, name, { get: () => state[name], set: value => { state[name] = value; } });
}

// ---------- boot ----------
trackStickyHeights(); linkFieldLabels(document); setFooters();
chips(); renderPickChips(); fillRules(); fillBrokerNote(); fillSelf(); calc(); loadTourLocal(); start();
// Custom-unit dropdowns are ready from the start (not only after the form is opened)
(() => { const sel = $('cuView'); if (sel && !sel.options.length) sel.outerHTML = viewSelectHtml('', '', esc, 'cuView'); const ts = $('cuType'); if (ts && !ts.options.length) ts.outerHTML = typeSelectHtml('', '', esc, 'cuType'); })();
if ('serviceWorker' in navigator && !(window.APP_CONFIG || {}).demo) navigator.serviceWorker.register('sw.js').catch(() => {});   // the demo works offline without it
