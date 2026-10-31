// What applicants are asked for, shown on both apps.

// Income needed, as a multiple of the monthly rent, and the application fee per applicant
export const INCOME_MULTIPLE = 45, GUARANTOR_MULTIPLE = 75, APPLICATION_FEE = 20;

// Tax years requested from self-employed applicants: the two years before the current year,
// but the flip waits until after Tax Day (April 16) — before that, most haven't filed the prior year.
// Extension fallback goes one further back.

const TAX_DAY = { month: 3, day: 16 };  // April 16 (month is 0-based)
export function taxYears(now = new Date()) {
  let y = now.getFullYear();
  const flipped = now.getMonth() > TAX_DAY.month ||
    (now.getMonth() === TAX_DAY.month && now.getDate() >= TAX_DAY.day);
  if (!flipped) y -= 1;
  return { y1: y - 1, y2: y - 2, y3: y - 3 };
}
