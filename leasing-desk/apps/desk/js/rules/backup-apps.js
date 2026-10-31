// "Backup apps welcome" in the Tour and Inquiry Follow-Up emails (production D49): an apartment whose unit cell is orange on
// today's showsheet (an application is in but likely won't go through) gets one neutral line under "Available …". It is looked up
// on today's showsheet, so it goes away when the orange comes off; an apartment typed in by hand never gets it. Never "weak".
import { unitSelectKey } from '../units.js';

export const BACKUP_LINE = "An application is in progress on this apartment; we're happy to take a backup application.";
export function backupAppsLine(selected, units) {
  if (!selected || selected.custom) return '';
  const live = (units || []).find(u => unitSelectKey(u) === selected.key);
  return live && live.backupApps ? `<p style="margin:0; padding:0; font-weight:normal; text-decoration:none;"><em>${BACKUP_LINE}</em></p>` : '';
}
