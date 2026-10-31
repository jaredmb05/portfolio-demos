// Leasing Desk entry point: exposes the functions the HTML calls, then starts the app.
import { toggleOut, watchAvailability } from '../../shared/availability.js';
import { linkFieldLabels, moneyInput } from '../../shared/dom.js';
import { hooks } from '../../shared/hooks.js';
import { setApptExact, watchAppointments } from '../../shared/wait-estimate.js';
import { toggleWaitPanel } from '../../shared/wait-panel.js';
import { formatAppConfLeaseEnd, formatAppConfMoveIn, onAppConfAssignToggle, onAppConfBuildingChange, onAppConfFloorPlanToggle, onAppConfGreetingPreset, onAppConfIncentiveToggle, onAppConfTypeToggle, onAppConfUnitInput, onAppConfUnitPick, updateAppConfTaxYearsHint } from './application-email.js';
import { formatApvDate, onApvAssignmentToggle, onApvBuildingChange, onApvConcFracChange, onApvFloorPlanToggle, onApvIncentiveToggle, onApvInitialRentInput, onApvNextRentToggle, onApvReducedSecurityToggle, onApvRentInput, onApvUnitInput, onApvUnitPick } from './approval-email.js';
import { loadState } from './browser-storage.js';
import { copyAsHTML, copyAsPlainText } from './clipboard.js';
import { watchConnection } from './connection.js';
import { dbxSync, openDbxSettings, saveDbxSettings, testDbx, turnOffDbx, watchDropboxSync } from './dropbox.js';
import { copySubjectLine, onUnavailableManualToggle, onUnavailablePick, refreshUnavailablePicker, renderPreview, resetEmail, setMode, toggleUnavailable, updateWelcomeUi } from './email-builder.js';
import { flAddManual, flCopy, flDelete, flIcs, flSetStatus, watchFutureLeads } from './future-leads.js';
import { endTour, jumpTourTo, startGuidedTour, tourStep } from './guided-tour.js';
import { historyMore, queueOpenHistory, renderHistoryList, reopenFromHistory, toggleHistoryDay } from './history.js';
import { onPfaHoursInput, onPfaLoungeChange, setPfaSubMode } from './pfa-email.js';
import { clearActiveTour, openPlanTour, planRecheck, saveUnitsToTour, setPlanKind, submitPlanTour } from './plan-tour.js';
import { copyCheckIn, copyHeadsUp, deleteQueueTour, markCheckInSent, markFollowUpSent, pickCheckInAgent, queueAssign, queueFinish, queueOpen, queueRestartNow, queueStart, renderTourQueue, renderWaitBar, setQueueTab, toggleQueuePanel, watchTourQueue } from './queue.js';
import { clearFloorPlans, clearShowsheet, handleFloorPlanSheet, handleShowsheet, loadPublishedMeta, publishShowsheet } from './showsheet.js';
import { addAssistantDesk, lockManager, removeAssistantDesk, setScheduleDay, unlockManager, watchAssistants } from './staff.js';
import { state } from './state.js';
import { closePrintPick, openPrintPick, printPickAll, printPickSync, printPicked } from './reports-print.js';
import { downloadReportsXlsx } from './reports-xlsx.js';
import { openReports, refreshReports, setReportBldg, setReportNetSize, setReportRange, toggleMissed, toggleReportTable, toggleReports } from './reports.js';
import { startSeasons, toggleSnow } from './seasons.js';
import { loadWelcomeTplForEdit, openTemplateEditor, saveTemplate, switchTplTab } from './template-editor.js';
import { closeWeekPick, loadWeeklyTrends, pickCell, setTimeExcluded, weekNav } from './tour-times.js';
import { openHelp, scrollToTopOfPage, toast } from './ui.js';
import { addCustomUnit, clearSelections, removeSelected, renderUnitList, setEmailBroker, setQuickFilter, toggleCollapse, toggleSelectedFlag, toggleUnit, updateSelected } from './unit-list.js';

hooks.toast = toast;
hooks.onAppointmentsChanged = renderTourQueue;
hooks.onWaitPanelToggled = renderTourQueue;

// The HTML calls these by name from inline on* handlers (in index.html and in the markup the render functions build)
Object.assign(window, {
  addAssistantDesk, addCustomUnit, clearActiveTour, clearFloorPlans, clearSelections, clearShowsheet, closePrintPick, closeWeekPick,
  copyAsHTML, copyAsPlainText, copyCheckIn, copyHeadsUp, copySubjectLine, dbxSync,
  deleteQueueTour, downloadReportsXlsx, endTour, flAddManual, flCopy, flDelete, flIcs, flSetStatus, formatAppConfLeaseEnd, formatAppConfMoveIn, formatApvDate,
  handleFloorPlanSheet, handleShowsheet, historyMore, jumpTourTo, loadWeeklyTrends, loadWelcomeTplForEdit, lockManager,
  markCheckInSent, markFollowUpSent, moneyInput, onAppConfAssignToggle, onAppConfBuildingChange, onAppConfFloorPlanToggle,
  onAppConfGreetingPreset, onAppConfIncentiveToggle, onAppConfTypeToggle, onAppConfUnitInput,
  onAppConfUnitPick, onApvAssignmentToggle, onApvBuildingChange, onApvConcFracChange, onApvFloorPlanToggle,
  onApvIncentiveToggle, onApvInitialRentInput, onApvNextRentToggle, onApvReducedSecurityToggle, onApvRentInput,
  onApvUnitInput, onApvUnitPick, onPfaHoursInput, onPfaLoungeChange, onUnavailableManualToggle,
  onUnavailablePick, openDbxSettings, openHelp, openPlanTour, openPrintPick, openReports, openTemplateEditor, pickCell, pickCheckInAgent,
  planRecheck, printPickAll, printPickSync, printPicked, publishShowsheet,
  queueAssign, queueFinish, queueOpen, queueOpenHistory, queueRestartNow, queueStart, refreshReports, removeAssistantDesk,
  removeSelected, renderHistoryList, renderPreview, renderTourQueue, renderUnitList, reopenFromHistory,
  resetEmail, saveDbxSettings, saveTemplate, saveUnitsToTour, scrollToTopOfPage, setApptExact, setMode, setPfaSubMode,
  setEmailBroker, setPlanKind, setQueueTab, setQuickFilter, setReportBldg, setReportNetSize, setReportRange, setScheduleDay,
  setTimeExcluded, startGuidedTour, submitPlanTour, switchTplTab,
  testDbx, toggleCollapse, toggleHistoryDay, toggleMissed, toggleOut, toggleQueuePanel, toggleReportTable, toggleReports, toggleSnow,
  toggleSelectedFlag, toggleUnavailable, toggleUnit, toggleWaitPanel, tourStep, turnOffDbx, unlockManager,
  updateSelected, updateWelcomeUi, weekNav
});
// Variables those handlers assign by name, for example onchange="includeParking=this.checked"
for (const name of ['apvAsIsTouched', 'apvConcMonthTouched', 'apvCreditMonthTouched', 'flFormOpen', 'historyKind', 'historyQ', 'historyWho', 'includeParking', 'includeShuttle', 'pfaRentManual']) {
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
startSeasons();
setInterval(renderWaitBar, 60000);
