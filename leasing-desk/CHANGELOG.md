# Changelog

One entry per deploy, newest first. The stamp shows in the Desk footer and the iPad version line, so it's how you tell which version a computer is running.

**Numbering:** from the next deploy, builds are version numbers — Desk `v1.19`, `v1.20`…; iPad `v1.16`, `v1.17`…. The date-style labels below were sequence labels, not calendar dates (they ran ahead of the real date; "2026-10-18" shipped Oct 4, 2026). Mapping: Desk 2026-10-18 = v1.18, iPad 2026-10-15b = v1.15.

Format: `Build — app(s)` · what changed for staff · (technical note if useful)

## Demo only: the PIN fills itself in; the demo on a phone (unreleased)
- **A visitor to the in-browser demo doesn't need the manager PIN.** Every PIN question (Reports, Unlock with PIN on the Rotation tab, Dropbox link changes, the iPad's Exit quiz and Edit list…) opens a box that types `1234` and presses OK by itself; Cancel still works while it types. Outside the demo nothing changes: the apps ask with the browser's prompt, and the PIN is still a deterrent, not security (D4). The box fades and scales in, fades out a beat faster, and OK dips slightly when it's pressed (none of the movement with reduced motion).
- **The guided tour works on a phone.** Its card is a sheet along the bottom of the screen, whole on every step, and each step scrolls the part it explains to the top, highlighted above the card. Before, from step 2 on the card ran off the bottom of the screen with Next out of reach (D39; production has the same problem: `docs/PRODUCTION_PORT.md` B8). Computers and iPads are unchanged (`tests/desk_same_layout.sh`).
- **The demo banner is two short lines on a phone** (the label with Reset demo beside it, then the details) instead of four, and no longer mentions the PIN, since the box fills it in.
- **The iPad app at phone width (demo link):** the title stays on one line and a long "Published …" is cut short; Today's tours use the full width with Open / Finish / Delete underneath; a building's unit count stays on one line. iPad sizes are unchanged.
- (`apps/shared/demo/pin-box.js` and `banner.js`, loaded by `boot.js` only with `?demo`; `askPin` in `shared/dom.js`; `guided-tour.js` and the phone layer in `apps/desk/styles.css`; the 600px block in `apps/tour-companion/styles.css`. `npm run test:demo` 26/26, six of them on a 390×844 touch screen.)
- New screenshot: Reports' busiest days and times (`docs/screenshots/desk-reports-busiest-times.png`).

## Brought in from production Desk v1.22–v1.37 · iPad v1.20–v1.29 (unreleased, demo copy only)
Production's releases from Oct 8 to Oct 26, 2026, rebuilt on this repo's modules with tests written first (`docs/PORT_PLAN_V1.37.md`): the footers read **Desk v1.37 / iPad v1.29** and the iPad's offline cache is `tour-companion-v1.29`; all data is invented, and where production's money rules differ, this repo's rulings win (D19, R1).

### v1.37 — Leasing Desk (Oct 26, 2026) — the Check-In name box follows the last name used again
- **Leasing Manager Check-In, the name next to ✓ Mark sent:** after you mark one sent, the rows you haven't touched switch to that name again, as before v1.36. A row where you changed the name keeps your choice, even while the list updates. In v1.36 every row kept the name it first showed.
- (D50; `checkinPick` in `desk/js/queue.js`, in memory only.)

### v1.36 — Leasing Desk (Oct 26, 2026) — a turkey in November, snow December to March; typing in Future Move-Ins no longer disappears
- **Fixed: "+ Add future lead" emptied itself while you typed.** The Tour Queue panel is redrawn whenever any tour or lead changes, and each redraw rebuilt the form empty. Now what you've typed, and where the cursor was, survives. The same fix covers the "Add a leasing assistant" box. Boxes that save the moment they change (the assistant on a waiting tour, schedule ticks) still show other Desks' changes.
- **Nov 1 until the Monday after Thanksgiving:** a small turkey next to "Leasing Desk" that steps every few seconds, and a 🦃 at the end of the "Finished" / "Marked sent" messages.
- **From that Monday to Mar 31:** snow falls over the title area while the Desk is on screen (at most 16 flakes at once). The ❄ next to "Leasing Desk" pauses it and starts it again; each computer remembers its choice. A ❄️ at the end of the "Finished" / "Marked sent" messages.
- Nothing with reduced motion (the turkey stands still, no snow), no snow on phones, never in emails, printouts or the database. Thanksgiving's date is worked out each year; Halloween stays 2026 only. Desk only: the iPads are unchanged.
- (D49, D50; `thanksgivingDay` / `seasonNow` in `shared/seasons.js`, turkey, snow and the ❄ (`ld_snowOff`) in `desk/js/seasons.js`, `QUEUE_KEEP` in `desk/js/queue.js`. `tests/desk_flows.sh` now passes its script as a file. The ❄'s color is production's, about 2:1 on white: `docs/OPEN_ITEMS.md` #10.)

### v1.35 — Leasing Desk · v1.29 — iPad (Oct 26, 2026) — orange on the showsheet: "Backup apps welcome"
- **Orange rows on the showsheet show as "Backup apps welcome".** When a unit's number cell is filled orange (Excel's standard "Orange"), the Desk and the iPads show it on a **light orange** row labelled **"Backup apps welcome"** in amber, and keep it **on the market**: it stays in the iPad's "No app" filter and counts as still available in Reports. Red still means App pending, off the market. Only the unit number cell is read; a colored notes cell makes no difference.
- **Emails say it neutrally.** Tour and Inquiry Follow-Up emails add one line for that apartment: *"An application is in progress on this apartment; we're happy to take a backup application."* Never the word "weak". The line follows today's showsheet: when the orange comes off, it goes. Apartments typed in by hand never get it.
- Shown on the Desk's unit list, in Reports ("Status today"), and on the iPad's Availability list, unit picker and tour summary.
- (D48; `unitCellFill` in `rules/showsheet-parse.js`, `rules/backup-apps.js`, `--backup-row` / `.flag.backup` in `shared/tokens.css`. `tests/fixture_fills.cjs` builds a showsheet with real fills from invented units; one seeded unit, 2040 #1207, is orange.)

### v1.28 — iPad (Oct 24, 2026) — the tour details come before the units
- **"Done — pick units ↓" checks the details first.** On a new tour the details card won't fold until it has the first name, a size, the most they'd pay (or Flexible) and a move-in date (or Flexible), plus the broker's last name if Broker is ticked: the same message, red outlines and notes as Send to queue, cursor on the first missing one.
- **Tapping a unit checks too**, so the details can't be skipped by scrolling past the card: the unit isn't added and the bar says what's missing. Taking a unit off is never blocked.
- The bar doesn't ask for a unit while the details are being filled in; Send to queue and Start tour still need one. Inspections and the Desk are unchanged.
- (D47; `detailsMissing` in `shared/tour-required.js`.)

### v1.34 — Leasing Desk · v1.27 — iPad (Oct 24, 2026) — a tour needs a size, a top price (or Flexible) and a move-in date (or Flexible); leads stay done; net rent in the unit list; Halloween
- **A prospect tour can't go in the queue or start without the basics.** On the Desk (Plan a tour: Send to queue, Send & pick units, Start tour now) and the iPad (New tour: Send to queue, Start tour), marked with a red *: **first name**; **a size** in "Looking for"; **the most they'd pay per month** (Max), or the new **Flexible** box next to the price; **a move-in date**, or **Flexible** next to the date. On the iPad, as before, at least one unit.
- **If something is missing, it says exactly what**, in one sentence on both apps (for example "Still needed: size and move-in date (or Flexible)."): a message at the bottom on the Desk, the bar at the bottom on the iPad, which shrinks as you fill things in. Each missing field gets a red outline and a short note, and the cursor jumps to the first. The marks go as soon as the field is filled.
- **Prices are whole dollars:** the Min and Max boxes show "$4,500" as you type.
- Queue rows (Desk) and Today's tours (iPad) say **"budget flexible"** when the price Flexible box was ticked.
- Resident inspections are unchanged: name and unit only.
- **Future Move-Ins: ✓ Contacted, Leased and Not interested stick, and so does Delete.** A Desk that got its tours before its leads used to add every lead again as "open"; now it waits for the leads list and never touches a lead that's already there. Delete hides a lead for good, whether it came from a tour or was added by hand.
- **The unit list shows the net rent** under the rent ("$6,295 / Net $5,770" on 2230 #3107) when the showsheet has a lower net, in Tour and Inquiry Follow-Up, like the iPad's list. Emails are unchanged.
- **Halloween, Oct 24–31:** a 🎃 next to the page titles; a 🍬 or 🍭 when a tour is finished or a follow-up or check-in is marked sent; on the Desk, a small bat across the top once a day (not with reduced motion). It switches itself off at midnight on Oct 31, even on an open page; nothing goes into emails, printouts or the database.
- Reports: a tour with a flexible budget has no top price, so it's left out of "Shown within the prospect's price".
- (D44–D46. `shared/tour-required.js`; `parseMoney` / `moneyText` / `moneyTyped`; `profile.priceFlexible`; `captureLeads` and `deletedLead` in `rules/future-move-ins.js`; `listNet` in `shared/pricing.js`, shared by both lists; `shared/seasons.js`. Production's fix for leads already reset ("mark them again once") doesn't apply here.)

### v1.26 — iPad (Oct 23, 2026) — "Connecting…" instead of "Offline"; Reconnect
- **Opening the app no longer says "Offline" while it's only connecting.** It shows the copy saved on the iPad with "Connecting… · last copy 9:12 AM" (grey) until the database answers. It says **Offline** (red, with the banner) only when the iPad has no internet, the showsheet listener failed, or nothing has come back after 15 seconds.
- **Back online by itself after the iPad sleeps.** Back on screen after 30 seconds or more away (locked, or in another app), it reconnects at once.
- **Reconnect button** in the Offline banner when the iPad has internet but the database isn't answering. A tour saved meanwhile stays on the iPad and is sent.
- Fixed: the banner could read "[object Event]" when the Wi-Fi dropped or came back.
- (D43; `shared/connection.js`. After a listener error the next re-check still offers Reconnect, as in production: `docs/OPEN_ITEMS.md` #8.)

### v1.33 — Leasing Desk · v1.25 — iPad (Oct 23, 2026) — security fixes
- **No prospect emails.** Plan a tour (Desk) and New tour (iPad) don't ask for one, and the Desk's **Copy email** button is gone. **Copy 10-min heads-up** still copies the note: paste it into an email to them (their address is on their booking or Outlook thread).
- **Dropbox sync: changing a link or turning sync off needs the manager PIN.** The links already set stay. Only Dropbox share links are accepted, when saving, testing or syncing; a link to any other site is never downloaded.
- **Floor plan links in emails and on the iPad are web links only.** An `http://` link goes out as `https://`; anything else is left out, and the tour email shows "[Floor plan link missing]" so you notice.
- **Future Move-Ins → Add to Outlook:** a lead without a valid follow-up date says so instead of making a broken calendar file.
- **Names and IDs with an apostrophe** (for example O'Hara) are checked through the real buttons on both apps: the queue, Future Move-Ins and Rotation on the Desk; "Who's taking …?", Today's tours and the team list's × on the iPad. This repo already escaped them (B4).
- **Neither app can be shown inside another website**, which stops a hidden-frame trick that makes someone click a button without knowing. Opening them as usual is unchanged.
- (D40–D42. `rules/dropbox-links.js`; `webUrl` in `shared/html.js`, replacing `safeUrl`; `followUpIcs` in `rules/future-move-ins.js`; `apps/_headers` (ruling R2). The seed has no prospect emails.)

### v1.32 — Leasing Desk (Oct 22, 2026) — the Desk works on a phone
- **The Leasing Desk fits a phone**, upright or sideways, with no sideways scrolling.
  - **Rows become cards** (Current Queue, Follow-Ups, Check-In, Future Move-Ins, Rotation, History): the name and details, then the time, then the buttons.
  - **Pop-ups fill the screen**, with the title and ✕ Close at the top.
  - **Every control is at least 44×44 px**, and tapping a text box no longer makes the iPhone zoom in.
  - **Reports:** the six numbers two by two, charts the width of the screen, wide tables scroll inside their box; tap a bar, dot or square for its details. The Reports bar scrolls with the page instead of staying pinned.
  - The guided tour's dots show progress only; Back and Next move between steps.
- **Nothing changes on a computer or in an iPad-sized window**: every element of 75 screen states sits and looks the same at 1440, 1280 and 768 wide, and every email is byte-identical.
- (D39; one phone block at the end of `desk/styles.css`. Checks: `tests/desk_capture.sh … phone` (0 controls under 44 px, 0 screens wider than the phone, at 390 and 360 wide) and `tests/desk_same_layout.sh`.)

### v1.28–v1.31 — Leasing Desk (Oct 22, 2026) — Reports; gift card contest; Future Move-Ins Copy follow-up
Production built Reports over four releases that day; this copy has where it ended (v1.31).
- **Reports** at the bottom of the Desk, where Training Quiz Results was, for managers only: it asks for the manager PIN, and Lock clears it.
  - **Period and building** at the top: this week, 2, 4 or 6 weeks (Monday to Sunday; it opens on 4), all buildings or one. Every number follows both.
  - **Six numbers:** tours (and typically how many in a full week), apartments shown, different apartments, within their price, typical tour, quiz pass rate.
  - **Apartments shown:** by size week by week, by building, the most-shown apartments with their status and rent today, and the most-shown ones still available with today's concession.
  - **What prospects want:** sizes asked for vs. available now; the net rent of the apartments shown, per size (the typical net quoted, where most fell, the rent before the concession); shown within the prospect's price; week by week for one size (asked for, shown, typical net, and how many showings had each concession); move-in months.
  - **Traffic:** tours per week, and the busiest days and times by arrival.
  - **Team:** tour times by day (‹ › weeks, Leave out / Count it again, "set at Finish") and training quiz results.
  - **Every chart:** point at it or Tab to it for the details; **Show table** for the numbers.
  - **Print or save as PDF** asks what to print first ("Choose what to print"): untick a part to leave it off; a menu sets Chart / Table / Chart and table, or Top 15 / All. Everything starts ticked each time.
  - **Download Excel:** 14 sheets, always all of them.
  - **Nothing is saved.** Reports reads the last 8 weeks of tours when it opens, and again on opening once that's over 15 minutes old; Refresh reads them again.
  - The Reports bar stays pinned while you scroll through Reports, and an **↑ Top** button appears anywhere on the Desk once you've scrolled down.
  - Rotation keeps today's counts, today's totals, Mark out / Mark back in and the schedule, with a line pointing to Reports.
- **Leasing assistant contest** (v1.29): a unit whose showsheet NOTES mention a **gift card** shows a green 🎁 flag with the note on the Desk's unit list (Tour and Inquiry follow-up) until the day after the date in the note; typing "gift card" in the unit search lists them. Never in emails, not on the iPad, not in Reports.
- **Future Move-Ins → Copy follow-up** (v1.31) on every open lead: a ready-to-paste reply with the first name, "When you toured with us on …" (or "When we spoke on …" for a lead added by hand), the move-in date and the size asked for; no prices or unit numbers. Copying doesn't mark the lead contacted.
- (D32–D38. Every number comes from `rules/reports.js`, pure functions; nets follow this repo's rules: no credit in the net, the stop's lease term (D19, R1). The seed adds six weeks of invented tours and quiz attempts, and two units with invented gift card notes.)

### v1.27 — Leasing Desk (Oct 22, 2026) — lease assignments
- **Application Confirmation: "This is an assignment."** Ticking it opens a **Lease End Date** (type 05312027 → May 31, 2027) and greys out Lease Term. The email reads "Lease Term: Lease assignment through May 31, 2027".
  - **Under a year** from move-in: the email adds, in italics, *Please note: the apartment is delivered "as is".*
  - **A year or more:** no "as is" line. An amber reminder on the form, and again after Copy for Outlook, says the unit must be prepped and the current tenant must vacate at least 5 days before their surrender date. Never in the email.
- **Lease Approval:** "This is an assignment" works the same out from the lease dates. "Delivered as-is" ticks itself under a year and unticks at a year or more, until someone changes it by hand.
- Both emails use the same as-is words. Emails without an assignment are unchanged.
- (D31; `assignmentTerm` in `rules/lease-approval.js`.)

### v1.24 — iPad (Oct 22, 2026) — required quiz questions; sign-in on the cheat sheet
- **Three questions are in every training quiz** (still 30: these 3 plus 27 at random, no repeats): who handles a renewal or adding an occupant (their leasing specialist); what to ask when signing in a prospect (all of the above, always last); and true or false, on the sign-in iPad the prospect fills in only their email and hands it back (True, shown before False).
- The old random question about renewals is gone; the required one covers it.
- **Cheat sheet:** "Lease renewals and adding an occupant → Leasing Specialist for that building", and a new **Signing in a prospect** section.
- 2050's tennis courts no longer show a fee.
- The Desk's quiz results show the new "Sign-in" topic.
- (D30; `shared/quiz-draw.js`.)

### v1.26 — Leasing Desk · v1.23 — iPad (Oct 19, 2026) — Occupied / Currently Undergoing Renovation
- **Units with an available date say what's happening until then**, from the showsheet's NOTES: **Occupied** (the word "occupied") or **Currently Undergoing Renovation** ("reno" or "renovation"; these units are vacant). Both words → Occupied; "newly renovated" and "unoccupied" don't count; anything else shows nothing.
- Shown on the iPad (Availability, the Tour Planner unit picker, the tour summary) and the Desk unit list. Emails don't change.
- Only the label goes to the iPads; the note itself isn't published.
- (D29; `shared/avail-status.js`, read in `rules/showsheet-parse.js`. Two seeded units carry the labels.)

### v1.25 — Leasing Desk · v1.22 — iPad (Oct 15, 2026) — the net effective follows a typed rent; 2110's incentive no longer at the end
- **Changing a unit's rent in a tour or inquiry email updates the net effective**, worked out from the typed rent and the showsheet's free months over the unit's lease term, as the iPad quotes it: 2 Months Free on a 24-month lease at $8,500 → $7,792. Put the showsheet rent back and the showsheet's number returns.
- With no free months to work from (a credit only, for example), the email leaves the net effective out, and the unit card says to use **Other concession**.
- **Tours reopened from the queue** with an iPad rent change show the worked-out net too.
- **2110 no longer puts the incentive at the end of the lease:** no footnote in emails; the approval email's Applied To starts at the 2nd month, as at every building; the iPad note, building card line, calculator wording and two quiz questions are gone.
- Fixed (B7): "$1,500 move-in credit" was read as 500 free months.
- (D27, D28; `rentChangedNe` and `neLeftOut` in `shared/pricing.js`.)

### v1.24 — Leasing Desk · v1.21 — iPad (Oct 15, 2026) — two bank statements; removed assistants leave the rotation
- **Bank statements: the two most recent, all pages**, in the Application Confirmation email (employed, self-employed, student), the Desk's built-in tour requirements and iPad → Requirements.
- **Someone removed from the team list is no longer "next up", "free" or a wait-estimate lane.** Someone not on the list who starts a tour or inspection today still counts that day. Past tours stay in History, tour times and "Last 7 days".
- (D26; `rotationStats` in `shared/rotation.js`.)

### v1.23 — Leasing Desk · v1.20 — iPad (Oct 8, 2026) — tour times by day; "Did this tour start earlier?"
- **Tour times by day** (managers only): one week at a time, Monday to Sunday, the typical tour length and tours started for each assistant and the team, then a Week column with the change from the week before; ‹ › steps back 8 weeks; click a cell for its tours. It sits in Reports → Team, where production moved it in v1.28.
- **Tours under 5 minutes don't count toward tour length** (they still count as tours); the tour list says "No: under 5 minutes".
- **iPad: "Did this tour start earlier?"** When Finish is tapped less than a minute after Start on a tour (tour screen or Today's tours), the iPad asks instead of the usual confirm: **Started when it was set up · 2:10 PM**, a time box with **Use this time** (never in the future), **It just started — finish anyway**, or **Cancel**. The chosen time becomes the start; the original Start tap is kept. Inspections, and tours longer than a minute, get the usual confirm.
- **Desk:** such a start reads "2:00 PM · set at Finish" in the tour-times list.
- (D24, D25; `shared/start-time.js`; new tour field `startCorrectedFromIso`.)

### v1.22 — Leasing Desk (Oct 8, 2026) — tour times (managers only)
All tour times are behind the manager PIN. Locked, the Desk looks as before.
- **How long a tour is taking:** unlocked, tours on the Current Queue read "In progress · 25 min" (with "since 1:45 PM"), redrawn every 30 seconds.
- **How long a tour took:** unlocked, Follow-Ups to Send and History show "took 42 min" on each finished tour.
- **Review and leave out:** the tours behind a tour-times cell are listed with start, finish, length and whether each counts (and if not, why). **Leave out of tour times** asks for your name and records it; **Count it again** undoes it. The tour itself is kept: it still counts as a tour and stays in History, Follow-Ups and Check-In. If the tour was deleted after the list loaded, the Desk says so.
- **A missed Finish doesn't distort the numbers:** a tour finished on a later day gets no length, tours over 2 hours aren't counted, and the typical length is the median; each cell says how many were left out.
- Inspections are left out of tour times.
- (D23; `rules/tour-times.js`; new tour fields `timeExcluded`, `timeExcludedBy`, `timeExcludedAtIso`, saved without changing `updatedAtIso`.)

### Differences from production
- **Net effective after a typed rent:** over the unit's lease term (ruling R1), not 12 months, so the email matches the iPad quote.
- **Credits are never in the net effective**, in Reports and the typed-rent rule too (D19). Reports prices each showing over the stop's saved lease term, else the incentive's.
- **Phone layout:** every control at least 44×44 px (production: buttons 44px); the guided tour's dots don't take taps.
- **Floor plan links:** production's https-only `webUrl` replaces this repo's `safeUrl`, which allowed `http://`.
- **Prospect emails:** the field is gone, as in production, but production's one-time erase of emails saved on tours isn't ported (the demo never had real ones). The iPad still drops one from its own saved copy of the open tour.
- **Saved requirement templates:** production's swap of old saved texts (v1.24) isn't ported, for the same reason.
- **Tour times:** production's 8-week Rotation table (v1.22) never existed here; the by-day table went straight into Reports.
- **Framing:** `apps/_headers` keeps production's no-framing rule (ruling R2); the owner's portfolio site links to the demo instead of framing it.
- **Reconnect after a listener error:** D43 leaves the button out then, but the next re-check brings it back; ported as production has it (`docs/OPEN_ITEMS.md` #8).
- **Fixed here, not in production:** B7 (`docs/PRODUCTION_PORT.md`).
- **Known gaps:** `docs/OPEN_ITEMS.md` #5 and #6 (production behaves the same) and #7 (the iPad doesn't read a lease term saved from the Desk's Other concession).
- **Deleted Future Move-Ins:** this repo's B1 already kept a deleted tour lead as `deleted`; production's D46 (D45 here) now does the same for every lead, and this repo follows it for manual leads too, which B1 had erased.
- **Net under the rent in the Desk unit list:** rounded to whole dollars, like the iPad's (production's Desk prints the showsheet's number as is).
- **A tour with both a Max and price Flexible** is left out of "Shown within the prospect's price" here; production counts its Max (`docs/OPEN_ITEMS.md` #9).
- **Halloween** is 2026 only, as in production; the turkey and snow come back every year (D49).
- **The ❄ snow button** keeps production's color, below the 3:1 a control needs (`docs/OPEN_ITEMS.md` #10).
- **Data:** buildings, staff, prices, contest notes and quiz wording are invented; the sign-in question names Larkspur, the demo's landlord. The seed's older Reports tours have no size, price or date and stand for tours saved before D44.

## Portfolio cleanup (unreleased, demo copy only)
Code cleanup, plus the quote fixes listed first, which follow the owner's rulings (AUDIT.md §11, D19). At the end of this cleanup the footers read **Desk v1.21 / iPad v1.19**, the production builds this copy matched then, and the iPad's offline cache name moved with them; the port in the entry above moved them on to Desk v1.37 / iPad v1.29.

**Brought in from production** (Desk v1.20–v1.21, iPad v1.16–v1.19; each has tests written first; Desk v1.22 and iPad v1.20 onward are in the entry above):
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
