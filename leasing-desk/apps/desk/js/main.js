// Leasing Desk entry point: exposes the functions the HTML calls, then starts the app.
import { toggleOut, watchAvailability } from '../../shared/availability.js';
import { linkFieldLabels } from '../../shared/dom.js';
import { hooks } from '../../shared/hooks.js';
import { setApptExact, watchAppointments } from '../../shared/wait-estimate.js';
import { toggleWaitPanel } from '../../shared/wait-panel.js';
import { formatAppConfMoveIn, onAppConfBuildingChange, onAppConfFloorPlanToggle, onAppConfGreetingPreset, onAppConfIncentiveToggle, onAppConfTypeToggle, onAppConfUnitInput, onAppConfUnitPick, updateAppConfTaxYearsHint } from './application-email.js';
import { formatApvDate, onApvAssignmentToggle, onApvBuildingChange, onApvConcFracChange, onApvFloorPlanToggle, onApvIncentiveToggle, onApvInitialRentInput, onApvNextRentToggle, onApvReducedSecurityToggle, onApvRentInput, onApvUnitInput, onApvUnitPick } from './approval-email.js';
import { loadState } from './browser-storage.js';
import { copyAsHTML, copyAsPlainText } from './clipboard.js';
import { watchConnection } from './connection.js';
import { dbxSync, openDbxSettings, saveDbxSettings, testDbx, turnOffDbx, watchDropboxSync } from './dropbox.js';
import { copySubjectLine, onUnavailableManualToggle, onUnavailablePick, refreshUnavailablePicker, renderPreview, resetEmail, setMode, toggleUnavailable, updateWelcomeUi } from './email-builder.js';
import { flAddManual, flDelete, flIcs, flSetStatus, watchFutureLeads } from './future-leads.js';
import { endTour, jumpTourTo, startGuidedTour, tourStep } from './guided-tour.js';
import { historyMore, queueOpenHistory, renderHistoryList, reopenFromHistory, toggleHistoryDay } from './history.js';
import { onPfaHoursInput, onPfaLoungeChange, setPfaSubMode } from './pfa-email.js';
import { clearActiveTour, openPlanTour, saveUnitsToTour, setPlanKind, submitPlanTour } from './plan-tour.js';
import { copyCheckIn, copyHeadsUp, copyProspectEmail, deleteQueueTour, markCheckInSent, markFollowUpSent, queueAssign, queueFinish, queueOpen, queueRestartNow, queueStart, renderTourQueue, renderWaitBar, setQueueTab, toggleQueuePanel, watchTourQueue } from './queue.js';
import { clearFloorPlans, clearShowsheet, handleFloorPlanSheet, handleShowsheet, loadPublishedMeta, publishShowsheet } from './showsheet.js';
import { addAssistantDesk, lockManager, removeAssistantDesk, setScheduleDay, unlockManager, watchAssistants } from './staff.js';
import { state } from './state.js';
import { loadWelcomeTplForEdit, openTemplateEditor, saveTemplate, switchTplTab } from './template-editor.js';
import { toggleMissed, toggleTraining } from './training.js';
import { openHelp, toast } from './ui.js';
import { addCustomUnit, clearSelections, removeSelected, renderUnitList, setEmailBroker, setQuickFilter, toggleCollapse, toggleSelectedFlag, toggleUnit, updateSelected } from './unit-list.js';

hooks.toast = toast;
hooks.onAppointmentsChanged = renderTourQueue;
hooks.onWaitPanelToggled = renderTourQueue;

// The HTML calls these by name from inline on* handlers (in index.html and in the markup the render functions build)
Object.assign(window, {
  addAssistantDesk, addCustomUnit, clearActiveTour, clearFloorPlans, clearSelections, clearShowsheet,
  copyAsHTML, copyAsPlainText, copyCheckIn, copyHeadsUp, copyProspectEmail, copySubjectLine, dbxSync,
  deleteQueueTour, endTour, flAddManual, flDelete, flIcs, flSetStatus, formatAppConfMoveIn, formatApvDate,
  handleFloorPlanSheet, handleShowsheet, historyMore, jumpTourTo, loadWelcomeTplForEdit, lockManager,
  markCheckInSent, markFollowUpSent, onAppConfBuildingChange, onAppConfFloorPlanToggle,
  onAppConfGreetingPreset, onAppConfIncentiveToggle, onAppConfTypeToggle, onAppConfUnitInput,
  onAppConfUnitPick, onApvAssignmentToggle, onApvBuildingChange, onApvConcFracChange, onApvFloorPlanToggle,
  onApvIncentiveToggle, onApvInitialRentInput, onApvNextRentToggle, onApvReducedSecurityToggle, onApvRentInput,
  onApvUnitInput, onApvUnitPick, onPfaHoursInput, onPfaLoungeChange, onUnavailableManualToggle,
  onUnavailablePick, openDbxSettings, openHelp, openPlanTour, openTemplateEditor, publishShowsheet,
  queueAssign, queueFinish, queueOpen, queueOpenHistory, queueRestartNow, queueStart, removeAssistantDesk,
  removeSelected, renderHistoryList, renderPreview, renderTourQueue, renderUnitList, reopenFromHistory,
  resetEmail, saveDbxSettings, saveTemplate, saveUnitsToTour, setApptExact, setMode, setPfaSubMode,
  setEmailBroker, setPlanKind, setQueueTab, setQuickFilter, setScheduleDay, startGuidedTour, submitPlanTour, switchTplTab,
  testDbx, toggleCollapse, toggleHistoryDay, toggleMissed, toggleOut, toggleQueuePanel, toggleSelectedFlag,
  toggleTraining, toggleUnavailable, toggleUnit, toggleWaitPanel, tourStep, turnOffDbx, unlockManager,
  updateSelected, updateWelcomeUi
});
// Variables those handlers assign by name, for example onchange="includeParking=this.checked"
for (const name of ['apvConcMonthTouched', 'apvCreditMonthTouched', 'flFormOpen', 'historyKind', 'historyQ', 'historyWho', 'includeParking', 'includeShuttle', 'pfaRentManual']) {
  Object.defineProperty(window, name, { get: () => state[name], set: value => { state[name] = value; } });
}

try { if (localStorage.getItem('ld_queueOpen') === '0') document.getElementById('queuePanel').classList.remove('open'); } catch (e) {}
linkFieldLabels(document);
loadState();
setMode(state.emailMode);
updateWelcomeUi();
renderUnitList();
updateAppConfTaxYearsHint();
refreshUnavailablePicker();
renderPreview();
loadPublishedMeta();
watchTourQueue();
watchAssistants();
watchAvailability(renderTourQueue);
watchAppointments(renderTourQueue);
watchDropboxSync();
watchFutureLeads();
watchConnection();
setInterval(renderWaitBar, 60000);
