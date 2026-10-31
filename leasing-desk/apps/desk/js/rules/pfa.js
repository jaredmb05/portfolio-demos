// Lounge rental (PFA) money and dates.

export const PFA_LOUNGE_RATES = { '2050': 180, '2230': 120 };  // $/hr — mirrors the Step 1 body text
// Rental fee = hours × the lounge's hourly rate, in whole dollars; null when either is missing
export const pfaFee = (hours, rate) => rate && hours > 0 ? Math.round(hours * rate) : null;
// Checks are due 7 days after the agreement is signed
export function pfaDueDate(signed) { const due = new Date(signed); due.setDate(due.getDate() + 7); return due; }
