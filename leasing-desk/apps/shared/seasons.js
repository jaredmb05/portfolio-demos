// Seasonal touches for the staff. Halloween 2026 on both apps (production D47), Oct 24 to Oct 31 local time: a 🎃 after the page
// title (the CSS draws it from body.halloween) and a 🍬 or 🍭 at the end of the message when work is done; the Desk also has its bat.
// The Desk's other seasons (production D50), every year: a turkey from Nov 1 until the Monday after Thanksgiving, then snow until
// Mar 31, each with its treat (desk/js/seasons.js draws them). The iPad keeps Halloween only, as production. Each app re-checks every
// 10 minutes, so an open page changes season at midnight. Never in emails, printouts or the database: callers only add a treat to
// on-screen messages.

export const SEASON_RECHECK_MS = 10 * 60 * 1000;
// The fourth Thursday of November in year y (local midnight)
export function thanksgivingDay(y) { const first = new Date(y, 10, 1).getDay(); return new Date(y, 10, 1 + (11 - first) % 7 + 21); }
// The season on this date: 'halloween' (Oct 24–31, 2026 only, D47), 'thanksgiving' (Nov 1 to the Sunday after Thanksgiving),
// 'snow' (the Monday after Thanksgiving to Mar 31) or '' (Apr 1 to Oct 23, and late October in other years)
export function seasonNow(now = new Date()) {
  const d = new Date(now), y = d.getFullYear(), mondayAfter = new Date(y, 10, thanksgivingDay(y).getDate() + 4);
  if (y === 2026 && d >= new Date(2026, 9, 24) && d < new Date(2026, 10, 1)) return 'halloween';
  if (d >= new Date(y, 10, 1) && d < mondayAfter) return 'thanksgiving';
  if (d >= mondayAfter || d < new Date(y, 3, 1)) return 'snow';
  return '';
}
export const halloweenOn = now => seasonNow(now) === 'halloween';
const TREATS = { halloween: ['🍬', '🍭'], thanksgiving: ['🦃'], snow: ['❄️'] };   // candy only at Halloween (a 🦇 is a dark smudge on the Desk's plum toast)
const withTreat = (msg, season, rnd) => { const t = TREATS[season]; return t ? `${msg} ${t[Math.floor(rnd() * t.length)]}` : msg; };
// The Desk: a done message with the season's treat at the end, or the message as it is out of season
export function treat(msg, now = new Date(), rnd = Math.random) { return withTreat(msg, seasonNow(now), rnd); }
// The iPad: Halloween's treat only (production's iPad has no turkey or snow)
export function halloweenTreat(msg, now = new Date(), rnd = Math.random) { return withTreat(msg, halloweenOn(now) ? 'halloween' : '', rnd); }
// body.halloween on or off for today (the iPad); the Desk passes its own `apply` (desk/js/seasons.js). Run now and every
// 10 minutes; `alsoEvery` runs after each re-check (the Desk's bat).
export function applySeasonClass() { document.body.classList.toggle('halloween', halloweenOn()); }
export function watchSeasons(alsoEvery, apply = applySeasonClass) {
  apply();
  setInterval(() => { apply(); if (alsoEvery) alsoEvery(); }, SEASON_RECHECK_MS);
}
