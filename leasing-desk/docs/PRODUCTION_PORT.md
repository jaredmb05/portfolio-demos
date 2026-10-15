# Fixes to port to production

This repo is a cleaned-up copy of a production system. Fixes made here that production also needs are listed below, so they can be ported in a separate session. Each entry says where the fix lives in this repo once it lands. Line references in `AUDIT.md` point at the original single-file apps, which match production.

**Status key:** *pending* = found, not fixed here yet · *done here* = fixed in this repo, not yet in production.

| # | What | Why | Status |
|---|---|---|---|
| B1 | Deleting an auto-captured Future Move-In: it comes straight back | Capture re-adds any tour in the 30-day window that has no lead | done here (`apps/desk/js/future-leads.js`: a deleted tour lead is kept with `status: 'deleted'`; the existing Firestore rules allow it) |
| B2 | 45-day Future Move-Ins cutoff depends on the time of day the tour started | Gap measured from the start time to move-in at noon; "more than 45 days" should be by calendar date | done here (`apps/desk/js/rules/future-move-ins.js`) |
| B3 | Template editor's Tour / Inquiry "Opening Line" has no effect | The email reads a box whose defaults are hardcoded | done here (`apps/desk/js/email-builder.js`: `syncOpeningLine`; `template-editor.js`; `email-templates.js`). **When porting:** a Desk that ever saved its templates still stores the old Inquiry Opening Line (with the unit sentence and `{unit}` / `{building}`), which would now appear in the email; reset that field in each Desk's template editor, or replace that exact old text on load |
| B4 | Shared Firestore data becomes markup (unit `sqft`, tour `id` in `onclick`, quiz scores; floor-plan links accept any URL scheme) | Unescaped values plus world-writable collections | done here (`apps/shared/html.js`: `jsArg`, `safeUrl`, used across both apps; also covers unit keys and staff names inside `'…'`-quoted handler strings, which the browser un-escapes before running them). **When porting:** the Desk finds a hand-added unit's floor-plan box by the text of its `oninput` handler, which this fix changes; port the `data-key` lookup with it (`75a80a0`) |
| B5 | History tab hangs on "Loading history…" when the query fails | No `catch` in `loadHistory` | done here (`apps/desk/js/history.js`) |
| B6 | Floor Plan Links card reads "undefined · <time>" on a Desk that took its floor plans from a publish | The publish carries no file name and the line printed `${filename} · time` | done here (`apps/desk/js/rules/publish.js`: `floorPlanMetaLine`, used by `showsheet.js`) |
| M1 | iPad net effective assumes a 12-month lease; the Desk email puts iPad overrides on 12 months; the Desk's "Other concession" term starts at 12 | Use the unit's term, read from the incentive text ("on 24-Month Lease"), 12 when none is written | done here (`apps/shared/pricing.js`: `leaseTerm`, `resolveStop`, `savedQuoteFields`) |
| M2 | `½` isn't read as `1/2`; "1 1/2" reads as ½ | Both apps parse `½` as `1/2`, and a whole number before a fraction adds to it (1.5) | done here (`apps/shared/pricing.js`: `parseIncentive`; the Desk doesn't parse months) |
| M3 | Text mixing "and" and "OR" is classified as AND on the iPad | It's an OR incentive (the Desk is right) | done here (`apps/shared/pricing.js`: `parseIncentive`) |
| M4 | Desk email hides net effective on every broker tour | On AND incentives, and on units with no OP, the prospect's net effective is shown (the iPad is right) | done here (`apps/desk/js/rules/tour-selection.js`) |
| M5 | Desk email drops the OP when an OR unit has a per-tour override, drops the free month when an AND unit's OP is overridden, and drops the OP when an AND unit's free months are overridden | Overrides change amounts, never the broker rule (D19; the iPad is right) | done here (`apps/shared/pricing.js`: `resolveConcession`; `apps/desk/js/rules/tour-selection.js`) |
| Credits | Both apps take a credit off the net effective (per-tour credits, Desk "Other concession", iPad calculator) | Owner's rule: a credit is quoted next to the rent and never included in the net effective | done here (`apps/shared/pricing.js`, `tour-companion/js/calculator.js`) |
| Selector | Desk "Other concession" ignores its own AND/OR selector and the broker checkboxes | The "OP only" / "No broker" checkboxes follow the selector (D19) | done here (`apps/shared/pricing.js`: `resolveConcession`; `apps/desk/js/rules/tour-selection.js`; `apps/desk/js/unit-list.js`) |
| Banner | iPad broker banner applies the OR rule to every broker tour | Reword: "OR incentives: quote the OP to the broker; quote the prospect's concession and net rent only if the broker waives it. AND incentives: quote both." | done here (`apps/shared/pricing.js`: `BROKER_NOTE`, shown by `tour-planner.js` and `tour-summary.js`) |
| Rules | Firestore rules let anyone read, write and delete tours, leads, settings and the showsheet | Add Firebase anonymous auth; rules require `request.auth` and validate fields; D4 (no staff logins) stays | pending — see notes below |

## Notes for the Firestore rules change
- The public demo runs on an in-browser fake Firestore, so this fix can't be exercised there. Test it against a separate test project before production.
- Order matters: enable **Anonymous** sign-in (Firebase console → Authentication), ship the client change (load `firebase-auth-compat`, `signInAnonymously()` before the first listener), wait until every Desk and iPad has reloaded the new build (D5: updates only show on reload), *then* publish the stricter rules. Publishing the rules first locks out every open client.
- Keep the final catch-all rule that protects another app's data in the same project.
- iPads open offline from the service worker; an anonymous session persists in IndexedDB, so offline start still works.

## Also changed here, optional for production
- Dead code removed (AUDIT.md §4, CHANGELOG "Portfolio cleanup"): safe to port, no behavior change.
- Legacy single-template storage migration removed: safe if no Desk still has the old storage key (owner's call: none do).

## Changed here, do not port as-is
- **In-browser demo** (`apps/shared/boot.js` with `?demo`, `apps/shared/demo/`, the `demo/` pages): demo-only. `boot.js` loads the same config and Firebase SDK as before when there's no `?demo`, so it is safe in production, but production doesn't need it.
- **Fonts and SheetJS served from the repo** instead of Google Fonts and cdnjs: optional for production (it would make the apps independent of those CDNs).
- **Storage keys renamed** to the `ld_` prefix and the service-worker cache renamed: in production this would reset every Desk's saved templates and showsheet.
- **Demo data** (buildings, staff, prices, icons) and the `.env` / `config.js` mechanism: production keeps its own values.
- **ES module structure (D18):** a deploy change (one `apps/` site instead of two drag-and-drop folders, every module listed in `sw.js`). Port only as a deliberate decision.
- **Netlify Dropbox helper** removed here: whether production has the `dbx` function is still to be checked; leave production as it is until then.
