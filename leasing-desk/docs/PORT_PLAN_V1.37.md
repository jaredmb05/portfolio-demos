# Port plan: production Desk v1.22–v1.37 and iPad v1.20–v1.29 into the demo

Scope chosen by the owner (Oct 30, 2026): everything production shipped after the demo's base (Desk v1.21 / iPad v1.19), with invented data, on this repo's module structure. Production building numbers, people and the employer never appear here; "the last-month building" is production's building that applied incentives to the last month (2110 in the demo).

**Rules for the port**
- This repo's money rulings win where production differs (AUDIT.md §11, D19); each case is listed under "Needs a ruling" or "Reconciled".
- Tests first for every rule (Vitest for pure rules, the browser flows for screens), one commit per release group.
- Pure logic goes in `apps/desk/js/rules/` or `apps/shared/`; screens in the app's own modules; shared code once in `apps/shared/` (D18), not duplicated as in production.
- Real data in production's new text (cheat sheet, quiz, notes examples, seasons copy) is replaced with demo equivalents.

## What comes in, in build order

| # | Production | What | Lands in |
|---|---|---|---|
| 1 | Desk v1.22–v1.23 (D24, D25) | Tour times: live "In progress · 25 min" and "took 42 min" when unlocked; tour times by day, one week at a time, ‹ ›, review list, Leave out / Count it again (`timeExcluded*` fields); under 5 min / over 2 h / finished on a later day left out | `desk/js/rules/tour-times.js` (length, status, week grouping), `desk/js/tour-times.js` (table, review, save) |
| 2 | iPad v1.20 (D26) | "Did this tour start earlier?" when Finish comes under a minute after Start; `startCorrectedFromIso`; Desk shows "· set at Finish" | `tour-companion/js/` Finish paths; Desk review list |
| 3 | Desk v1.24 / iPad v1.21 (D27) | Two bank statements, all pages (application confirmation, tour requirements, iPad Requirements); the team list decides who is in today (removed assistants leave the rotation) | `shared/requirements.js`, email modules, `shared/rotation.js` |
| 4 | Desk v1.25 / iPad v1.22 (D28, D29) | A changed rent recomputes the net effective (see ruling R1); the last-month building no longer applies incentives to the last month (email footnote, approval default, iPad note, calculator, two quiz questions) | `shared/pricing.js`, `desk/js/rules/tour-selection.js`, approval email, iPad buildings / calculator / quiz |
| 5 | Desk v1.26 / iPad v1.23 (D30) | Occupied / Currently Undergoing Renovation from NOTES on units with an available date | `desk/js/rules/showsheet-parse.js`, shared `availStatusLabel` / `availStatusFlag`, both unit lists, iPad picker and summary |
| 6 | iPad v1.24 (D31) | Three required quiz questions in every quiz; "Signing in a prospect" on the cheat sheet; "Lease renewals and adding an occupant" | `tour-companion/js/quiz.js`, `buildings.js`, `cheat-sheet.js` |
| 7 | Desk v1.27 (D32) | Lease assignments: Application Confirmation "This is an assignment" + Lease End Date; under a year = "delivered as is", a year or more = prep reminder (never in the email); Lease Approval follows the dates | `desk/js/rules/lease-approval.js` (`assignmentTerm`), application and approval email modules |
| 8 | Desk v1.28–v1.31 (D33, D34, D36–D38) | **Reports** (PIN): period and building, six numbers, apartments shown by size / building / week, most-shown (and still available), sizes asked vs available, net rent of the apartments shown, within their price, move-in months, traffic and busiest times, week by week by size with concession mix, tour times and quiz results; hover / keyboard details and tables; print checklist; Excel (14 sheets); pinned bar and ↑ Top | `desk/js/rules/reports.js` (the model, all numbers), `desk/js/reports.js` + `desk/js/viz.js` (charts), `reports-print.js`, `reports-xlsx.js` |
| 9 | Desk v1.29 (D35) | Leasing assistant contest: a NOTES "gift card" → green 🎁 flag on the Desk unit list until its date; searchable; never in emails or on the iPad | showsheet parse, `desk/js/unit-list.js` |
| 10 | Desk v1.31 (D39) | Future Move-Ins → Copy follow-up | `desk/js/future-leads.js` |
| 11 | Desk v1.32 (D40) | The Desk on a phone (one media block; rows as cards, pop-ups full screen, charts tap for details) | `desk/styles.css` |
| 12 | Desk v1.33 / iPad v1.25 (D41–D43) | No prospect email anywhere (field, Copy email, saves); Dropbox links PIN-locked and Dropbox-only; https-only floor plan links in emails (an http link is upgraded); calendar file checks; apostrophes in names | both apps; demo seed drops `prospectEmail` |
| 13 | iPad v1.26 (D44) | "Connecting…" vs "Offline", reconnect after sleep, Reconnect button, no "[object Event]" | `tour-companion/js/showsheet-feed.js`, `firebase.js`; fake Firestore gains `disableNetwork` / `enableNetwork` / no-answer |
| 14 | Desk v1.34 / iPad v1.27 (D45–D47) | Required tour info (size, top price or Flexible, move-in or Flexible) with named, outlined fields; whole-dollar price boxes; "budget flexible"; Future Move-Ins leads stay done (capture waits for the leads list, creates only); net under the rent in the Desk unit list; Halloween | `shared/` (`parseMoney`, `profileSummary`), plan-tour / tour-planner, `rules/future-move-ins.js`, unit list, seasons |
| 15 | iPad v1.28 (D48) | Details before units (Done and adding a unit check them) | `tour-companion/js/tour-planner.js` |
| 16 | Desk v1.35 / iPad v1.29 (D49) | Orange unit cell = "Backup apps welcome": still on the market, light orange row, one neutral email line | showsheet parse (fills), both lists, emails, Reports status |
| 17 | Desk v1.36–v1.37 (D50, D51) | Seasons (turkey to the Monday after Thanksgiving, snow to Mar 31, ❄ pause); typing in the queue panel survives redraws; the Check-In name box follows the last name used | `desk/js/seasons.js`, `queue.js` |
| 18 | Docs | Decisions as D23+ in this repo's numbering, each naming production's number; CHANGELOG; DATA_MODEL (new fields, no email); TESTING; README (Reports screenshots, demo URLs, known limitations); PRODUCTION_PORT marks what production has since fixed itself (B1 ≈ its D46, B4 ≈ its D43) | `docs/` |

Demo data: six weeks of invented tours (sizes, budgets, move-ins, units, concessions, tour times, a few left out), quiz results, two units with a gift card note, one orange unit, Occupied and Renovation notes, so every Reports chart and every new flag has something to show.

## Rulings (owner, Oct 30, 2026)

- **R1:** the unit's lease term (this repo's M1), not production's 12 months.
- **R2:** jaredmbrown.dev links to the demo; keep production's no-framing rule.
- The rest of this plan: approved as written.

## The questions as asked

- **R1. Net effective after a rent change.** Production (D28): the showsheet's free months over **12 months**. This repo (M1, Oct 6): the unit's lease term from the incentive text ("on 24-Month Lease"), 12 when none is written. Recommendation: this repo's term, so the email still matches the iPad quote.
- **R2. Framing.** Production v1.33 tells browsers never to show the apps inside another site (`frame-ancestors 'none'`). If jaredmbrown.dev embeds the demo in a frame, that would block it. Recommendation: link to the demo (new tab) and keep the rule; or, if it's embedded, allow only jaredmbrown.dev.

## Reconciled (no ruling needed unless you disagree)

- **Credits** stay out of the net effective (this repo's ruling) everywhere Reports and the rent-change rule compute a net.
- **Floor plan links**: production's https-only rule replaces this repo's http(s) rule (stricter; the demo's links are already https).
- **Deleted Future Move-Ins**: this repo's B1 and production's D46 do the same thing (`status: 'deleted'`); production's "wait for the leads list, create only" is added on top.
- **Inline handler safety**: this repo's `jsArg` (B4) already matches production's D43.

## Not ported

- **Production data migrations**: erasing prospect emails already saved on tours (v1.33) and swapping old saved requirement templates (v1.24). The demo has no such data; the field and the old text are simply gone. Same reasoning as the legacy template migration removed in Phase 2.
- **`docs/CAPABILITIES.md`**: production's interview notes, with production line numbers; not part of the demo.
- **Deploy and hosting files** (`_headers`, Netlify settings), unless R2 says otherwise.

## Ported differently

- **The Firestore emulator test** (`tests/rules`, needs Java): an optional `npm run test:rules`, not in CI.
- **Production's layout comparison and phone capture** (`desk_same_layout`, `desk_capture … phone`): ported into this repo's capture scripts.

## Progress

One line per group as it lands (commit, tests).
- Group 1 (tour-time rules; unlocked "In progress · N min" and "took N min"): `rules/tour-times.js`, 16 unit tests, desk flows +2. The tour-times table itself lands with Reports (group 8), where production moved it.
- Group 2 (iPad "Did this tour start earlier?", production D26): `shared/start-time.js` (19 unit tests), `tour-companion/js/start-question.js`, both Finish paths, `startCorrectedFromIso`; iPad flows +9.
- Group 3 (two bank statements, all pages; the team list decides who is in today, production D27): `shared/rotation.js`, 11 unit tests, desk flows +8, iPad flows +1. Also renamed a test variable that carried a production staff name.
- Group 4 (a typed rent recomputes the net over the unit's lease term, R1; 2110 no longer applies incentives to the last month, production D28, D29): `rentChangedNe` / `neLeftOut` in `shared/pricing.js`, 23 unit tests, desk flows +9, iPad flows +2. Fixed B7 (`parseIncentive` read "$1,500 move-in credit" as 500 months); two inherited inconsistencies logged as OPEN_ITEMS #5–6.
- Group 5 (Occupied / Currently Undergoing Renovation from NOTES, production D30): `shared/avail-status.js`, parser in `rules/showsheet-parse.js`, 10 unit tests, desk flows +7, iPad flows +3; emails byte-identical.
- Group 6 (three required quiz questions, "Signing in a prospect" on the cheat sheet, no tennis fee; production D31): `shared/quiz-draw.js`, 14 unit tests, iPad flows +9, desk flows +1. Employer initials in one sign-in question rewritten as "Larkspur".
- Group 7 (lease assignments, production D32): `assignmentTerm` and friends in `rules/lease-approval.js`, 16 unit tests, desk flows +6; emails without an assignment 18/18 byte-identical.
- Group 8a (the Reports model, production D33, D37, D38): `rules/reports.js`, pure, 73 unit tests; nets follow the demo's rules (no credit in the net, the stop's term or the incentive's) and match the iPad quote on 15 representative stops. Two cross-app gaps logged as OPEN_ITEMS #5 (extended) and #7.
- Group 8b (the Reports panel, tour times by day with Leave out / Count it again and the set-at-Finish marker, Choose what to print, Excel, ↑ Top and the pinned bar; production D33, D34, D36–D38): `reports.js`, `viz.js`, `reports-print.js`, `reports-xlsx.js`, `tour-times.js`; Training Quiz Results folded into Reports; seed: six weeks of handled tours, stops save the lease term; desk flows 168/168 (+68), demo check 17/17 (+1).
- Group 9 (leasing assistant contest: a NOTES gift card -> green flag on the Desk unit list until its date, never in emails, the iPad or Reports; production D35): `rules/contest.js`, 29 unit tests, desk flows +10, iPad flows +2; emails 18/18 byte-identical. Production's real contest amounts in its test notes replaced.
- Group 10 (Future Move-Ins -> Copy follow-up, production D39): `futureFollowUpHtml` in `rules/future-move-ins.js`, 11 unit tests, desk flows +4; existing emails 18/18 byte-identical.
- Group 11 (the Desk on a phone, production D40): one phone block in `desk/styles.css` (every control at least 44×44 px, stricter than production; guided-tour dots don't take taps on a phone, Back and Next reach every step), chart tap details in `viz.js`; new `desk_capture.sh … phone` (0 controls under 44 px, 0 screens wider than the phone, at 390 and 360) and `desk_same_layout.sh` (HEAD vs working tree, 75/75 screen states identical at 1440 / 1280 / 768); desk flows +6; emails 20/20 byte-identical.
- Group 12 (security fixes, production D41–D43): no prospect email on either app or in the seed (the read-time drop from the iPad's saved tour kept, the database erase not ported); Dropbox links Dropbox-only and PIN-locked (`rules/dropbox-links.js`); floor plan links https-only, http upgraded (`webUrl` replaces `safeUrl`); calendar file checks (`followUpIcs`); apostrophe checks on both apps; `apps/_headers` forbids framing (R2). 22 unit tests, desk flows +13, iPad flows +6; emails 20/20 byte-identical; same layout 75/75 once the removed email box is taken out of the comparison; phone run 0 / 0.
- Group 13 (iPad "Connecting…" vs "Offline", Reconnect, reconnect after sleep, production D44): `shared/connection.js` (12 unit tests), `showsheet-feed.js`; the fake database gains `disableNetwork` / `enableNetwork` and a `noAnswer` seed; iPad flows +6 (all six fail on the previous code), demo check +1 (the visitor's iPad shows the live showsheet, not Connecting…). One production quirk ported as is and logged as OPEN_ITEMS #8.
- Group 14 (required tour info, whole-dollar prices, "budget flexible", leads stay done, net rent in the Desk unit list, Halloween; production D45–D47): `shared/tour-required.js`, `parseMoney` / `moneyText` / `moneyTyped`, `captureLeads` (manual leads are now marked deleted too, as production), `listNet` shared by both lists, `shared/seasons.js`; 38 unit tests, future flows +2 (all four lead checks fail on the previous code), desk flows +18, iPad flows +11; emails 20/20 byte-identical; phone run 0 / 0. One Reports difference logged as OPEN_ITEMS #9.
- Group 15 (iPad: the tour details before the units, production D48): `detailsMissing` in `shared/tour-required.js` (4 unit tests), `guestDone` / `detailsReady` and the check at the top of `toggleStop`; iPad flows +5. The demo's iPad capture has no missing-info screen, so production's extra screenshot wasn't added.
- Group 16 (an orange unit cell = "Backup apps welcome", production D49): `unitCellFill` in `rules/showsheet-parse.js`, the email line in `rules/backup-apps.js`, `--backup-row` / `.flag.backup` (5.2:1) in `shared/tokens.css`, both lists, picker, summary; `tests/fixture_fills.cjs` with invented units; 12 unit tests, desk flows +6, iPad flows +2; one seeded orange unit (2040 #1207); emails 20/20 byte-identical; phone run 0 / 0.
- Group 17 (seasons, typing in the queue panel survives redraws, the Check-In name box follows the last name used; production D50, D51, v1.37): `thanksgivingDay` / `seasonNow` in `shared/seasons.js` (the iPad stays Halloween-only, as production), turkey / snow / ❄ pause (`ld_snowOff`) in `desk/js/seasons.js`, `QUEUE_KEEP` / `checkinPick` in `queue.js`; `desk_flows.sh` passes its script as a file; 13 unit tests, desk flows +16; emails 20/20 byte-identical; same layout 75/75 on a date with no season; phone run 0 / 0. ❄ contrast logged as OPEN_ITEMS #10.
- Group 18 (docs and release): D23–D50 = production D24–D51; CHANGELOG, DATA_MODEL, TESTING, README (Reports and its screenshot, known limitations), PRODUCTION_PORT; footers Desk v1.37 / iPad v1.29, iPad cache `tour-companion-v1.29`; screenshots regenerated. Final: vitest 522/522, future flows 11/11, desk flows 241/241, iPad flows 85/85, demo check 18/18. **Port complete.**
