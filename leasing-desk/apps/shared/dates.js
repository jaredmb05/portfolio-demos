// Local calendar dates as YYYY-MM-DD (the form Firestore keys and date inputs use), month names, and clock times.

export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayYmd = () => ymd(new Date());
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// "2:10 PM" for an ISO timestamp; '' when there is none
export const clockTime = iso => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
// Is this ISO timestamp on today's calendar date (local time)?
export const isTodayIso = (iso, now = new Date()) => !!iso && new Date(iso).toDateString() === new Date(now).toDateString();
