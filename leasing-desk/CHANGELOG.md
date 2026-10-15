# Changelog

One entry per deploy, newest first. The stamp shows in the Desk footer and the iPad version line, so it's how you tell which version a computer is running.

**Numbering:** from the next deploy, builds are version numbers — Desk `v1.19`, `v1.20`…; iPad `v1.16`, `v1.17`…. The date-style labels below were sequence labels, not calendar dates (they ran ahead of the real date; "2026-10-18" shipped Oct 4, 2026). Mapping: Desk 2026-10-18 = v1.18, iPad 2026-10-15b = v1.15.

Format: `Build — app(s)` · what changed for staff · (technical note if useful)

## Portfolio cleanup (unreleased, demo copy only)
Code cleanup, plus the quote fixes listed first, which follow the owner's rulings (AUDIT.md §11, D19). The footers read **Desk v1.21 / iPad v1.19**, the production builds this copy matches; the iPad's offline cache name moved with it.

**Brought in from production** (Desk v1.20–v1.21, iPad v1.16–v1.19; each has tests written first; Desk v1.22–v1.23 and iPad v1.20 stay production-only, see `docs/OPEN_ITEMS.md` #3):
- **"Sending to a broker" switch** at the top of the Email Builder's unit list (production v1.20). Off, the email is written to the prospect; on, it quotes broker terms. It sets every unit's broker checkboxes at once (each unit can still be an exception), turns on when a tour with a broker is opened or its units are picked, and Reset turns it off. Built on this repo's broker defaults (D19), not production's, which still turn "OP only" off when the iPad overrides the free months.
- **An OP-only offer is left out of an email to a prospect with no broker** (production v1.20). A unit whose only concession is a broker OP gets no concession line and no net; the unit card says why and points to the switch. Before, the prospect was quoted "1 Mo. OP".
- **Today's totals on the Rotation tab** (production v1.20, managers only): tours, inspections, total, on one now and finished for each assistant who is in or started something today, busiest first, plus a team row.
- **"Selected for this email" keeps up while you type a hand-added unit's number** (production v1.20 fix); it showed "#?" until the field lost focus.
- **The team schedule and who's busy are Desk-only** (production iPad v1.16 and v1.18). The iPad no longer shows the Rotation card, the walk-in wait, wait estimates under waiting prospects, "on a tour · back ~" labels or next up, and Start no longer asks when the assistant is still on another tour. "Who's taking…?" and the Leasing assistant list show the whole team A to Z. The iPad stops reading who's in, the weekly schedule and the Outlook answers; the Desk keeps all of it, and the shared rotation and wait code is still tested through the Desk.

**Bug fixes** (each has a test written before the fix):
- **The Floor Plan Links card no longer says "undefined"** (B6) on a Desk that took its floor plans from a publish instead of a file (every fresh browser, including the demo). A publish carries no file name, so the line now shows only when the links were loaded; a loaded or synced file still shows its name.
- **A deleted Future Move-In stays deleted** (B1). Deleting a lead captured from a tour brought it straight back, because the next capture re-added any recent tour with no lead. It's now kept as "deleted" and hidden; manual leads are still removed outright.
- **The 45-day Future Move-Ins rule counts calendar days** (B2). A move-in exactly 45 days after the tour was captured for morning tours and not for afternoon ones, because the gap was measured from the tour's start time. Now only more than 45 calendar days counts.
- **The template editor's Opening Line now reaches the Tour and Inquiry emails** (B3). The email's opening-line box was filled from text written into the code, so an edited, saved Opening Line never appeared. It now starts from the saved template, refreshes on Save, and keeps anything typed by hand. The Inquiry default is now just its first sentence; the old one repeated the unit sentence with `{unit}` / `{building}` placeholders that were never filled.
- **Shared data stays text** (B4). The tours, quiz results, staff names and published showsheet can be written by anyone, and some fields reached the page as markup or broke out of a button's click handler: square footage, quiz scores, tour ids, unit keys, staff names. Every value passed to a click handler is now a quoted, escaped literal (`jsArg`), square footage and quiz scores are escaped, and floor-plan links are used only when they are `http(s)` (`safeUrl`), in both apps and in the Desk emails. Normal data looks and behaves exactly as before.
- **History says when it can't load** (B5). With no connection to the database the History tab showed "Loading history…" forever; it now says it couldn't load, and clicking History again retries.

**Quote fixes** (each has tests in `tests/unit/`):
- **The iPad's broker note states both rules** (owner-approved wording): "OR incentives: quote the OP to the broker; quote the prospect's concession and net rent only if the broker waives it. AND incentives: quote both." It said to quote the OP only, which is right for OR incentives only. One copy now feeds the guest card and the tour summary.
- **Credits are quoted next to the rent and never included in the net effective**, in both apps: per-tour credits on the iPad, the Desk's "Other concession" credit, and the iPad rent calculator. Before, a $600 credit on 12 months lowered the net by $50.
- **The iPad uses the unit's lease term** (M1), read from the incentive ("on 24-Month Lease"; 12 months when none is written). 2 months free on a 24-month lease at $8,950 now quotes $8,204, matching the showsheet, instead of $7,458. The iPad saves that term with each stop, so a per-tour override reaches the Desk email as "on a 24-month lease". The Desk's "Other concession" lease-term field also starts at the unit's term instead of 12.
- **The iPad reads "½" as "1/2"** (M2), and a whole number before a fraction adds to it: "1½" and "1 1/2 Months Free" are 1.5 months. "½ Month Free" on a $4,000 custom unit quoted a net of $4,000; it now quotes $3,833.
- **Text mixing "and" and "OR" is an OR incentive on the iPad** (M3), as on the Desk. For "1 Month Free and $500 Credit OR 1 Mo. OP" with a broker, the iPad quoted both as if AND; it now quotes the OP to the broker, and "1 Month Free and $500 Credit" only if the broker waives. The prospect side keeps its credit instead of dropping it.
- **The Desk email shows the prospect's net effective on broker tours of AND units** (M4), next to the broker's OP: "1 Month Free and 1/2 Mo. OP", Net Effective $5,913. It had hidden the net on every broker tour; now only an OR offer the broker hasn't waived hides it. Units with no OP show the net too.
- **A per-tour override changes amounts, never the broker rule, in the Desk email** (M5). Broker tour, OR unit, iPad override of ½ month free: the email offered the prospect "½ month free … Net Effective $3,977" and dropped the OP; it now quotes the OP, and the ½ month with its net once "OP only" is unticked because the broker waived. An OP-only override on an AND unit now keeps the prospect's free month: "1 Month Free and 1 Mo. OP", $5,913, and a free-months-only override keeps the broker's OP: "½ month free and 1/2 Mo. OP on a 12-month lease", $6,181.
- **The Desk email follows its own AND/OR selector** (D19). When "Other concession" has both free months and an OP, the unit card shows the checkbox that selector needs: Either/or shows "OP only" (ticked: the OP alone, no net; unticked: the free months and their net); Both (AND) shows "No broker" (ticked: the OP is dropped). Before, the email always printed both with a net. Broker tours start with "OP only" ticked.

**Structure (D18):** each app is now `index.html`, `styles.css` and ES modules under `apps/`, with the code both apps use in `apps/shared/` (one copy instead of two kept in sync by hand). Deploy the `apps/` folder as one site; run locally with `npx serve`. Duplicated helpers were merged (dates, the tax-year rule, the needs filter, Excel reading, the form unit picker, email HTML blocks).

Dead code removed:
- **Legacy template migration**: the Desk no longer converts the pre-2026 single-template storage format; every Desk had already been migrated.
- **Dropbox download helper**: the Desk no longer falls back to a Netlify function to fetch Dropbox files. That proxy is production-only and not part of this repo.
- The unreachable "Saved tours" dialog, the hidden appointment grid and its styles, a no-op render function, two unused helpers on each app, and the iPad's never-called copies of the schedule and appointment setters.

## v1.21 — Leasing Desk · v1.19 — iPad (Oct 6, 2026, production) — concession guardrails removed
- **No concession guardrails.** Staff can enter any concession on any unit again, on the iPad Tour Planner and on the Desk (tour follow-ups, inquiry replies), including units the showsheet lists with no concession. That covers word-of-mouth deals that aren't advertised, and back-pocket offers. The net rent updates as before.
- **Removed:** the Concession rules button and dialog, the size limits and credit caps, the "Limited by rules" tags, the cutting-down of showsheet concessions, and the manager override. Showsheet concessions are quoted exactly as written.
- **Kept from v1.20:** the "Sending to a broker" switch, leaving an OP-only offer out of emails to prospects with no broker, Today's totals, and busy-aware next up on the Desk.
- (Technical: D21. The iPad's concession code is identical to v1.16; the `settings/concessionRules` document and the browser key for it are no longer used. Preview & Copy HTML 18/18 identical to v1.20.)

## v1.18 — iPad (Oct 6, 2026, production) — team schedule is Desk-only
- The iPad no longer shows who's in or out: the **Rotation** card (counts, Out today / Not scheduled, Mark out / Mark back in, Suggested next up), the **walk-in wait** line and the **wait estimate** under each waiting prospect are gone. Those live on the Leasing Desk only.
- Tour Planner home is now just **New tour / New inspection** and **Today's tours** (Waiting / Being planned / In progress / Finished).
- **Who's taking…?** and the Leasing assistant dropdown list the whole team **A to Z**, with no "next up".
- (Technical: D20. The iPad stops loading `settings/availability`, `settings/schedule` and `settings/appointments`. The Desk is unchanged at v1.20.)

## v1.20 — Leasing Desk · v1.17 — iPad (Oct 6, 2026, production) — concession rules + today's totals
Production moved to deploying both sites from GitHub with this release (D22).

**Leasing Desk (v1.20)**
- **Concession rules** (header → *Concession rules*): for each unit size, a manager set the most anyone could quote and how it was offered, with building exceptions, an optional credit cap and a manager override. Removed again in v1.21 (D21).
- **"Sending to a broker" switch** at the top of the Email Builder (Tour / Inquiry follow-ups). Off = written to the prospect; on = broker terms. One switch updates every unit; per-unit checkboxes stay for exceptions. It turns on by itself when a tour planned with a broker is opened or its units are picked; Reset turns it off.
- An OP-only offer is left out of an email to a prospect with no broker.
- **Today's totals** (Rotation tab, managers only): tours, inspections, total, on one now and finished for each assistant, plus a team total.
- Fixed: "Selected for this email" now updates while you type a hand-added unit's number (it showed "#?").

**iPad (v1.17)**
- Followed the same concession rules (read-only), until v1.19 removed them.

## v1.19 — Leasing Desk · v1.16 — iPad (Oct 4, 2026) — design and usability pass
One batch, two deploys (`leasing-desk/` and `ipad-app/`). Nothing changes in the emails that get pasted into Outlook, the quote and incentive math, the PINs, or how tours are saved.

**Leasing Desk (v1.19)**
- **Overdue is red again**: overdue check-ins, overdue future move-ins and "this tour started yesterday" were showing in plain text.
- **"Not on the iPads yet"**: if this Desk has a newer showsheet or floor plan file than the last publish, the showsheet card turns amber, says what the iPads still have, and makes **Publish to iPads** the main button.
- **Next up skips anyone on a tour right now** (Desk only; the iPad keeps plain turn order, D17). The waiting-row dropdowns and Rotation show "on a tour · back ~2:36 PM". Starting a tour with someone who's still on another one asks first (often that one just wasn't finished).
- **Live / Offline** pill on the Tour Queue. If the Desk loses its connection it says so with a banner. It no longer shows "No wait" or a "next up" name it can't know.
- **Current Queue is split** into **Waiting**, **On tour now** and **Started on an earlier day**. Each row has one main button (Start tour, Finish, Pick units); **Delete** is quiet and only turns red when you point at it. Waiting time is easy to read.
- **Wait estimates**: only the first waiting person's panel opens; the others show their estimate in one line you can click.
- **Copy 10-min heads-up** now copies only the note. **Copy email** is its own button (it used to overwrite the note with the email address).
- **History search** keeps what you type.
- **Rotation**: **Mark out** / **Mark back in** buttons (instead of "Out today", which looked like a label).
- **Plan a tour**: clicking outside it no longer closes it and loses what you typed; the cursor starts on the first name; **Send to queue** is the main button.
- **Copy for Outlook** warns you if the email still has a blank like [Prospect].
- While you **pick units**, the email preview stays in view and the builder no longer looks greyed out. The builder no longer jumps around when you switch templates.
- Messages at the bottom of the screen are easier to read (no capitals) and stay longer; errors stay 6 seconds.
- Bigger, easier-to-read text on buttons, tabs and labels (no more tiny capitals); "App pending" and "No floor plan" tags look different from each other.
- Keyboard: **Tab** shows a clear outline (and now reaches the **Upload .xlsx** buttons), **Esc** closes dialogs, and screen readers announce messages. Click a message to dismiss it early.
- The Tour Queue stays open or closed the way you left it.
- **Dropbox sync settings**: a **Turn off sync** button.
- **Training Quiz Results** moved below the Email Builder; passed is green, not passed is red.
- **Help** rewritten for today's Desk (including which emails are editable templates); the guided tour has 7 steps.
- Empty days explain what to do next. The build number is at the bottom of the page.

**iPad (v1.16)**
- **Tour Planner home**: the walk-in wait is at the top, then **Waiting / In progress / Finished today**. The first wait estimate is open, and it only names people who are actually in ("Checking who's in…" until it knows).
- **Taking a waiting prospect**: tap a name under **Who's taking Karen?** right above Start. (The first release also showed busy labels and a start warning here; a re-release the same day made those Desk-only, D17.)
- **Removing a unit** shows **Undo** for 6 seconds.
- **Delete** only appears on tours that haven't started.
- After **Send to queue** or **Finish**, a note at the top of Today's tours confirms it.
- The started-tour summary shows **App pending**, the move-in date and the **Floor plan** button.
- Saved is green, saving is grey, problems are red. Errors show in the message line instead of pop-ups (PIN prompts stay).
- Everything you tap is at least 44pt; dropdowns are as tall as the text boxes and show their whole label; gold and amber text is darker and easier to read.
- Offline: plain messages, and the header says **Offline · last copy 9:12 AM**. Before anything is published, the header says "No showsheet published yet".
- The details card says **New tour** / **New inspection** and has an **Edit** button; "‹ More" back links are slim; Requirements, More, Calculator and Quiz are centered.
- Landscape: slimmer bars, nothing hidden under the action bar, and the quote editor fits on one row.
- Rotation: **Mark out** / **Mark back in**, same as the Desk.
- Buttons respond when pressed (turned off with Reduce Motion). VoiceOver reads rows and checkboxes properly.
- Shared look with the Desk: same colors, tags and status pills (one shared style block, D16).

(Technical: shared token block byte-identical in both files (D16); all 11 shared-logic items still identical, plus Desk-only `busyNow` / `suggestNext` / `busyLabel` (D17); `sw.js` CACHE `tour-companion-v1.16`; new browser key `ld_queueOpen` (Desk). Files: `leasing-desk/index.html`, `ipad-app/index.html`, `ipad-app/sw.js`, `tests/*`, docs. Testing: `npm test` 8/8; `tests/desk_flows.sh` 42/42; `tests/ipad_flows.sh` 25/25; Preview & Copy HTML 18/18 byte-identical to v1.18; screenshots before/after at 1440/1280 and iPad 820/1180 with no unexpected console errors. Not yet done: one paste into Outlook, and a glance on a real iPad. iPad finding I14 (dead-zone Start tour) is left out until it's tested in airplane mode.)

## 2026-10-18 — Leasing Desk
- New **Future Move-Ins** tab: prospects who came in early. Tours with a move-in more than 45 days after the tour are added automatically; **+ Add future lead** for walk-ins. Follow-up date = move-in − 30 days; due/overdue count on the tab and in the Tour Queue header.
- **📅 Add to Outlook** downloads a calendar reminder (.ics, 9:30 AM on the follow-up date).
- No contact info stored (name, dates, preferences only).
- Requires Firestore rule `future_leads`.

## 2026-10-17 — Leasing Desk
- App Confirmation and Approval: the floor plan link now **follows the building + unit**; a stale link from the previous unit is replaced or cleared. Links pasted by hand are kept.
- Tour / inquiry follow-ups: units with an incentive default to **no broker + Show Net Effective Rent on**.

## 2026-10-16d — Leasing Desk
- Reminder text under Dropbox sync: reload the file in Dropbox before **Sync now**. Clearer message when a sync finds no changes.

## 2026-10-16c — Leasing Desk
- While Dropbox sync is on, **Upload / Publish to iPads / Clear** are hidden; one **↻ Sync now** button instead.

## 2026-10-16b — Leasing Desk
- Fixed: Dropbox line squeezed the showsheet card into a one-letter column.

## 2026-10-16 — Leasing Desk
- **Dropbox sync**: showsheet and floor plan master are read straight from Dropbox shared links. Any open Desk checks every 5 min and publishes when a file changes (SHA-256 compare). Settings with **Test** buttons.
- Requires Firestore rule `settings/dropboxSync`.

## 2026-10-15d — Leasing Desk
- "Agent Check-In" renamed **Leasing Manager Check-In**.

## 2026-10-15c — Leasing Desk
- History: **↩ Undo check-in / ↩ Undo follow-up**; rows show who marked them and when.
- **Mark Sent** on a check-in now asks for confirmation.

## 2026-10-15b — Leasing Desk + iPad
- Fixed: tours older than the newest 80 disappeared from the Desk (follow-ups, check-ins, 7-day rotation). Desk now loads 30 days / up to 800 tours; iPad 10 days / up to 400.

## 2026-10-15 — Leasing Desk
- Every Desk **follows the published showsheet live** (units + floor plans). Newest wins; an unpublished local upload isn't overwritten by an older publish.

## 2026-10-14b — Leasing Desk + iPad
- **Unit type dropdown** for hand-added units (Studio, 1 Bath → 3 Bed, 3 Bath).
- Audit fixes: iPad `sw.js` had been empty since Sep 19 (offline opening broken) — restored. Dropdowns populate at startup.

## 2026-10-14 — Leasing Desk
- Custom unit header updates as you type; floor plan status line ("✓ Found in your floor plan list" / "Not in your floor plan list").

## 2026-10-13k — Leasing Desk + iPad
- iPad: a tour open on the iPad **updates live** when the Desk changes it (finish, assign, start, units). iPad saves now **merge** instead of overwriting — previously could erase Desk fields (finish, follow-up sent, check-in sent).
- Desk: floor plans looked up for units added on the iPad (not on the showsheet).

## 2026-10-13j / 13i — iPad
- 13i showed unit + building info for started inspections; 13j reverted it (only tours need it).

## 2026-10-13h — iPad
- Started inspection collapses to one line; email field hidden for inspections; "(suggested next)" hidden once started; **Finish** button on Today's tours.

## 2026-10-13g — Leasing Desk + iPad
- Wait estimate panel redesigned (headline first, "Right now" list, compact Outlook appointment picker).
- Fixed: Desk footer build stamp had been stuck at "2026-10-03".

## 2026-10-13f — iPad
- Tour details card folds to one line after **Start tour**.

## 2026-10-13b–13e — iPad (training quiz)
- Added voucher-program and third-party-guarantor questions (+ cheat sheet entries).
- 13c removed five questions by mistake; 13d restored them; 13e removed #9 (Vero submit), #42 (dry cleaning), #63–65 (broker quoting). Bank: 63 questions, 30 per quiz.

## 2026-10-13 — Leasing Desk + iPad
- **View dropdown** for hand-added units (7 standard views).

## 2026-10-12f — Leasing Desk
- Fixed: check-in **✓ Mark Sent** did nothing (quoting error in the button's click code).

## 2026-10-12e and earlier — both apps
- Tour Queue (Current Queue, Follow Ups, Check-In, Rotation, History), Plan Tour form, picking-units mode, wait estimator with walking matrix, rotation + weekly schedule + out today, training quiz, iPad tour planner with quote logic and state machine (planning → waiting → started → finished), old-tour protection on the iPad, "Started now" recovery button.

## Data (not code)
- **Floor plan master** expanded to every unit across the five buildings from the Dropbox folders (some linked; the rest list the Dropbox file name to search).
