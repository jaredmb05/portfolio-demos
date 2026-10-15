// What the shared modules need from the app that loads them. Each app's main.js fills these in at startup.

export const hooks = {
  toast: () => {},                   // show a message: (text, isError)
  onAppointmentsChanged: () => {},   // redraw after an Outlook-slot answer changes
  onWaitPanelToggled: () => {},      // redraw after a wait panel opens or folds
};
