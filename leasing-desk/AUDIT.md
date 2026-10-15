# Phase 0 audit: Leasing Desk + Tour Companion (iPad)

**Date:** 2026-10-06 · **Scope:** everything under `leasing-desk/` · **Brief:** `docs/PORTFOLIO_BRIEF.md`, Phase 0
**Changed in the repo:** only this file. Every command below ran on a throwaway copy in the session scratchpad. The production folder on your Desktop was not opened.

**Real data and secrets in this file.** None are repeated here. Each one is listed as `file:line` plus a category, so this report can be committed as-is.

**Confidence labels:**
- **Ran:** I executed the real code and saw the result.
- **Code:** I read the code; I did not execute it.
- **Inference:** a judgment, not checked.

---

## 0. Summary

1. **Starting version:** Desk **v1.19** and iPad **v1.16**, the Oct 4 design pass. I could not compare it with your Mac (see §1). **You need to confirm this.**
2. **Baseline tests pass today (Ran):**
   - `npm test`: 8/8
   - `tests/desk_flows.sh`: 42/42
   - `tests/ipad_flows.sh`: 25/25
   - No console errors in any of the three.
3. **Secrets in the client (Code):**
   - The production Firebase config, in both apps.
   - The manager PIN, in both apps. It is the same PIN in both.
4. **Real data is everywhere (Code):**
   - The employer's name and initials.
   - Five real building addresses.
   - About 20 named staff and vendor contacts, with work emails and phone numbers.
   - Promo codes, lounge rates, garage prices, legal entity names, and live Netlify URLs.
   - The PWA icons show the employer's initials.
   - Details in §3.
5. **Security red flag (Ran):** the rules let anyone write tours and the showsheet, and some of that data reaches the page unescaped.
   - Proof: a unit's `sqft` and a tour's `id` both became live markup in the Desk.
   - This is a public-demo risk, not just a code-quality issue (§7, R2).
6. **Five behavior bugs, verified by running them (§8):**
   - Deleted Future Move-Ins come back.
   - The 45-day cutoff depends on the time of day.
   - The template editor's "Opening Line" does nothing.
   - The markup injection from item 5.
   - The History tab hangs when offline.
   - **Hard rule 1 means I fix none of these without your go-ahead.**
7. **Five money disagreements between the two apps' quoting logic (§8, M1–M5).**
   - Two of them touch the broker rules in the brief.
   - They need your call before Phase 3 locks them into tests.
8. **Structure:**
   - Two single-file apps: 5,711 lines and 2,014 lines.
   - The Desk script has 251 top-level functions and 88 globals.
   - 288 inline event handlers in total.
   - About 30 shared functions are copied byte-for-byte between the apps. That is decision D2, and I verified it.
9. **One brief item has no code behind it.** "Requirements tab math (45× / 75×)" is static text. Nothing calculates it (§6, Q7).

---

## 1. Which version this copy is

**Evidence the copy already contains the v1.19 / v1.16 batch (Code):**
- **Build stamps:**
  - Desk footer reads `Build v1.19` (`leasing-desk/index.html:1261`) and the published payload says the same (`:2069`).
  - iPad has `const BUILD = 'v1.16'` (`ipad-app/index.html:598`).
  - Service worker cache is `…-v1.16` (`ipad-app/sw.js:4`).
- **Busy-assistant marking (D17):** `busyNow`, `suggestNext` and `busyLabel` are in both apps (Desk `:2350–2359`, iPad `:1093–1102`).
- **Unpublished-showsheet warning:** `showsheetUnpublished()` at `leasing-desk/index.html:2003`, and the amber "Not on the iPads yet" line at `:2012`.
- **Audit fixes:** `CHANGELOG.md:9–50` and `audit/REPORT.md` describe the v1.19 / v1.16 batch as implemented and verified.
- **Recorded results:** the last runs in `audit/flows/*.json` show Desk 42/42 and iPad 25/25.
- **File dates:** files were modified Oct 4 between 14:16 and 14:22. That is the newest CHANGELOG entry.

**Not done: the brief's first step, "pull in the unpushed batch from my Mac".**
- `CLAUDE.md` says never to touch any folder outside this repo, and production is outside it.
- If the copy is older than your Mac's working tree, copy the newer `index.html` files in yourself and I will re-run this audit's checks.

---

## 2. File inventory

### App code and config

| File | Lines | Purpose |
|---|---:|---|
| `leasing-desk/index.html` | 5,711 | **Desk app.** CSS at 16–742 (727 lines), markup at 744–1539 (796), script at 1540–5709 (4,170). It holds the email builder (six templates), Tour Queue (queue, follow-ups, check-ins, Future Move-Ins, rotation, history), plan-tour dialog, showsheet / floor-plan Excel parsing, Dropbox sync, publish to iPads, quiz results and guided tour. 251 top-level functions (553 including nested), 88 top-level `let` / `var` / `const`, 210 inline event handlers, 238 inline `style=` attributes. |
| `leasing-desk/_headers` | 2 | Netlify header: no-cache on every path. |
| `ipad-app/index.html` | 2,014 | **iPad app** (to be renamed Tour Companion). CSS at 17–343 (327 lines), markup at 345–588 (244), script at 589–2012 (1,424). Tabs: Availability, Tour Planner (tour state machine, unit picker, quotes, rotation, wait panel), Requirements, More (net-rent calculator, building cheat sheet, training quiz). 328 functions, 62 top-level `let` / `var` / `const`, 78 inline handlers. |
| `ipad-app/sw.js` | 28 | Service worker. Network-first for the page, cache-first for icons and manifest, so the app opens offline. |
| `ipad-app/manifest.webmanifest` | 12 | PWA manifest (name, colors, icons). |
| `ipad-app/_headers` | 4 | Netlify headers: no-cache, and `sw.js` revalidated on every load. |
| `ipad-app/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | binary | Home-screen icons. **They show the employer's initials.** |
| `firebase/firestore.rules` | 64 | Production rules. Everything is world-readable. Writes are checked for field shape only. `delete: if true` on `tours` and `future_leads`. A catch-all rule requires sign-in for another production tool's data. |
| `.gitignore` | 10 | Ignores `node_modules/`, logs, preview files, `audit/`, `.playwright-cli/`. |
| `.gitattributes` | 2 | LF normalization. |

### Docs carried over from production

| File | Lines | Purpose |
|---|---:|---|
| `README.md` | 28 | Production README: apps, live URLs, drag-and-drop deploy, rules, security notes. **Its build stamp is out of date** (`:14` says a date label, while the code is on v1.19). |
| `CHANGELOG.md` | 126 | One entry per deploy, newest is v1.19 / v1.16 (Oct 4 2026). It explains why date-style labels were replaced by version numbers (D15). |
| `docs/DECISIONS.md` | 23 | Decision records D1–D17, including the unflattering ones: D3 single file / no build, D4 no logins, D14 no contact info. |
| `docs/DATA_MODEL.md` | 35 | Firestore collections, the tour lifecycle fields, browser-storage keys. Five keys the Desk uses are missing: `<prefix>_templates`, `<prefix>_emailMode`, `<prefix>_welcomeBuilding`, `<prefix>_pfaSubMode`, `<prefix>_tourSeen` (now `ld_*`). |
| `docs/TESTING.md` | 40 | Automated scripts, stub options, manual checklist. |
| `docs/DEPLOY.md` | 22 | Production Netlify drag-and-drop checklist. **Must not be followed** (CLAUDE.md). |
| `docs/BACKLOG.md` | 23 | Ranked backlog and known issues (tours not finished, appointment double-count, no listener retry). |
| `docs/ORIGINAL_CLAUDE.md` | 62 | Production CLAUDE.md: working rules, the shared-logic list, design rules, domain rules. Context only. |
| `ipad-app/SETUP.md` | 101 | Original setup and user guide for the iPad. **Stale in three places:** it says to confirm an old build stamp (`:16`), "kept for 14 days" (`:51`, but nothing deletes tours), and "Out today / Back in" (`:60`, the buttons now say Mark out / Mark back in). |

### Tests (`tests/`)

| File | Lines | Purpose |
|---|---:|---|
| `package.json` | 1 | `jsdom` and `xlsx` dev dependencies. `npm test` runs `node qa_future.js`. |
| `package-lock.json` | 957 | Lockfile; everything resolves from registry.npmjs.org. |
| `qa_future.js` | 34 | jsdom test of Future Move-Ins: 8 steps, against the unmodified Desk HTML with a stubbed Firestore. Written as dense one-liners. |
| `stub_firebase_seeded.js` | 181 | Reactive fake Firestore seeded with "a busy Tuesday" (about 40 tours, leads, quiz results). Used by all four Playwright scripts. |
| `stub_desk.js` | 9 | Minimal fake Firebase for manual previews. **No script uses it.** |
| `desk_flows.js` + `.sh` | 209 + 39 | Clicks through the Desk checklist in Chromium. 42 checks, results go to `audit/flows/`. The `.sh` also builds two fixture `.xlsx` files. |
| `ipad_flows.js` + `.sh` | 143 + 24 | Clicks through the iPad checklist in WebKit with iPad emulation. 25 checks. |
| `desk_capture.js` + `.sh` | 269 + 25 | Screenshots every Desk screen at 1440 and 1280. Also captures the exact email HTML per template, console errors and focus styles. |
| `ipad_capture.js` + `.sh` | 215 + 24 | Screenshots every iPad screen at 820×1180 and 1180×820. Also checks touch targets under 44pt and text below WCAG AA. |
| `compare_emails.js` | 17 | Byte-for-byte comparison of the email HTML from two capture runs. |

**Test dependencies:** all four Playwright scripts need the global `playwright-cli` (`npm i -g @playwright/cli`). It is not in `package.json`.

### Earlier UI audit (`audit/`)

`audit/` is **git-ignored** by `leasing-desk/.gitignore:9`. It holds 600 files and 95 MB.

| Path | Files | Purpose |
|---|---:|---|
| `audit/REPORT.md` | 1 (1,046 lines) | UI audit of v1.18 / v1.15 and its implementation as v1.19 / v1.16. Desk findings 1–31, iPad I1–I22, consistency C1–C13, heuristic scores, verification table. |
| `audit/before/`, `wip/`, `after/` | 105 / 104 / 107 | Desk screenshots (98 PNGs each), plus `capture.json` (email HTML, console errors, focus) and `.playwright-cli/` scratch (console logs, page snapshots). |
| `audit/ipad/before/`, `wip/`, `after/` | 81 / 87 / 93 | iPad screenshots (74 PNGs each), plus `capture.json` and `.playwright-cli/`. |
| `audit/flows/` | 22 | Last flow results (`desk_flows.json` 42/42, `ipad_flows.json` 25/25), the two fixture `.xlsx` files, two screenshots, one `.ics` download, scratch logs. Ten of the page-snapshot `.yml` files are empty. |

**`audit/` contains real data:**
- The three Desk `capture.json` files hold the full welcome and PFA email HTML: staff names, work emails, phone numbers.
- The Desk email screenshots render the same content.

---

## 3. Real data and secrets

**Proposed fix for all of it:** Phase 1 swaps every item below for invented values from one demo-data source. Phase 6's seed script reuses the same values.

### Secrets and production identifiers

| Where | What |
|---|---|
| `leasing-desk/index.html:1988–1995`, `ipad-app/index.html:590–597` | Production Firebase web config: apiKey (`AIza…`), project id, sender id, app id. It is public by design, but it points at the production database. |
| `leasing-desk/index.html:1987` (comment), `README.md:10`, `docs/DATA_MODEL.md:3`, `ipad-app/SETUP.md:4`, `tests/package.json:1` | Production project id. |
| `leasing-desk/index.html:2473`, `ipad-app/index.html:1992` | Manager / quiz PIN (11 digits). The same value is in both apps, in plain text. |
| `leasing-desk/index.html:751, 753` | Links to two other production tools on Netlify. |
| `README.md:7–8`, `docs/DEPLOY.md:14–15` | Live Netlify site names for both apps. |

### Employer identity

| Where | What |
|---|---|
| `leasing-desk/index.html:9, 748, 760` | Employer initials in the page title, nav label and tagline. |
| `ipad-app/index.html:10`, `manifest.webmanifest:2`, `sw.js:1, 4` | Employer initials in the title, manifest and cache name. |
| `ipad-app/*.png` | Icons with the employer's initials. |
| `leasing-desk/index.html:964, 1597–1700` (×5), `1754, 1779, 1797, 1803, 4142–4146, 4873–4875, 5239` | Employer name in the email text. |
| `leasing-desk/index.html:1589–1590, 1789–1802, 4898–4930` | Employer domains: resident portal, billing address, apply portal. |
| `leasing-desk/index.html:3204` | Employer initials in the `.ics` PRODID and UID. |
| Desk `localStorage` keys (`<prefix>_*`, `:1825–1904`) | The storage-key prefix carries the employer's abbreviation. |
| `README.md:1–3`, `docs/ORIGINAL_CLAUDE.md:1–3`, `docs/DECISIONS.md:11` | Employer name, and your title there. |

### Buildings

| Where | What |
|---|---|
| Desk `:892–898, 903, 934–935, 977–982, 1043–1048, 1188, 1326–1331, 1432, 4015–4019` | Five real street addresses in dropdowns and placeholders. |
| iPad `:465, 506` | The same five addresses in dropdowns. |
| Desk `:1564–1567, 1755–1756, 1803, 2123` | Office address and shuttle stops in email text. |
| Desk `:2206–2215, 4527, 4649, 5009, 5160, 5178` | Building numbers used as **logic keys**. |
| iPad `:599–600, 885–893, 1816–1822, 1867` | Building numbers used as **logic keys**. |
| Desk `:3391` | Two real local street names in the parser's building regex. |
| Desk `:2977–2986`, iPad `:1673–1682` | View options name real local landmarks. |
| iPad `:885–893, 896–906, 1880–1919` | Real opening dates, unit counts, floors, amenities and the lobby designer's name, plus transit, ferry and landmark talking points. |
| `README.md:3` | All five addresses. |
| Tests: `tests/*.js`, `tests/desk_flows.sh:15–22` | Real addresses in fixtures. |

### People

| Where | What |
|---|---|
| Desk `:1585–1586` | Two cable / internet vendor reps: names, emails, phones. |
| Desk `:1589` | A company IT contact: name and email. |
| Desk `:1611–1715` (welcome templates) | Building managers and leasing specialists: names, emails, a direct phone. |
| iPad `:1816–1830` | The same people plus property-management, resident-services and construction staff; front-desk phones; office phones. |
| iPad `:1921–1926` | Staff names inside quiz answers. |
| Desk `:2119` | Two leasing-manager first names, yours included. |
| Desk `:2381`, iPad `:1138` | Eight leasing-assistant first names. |
| Desk `:3115` | Your name in a UI error message. |
| Tests | The seeded stub, flows and `qa_future.js` use the real assistant first names (Desk `stub_firebase_seeded.js:87, 113` and others). |

### Pricing, policies and vendors

| Where | What |
|---|---|
| Desk `:1553–1562`, iPad `:902` | Garage price list and garage phone. |
| Desk `:1587–1588`, iPad `:896` | Vendor promo codes. |
| Desk `:1728–1781, 5009`, iPad `:888, 892, 900, 1902–1903` | Lounge hourly rates, deposits, capacity, payee name. |
| Desk `:5179`, iPad `:600, 888` | One building's monthly amenity fee. |
| Desk `:4345, 4525–4529` | Owning-LLC naming rule (real legal entities) and the security-deposit bank. |
| Desk `:4356` | A renters-insurance vendor link containing the employer's name. |
| Desk `:4336–4338, 4898–4975` | Payment, e-sign and screening vendors. **Inference:** low risk, but these identify the employer's stack. |
| Desk `:1407–1408`, `stub_firebase_seeded.js:54, 117` | Production showsheet and floor-plan filenames used as placeholders. |
| Desk `:793, 1965, 1974, 3548` | A production filename with the employer prefix. |

### Required by the brief, so it stays

- The 45× / 75× income rules and the $20 fee: Desk `:1571–1573`, iPad `:546–548`.

### Not found

- No real prospect names, prospect emails or prospect phone numbers anywhere in code or tests. Only `@example.com` addresses and invented first names.
- **Inference:** the seeded rents and broker names look invented. Please confirm, because you know the real showsheet.

### Two facts that constrain the fictional buildings (Code)

1. `bldgNum()` (Desk `:3275`) and `bnum` (iPad `:613`) find a building by the **first 4-digit number** in its name.
   - The parser only accepts a building header that starts with a 3–5 digit number and ends in a known street suffix (`:3391`).
   - So fictional buildings must keep that shape, for example "1200 Harbor Boulevard". A name like "The Juniper" would break unit lookup, floor-plan matching, walking times and every per-building rule.
2. Building numbers are logic keys, not just labels:
   - Which buildings get 14 vs 9 minutes per unit (`RICH`, `:2206`).
   - The walking matrix (`WALK`, `:2207`).
   - The office building as the walk start and end (`:2213–2215`).
   - Last-month incentives (`:4649, 5160`).
   - The amenity-fee note (`:5179`).
   - The LLC rule (`:4527`).
   - Lounge rates (`:5009`).
   - The iPad's building order, notes, info and staff tables.
   - Phase 1 must swap them one-to-one in both apps and the stubs.
   - **Inference:** that swap is the riskiest part of Phase 1. The existing flow tests plus the byte-compare of email HTML (after the same swap) are the safety net.

---

## 4. Dead code, commented-out code, console calls, duplicated logic

### Dead or unreachable (Code; usages checked with grep)

| Where | What |
|---|---|
| Desk `:2622–2630` | `renderWaitBar` body after `return;`: the old appointment grid. Its helpers `cycleAppt` (`:2612`) and `setAppt` (`:2222`), the `#apptGrid` markup (`:818`) and `.appt*` CSS (`:156–167`) are only used by it. |
| Desk `:2088–2106` | `openTourPicker`: nothing calls it, so the "Saved tours" dialog (`:1461–1472`) never opens. Its list element is still used, but **as a data stash**: `queueOpen` and `queueOpenHistory` put rows on `#tourModalList._rows` for `applyTour` (`:2588, 2780–2782`). |
| Desk `:3904` | `renderSelectedUnits() {}`: a no-op kept "for call-site compatibility", called from 9 places. |
| Desk `:1786–1787, 1798–1799` | `templates.*.introSingle` / `introMulti` are never read. The intros are hardcoded at `:5143–5150`. |
| Desk `:1785, 1797` | `templates.tour.opening` / `templates.inquiry.opening` are saved but never used in an email. This is bug B3. |
| Desk `:3270` | `escapeAttr` re-escapes `'`, which `escapeHtml` already escapes. |
| Desk `:228` | `.sent-btn`, labelled as a legacy class. |
| Desk `:2191` | `alert()` fallback in `toggleOut`. `toast` always exists, so it never runs. |
| Desk `:2501` | A `reduce` whose result is thrown away (`a && b` expression). The tally is computed twice. |
| Desk `:1854–1863` | Migration from an old single-template storage format. **Ask:** is any Desk still on that format? If not, it is dead. |
| iPad `:937, 965` | `setScheduleDay` and `setAppt` are copied from the Desk but never called on the iPad. |
| iPad `:969, 1026, 1080` (shared code) | `typeof renderTourQueue` guards for a function that only exists on the Desk. This is the cost of copy-paste sharing (D2). |
| `tests/stub_desk.js` | No script references it. |

### Commented-out blocks

- None. The `//` and `<!-- -->` comments are explanations, not disabled code. Checked with grep for commented-out statements.

### Console calls

- No `console.log` anywhere.
- Desk: 32 calls (20 `console.error`, 12 `console.warn`).
- iPad: 13 calls (9 `error`, 4 `warn`).
- All are in `catch` blocks or listener error callbacks.
- **Proposed fix:** a 10-line `logger.js` (Phase 5), so the error paths are kept but go through one place.

### Duplicated logic

**Across the two apps, by design (D2): verified identical.**
- I extracted the source of each of these from both files and diffed it:
  - Constants: `TYPE_OPTIONS`, `VIEW_OPTIONS`, `BED_OPTIONS`, `WAIT_CFG`, `WALK`, `RICH`.
  - Functions: `walkMin`, `estimateMinutes`, `estimateWait`, `rotationStats`, `outToday`, `scheduledToday`, `todayKey`, `apptDayKey`, `watchAvailability`, `watchAppointments`, `toggleOut`, `setAppt`, `setApptExact`, `waitText`, `profileSummary`, `typeSelectHtml`, `viewSelectHtml`, `toggleWaitPanel`, `waitPanelOpen`, `waitHeadline`, `linkFieldLabels`, `prefersReducedMotion`, `busyNow`, `suggestNext`, `busyLabel`, `openWaitPanels`.
- **The only differences:**
  - `waitPanelHtml`'s `READ_ONLY` flag, which is allowed.
  - `setScheduleDay`: the Desk copy has a PIN check (and the iPad copy is dead anyway).
- The `SHARED TOKENS` CSS block is byte-identical (D16).

**Across the two apps, not covered by D2, and implemented differently:**
- **Quote and net-effective logic:**
  - Desk: `formatConcession` `:3307`, `resolveConcession` `:3957`, `resolveOp` `:3942`.
  - iPad: `parseIncentive` `:1521`, `resolveStop` `:1533`, `calc` `:844`.
  - These are three implementations of the same rules, and they disagree in places (M1–M5).
- **Same logic, written twice:**
  - The tax-year flip: Desk `appConfTaxYears` `:4584`, iPad `taxYears` `:863`.
  - "Fits needs": Desk `deskFitsNeeds` `:3615`, iPad `fitsNeeds` `:1351`.
  - The HTML escape helper: `escapeHtml` `:3269`, `esc` `:611`.
  - The unit-key helpers: `bldgNum` / `normUnit` / `fpKey`.
- **Same data in both apps** (Firebase config, PIN, parking, shuttle, lounge rates, staff directory). It has **already drifted**: the billing email differs between Desk `:1590` and iPad `:1827`.

**Inside the Desk:**
- Excel red-fill detection and parsing appear twice: `handleShowsheet` `:3338–3367` and `loadShowsheetBuffer` `:3033–3047`.
- Floor-plan loading appears twice: `handleFloorPlanSheet` `:3543–3556` and `loadFloorPlanBuffer` `:3050–3055`.
- The two unit pickers are identical apart from element ids: `refreshAppConfUnitPicker` `:4463` and `refreshApvUnitPicker` `:4809`.
- The two unit-pick handlers are nearly the same: `onAppConfUnitPick` `:4440` and `onApvUnitPick` `:4786`.
- The local-date key `YYYY-MM-DD` is written **six** times: `:2168, 2218, 2361, 2540, 3141, 5044`.
- Month names twice: `:4489, 4609`.
- Appointment save code twice: `:2227–2231, 2284–2288`.
- The email font style and the `p` / `bold` helpers are redefined in six email builders: `:4295, 4866, 4997, 5060, 5097, 5212`.
- The default opening lines are hardcoded in three places (`:1174, 4141–4146, 5238–5240`) besides the templates.
- Building dropdowns are hardcoded seven times in the Desk and twice in the iPad, in two different orders.
- "Strip to digits and parse" money parsing is inline on 10 Desk lines and 7 iPad lines.

---

## 5. Functions over ~60 lines, or doing more than one job

Line ranges are from parsing the scripts with acorn.

| Function | Lines | Jobs it mixes |
|---|---|---|
| Desk `parseShowsheet` | 3382–3535 (154) | Building, bedroom and header detection; column mapping; Excel date normalization; availability rules; writes the global `units`. |
| Desk `buildAppConfHTML` | 4847–4990 (144) | Reads 13 DOM fields, applies three applicant variants, and builds the HTML. |
| Desk `buildUnitsEmailHTML` | 5106–5226 (121) | Opening and unavailable logic, per-unit block, building-specific notes, optional blocks. |
| Desk `renderTourQueue` | 2660–2779 (120) | Header counts, tab bar with "bump" animation, row builder for three tabs, Rotation tab including the 7-day table and schedule editor, queue sections. **The follow-up and check-in pipeline lives inside it as inline filters (`:2670–2677`), so it can't be tested on its own.** |
| Desk `buildApprovalHTML` | 4271–4373 (103) | Reads 16 DOM fields; deposit rule; payment-method variants; HTML. |
| Desk `renderUnitList` | 3683–3780 (98) | Filtering, grouping, badges, inline editors, animation. |
| Desk `selectedCardHtml` | 3996–4077 (82) | Two editor layouts (custom unit vs showsheet unit) in one template. |
| Desk `setMode` | 4088–4166 (79) | Buttons, body class, labels and per-mode side effects for six templates. |
| Desk `loadState` | 1822–1870 (49) | Nine storage keys plus a legacy migration. |
| Desk `computeApvNextRent` | 4672–4717 (46) | Pro-rata and concession waterfall math, mixed with reading 8 DOM fields. **The highest-risk money function, and it can't be tested as written.** |
| Desk `submitPlanTour` | 2881–2926 (46) | Validation, doc building, save, three UI outcomes. |
| Desk `estimateWait` / `waitPanelHtml` (shared) | 2235–2278 / 2293–2333 | The lane simulation is pure. The panel recomputes "who's busy" itself, separately from `busyNow`. |
| Desk `loadPublishedMeta` | 2017–2045 | The **newest-wins decision (D7)** is inline in a Firestore listener, together with adoption, storage writes and rendering. |
| Desk `dbxSync` | 3057–3077 | Fetch, hash, parse, publish, persist, toast. |
| iPad `showTourView` | 1207–1248 (42) | About 20 display flags derived from tour state. |
| iPad `renderQueue` | 1758–1793 (36) | Grouping, row HTML, wait panels. One line is 940 characters (`:1790`). |

---

## 6. Logic that handles money, ordering or dates (Phase 3 test candidates)

"Pure" means the function takes its inputs as arguments. "Globals" or "DOM" means it reads page state, so Phase 2 must lift it out unchanged before Vitest can test it. The existing flow tests and the byte-compare of email HTML protect that refactor.

### The brief's required list

| Brief rule | Code | Testable now? |
|---|---|---|
| **Broker rules** | iPad `quoteHtml` `:1548`, `resolveStop` `:1533`, `parseIncentive` `:1521`. Desk email: `formatConcession` `:3307`, `isAndStyleConcession` `:3305`, `resolveConcession` `:3957`, default flags in `applyTour` `:2797–2800`, `toggleUnit` `:3798`, `toggleSelectedFlag` `:3891`. | iPad: pure except the global `tour.broker`. Desk `formatConcession` / `resolveConcession`: pure. `applyTour`: DOM. |
| **Net rent, including per-tour overrides** | iPad `resolveStop` (free / OP / credit / rent overrides), `calc` `:844`. Desk `resolveConcession` (`rent×(term−free)/term − credit/term`, `:3974–3988`), `resolveOp` `:3942` (treats values over 12 as dollars). | `resolveStop`: pure. `calc`: DOM. Desk: pure. |
| **Rotation** (fewest started today; tie goes to the earliest last start; Out today / Back in) | `rotationStats` `:2360`, `suggestNext` `:2358`, `busyNow` `:2350`, `outToday` `:2170`, `scheduledToday` `:2169`, `toggleOut` `:2183` (keeps 14 days). | `rotationStats` reads the global `outToday`; the rest read globals or write Firestore. |
| **Return-time estimate** (unit count, buildings, walking time) | `estimateMinutes` `:2209`, `walkMin` `:2208`, `WAIT_CFG` / `RICH` / `WALK` `:2205–2207`, the "back ~" time in `busyNow` `:2353`, `estimateWait` `:2235` (lanes, appointments, assignee preference, 300-step guard), `waitText` `:2341`. | Pure apart from `Date.now()` and the global `apptByHour`. Needs a fake clock. |
| **Follow-up pipeline** | Queue, follow-up and check-in filters plus `dueLabel` inline in `renderTourQueue` `:2670–2677`. `checkInHtml` `:2110` ("yesterday" / weekday wording by calendar days). `flCaptureFromTours` `:3152`, `flFollowUpYmd` `:3143` (move-in − 30), `flIsDue` `:3144`, `flAddManual` `:3183`. | The filters must be extracted. The `fl*` helpers are pure. Capture writes Firestore. |
| **Stale open tours from an earlier day** | Desk `:2707–2710`, `:2770` (flag and section). `estimateWait` `:2241` and `busyNow` `:2352` ignore them. iPad guards: `loadTourLocal` `:1204`, `sendToQueue` `:1383`, `startTour` `:1503`, `editTour` `:1272`. | Inline / DOM. Needs extraction. |
| **Showsheet publish (D7, newest wins)** | `loadPublishedMeta` `:2024–2026`, `showsheetUnpublished` `:2003`, `adoptingPublish` guard `:1871–1888`, `publishShowsheet` `:2046`. | Decision is inline in a listener. Extract `shouldAdopt(pub, adopted, local)`. |
| **Requirements tab math (45×, 75×)** | **No code computes it.** It is static text at Desk `:1571–1572`, iPad `:546–547` and quiz answers `:1871–1872`. | Nothing to test. See question Q7. |

### Not on the brief's list, but money or dates (recommended)

| Rule | Code | Testable now? |
|---|---|---|
| Lease-approval pro-rata: daily rate × days, credit to month 2, concession month, carry-forward | `computeApvNextRent` `:4672` | DOM |
| Default concession month: 2nd month, or last month at one building | `refreshApvConcMonthOptions` `:4644` | DOM |
| Security deposit = initial rent, or a fixed reduced amount | `recomputeApvSecurity` `:4566`, `buildApprovalHTML` `:4284` | DOM |
| Lounge fee = hours × building rate (rounded); payment due = signed date + 7 days, local dates | `onPfaHoursInput` `:5034`, `buildPfaSignedHTML` `:5069–5071` | DOM |
| Tax years flip on April 16 | `appConfTaxYears` `:4584`, iPad `taxYears` `:863` | Pure (takes `now`) |
| Typed-date parsing | `parseTypedDate` `:4486`, `apvParseWordDate` `:4620`, `apvAddMonths` `:4631` | Pure |
| Showsheet parsing: money columns, Excel serial dates formatted in UTC, Occupied vs Immediately, App pending from red fill | `parseShowsheet` `:3382`, `parseFloorPlanSheet` `:3570` | Pure input, but writes globals |
| Price-range filter | `deskFitsNeeds` `:3615`, `fitsNeeds` `:1351` | Globals |
| Price formatting | `profileSummary` `:2960`, `formatRent` `:3271`, iPad `money` `:612` | Pure |
| Retention: appointments 7 days, availability 14 days, Desk queries 30 days / 800, iPad 10 days / 400 | `:2230, 2188, 2605, 1752` | Inline |
| iPad merge-save never erases Desk timestamps (D6); adopt remote edits unless typing is pending | `tourDoc` `:1712`, `syncOpenTour` `:1739` | Globals |

### Edge cases the brief asks for, with what the code does today (Code, plus Ran where marked)

- **No broker:**
  - iPad: prospect incentive only, never the OP.
  - Desk email: also strips the OP part from an AND-style incentive.
- **Zero incentive** (`No Incentive` or blank): both apps show no concession and no net-effective line.
- **Ties in rotation:**
  - The comparator returns `1` for tied values (`:2376`), which is inconsistent.
  - **Ran:** across 400 random rosters, V8 (the Desk in Chrome / Edge) and JavaScriptCore (the iPad in Safari) produced identical orders, keeping roster order among ties.
  - Low risk. Make it explicit in Phase 2.
- **Tours left open overnight:** flagged "Started on an earlier day", and excluded from busy and wait.
- **Move-in exactly 45 days out:** see bug B2. The answer depends on the time of day.

---

## 7. What a reviewer would flag, with proposed fixes

| # | Red flag | Evidence | Proposed fix | Phase |
|---|---|---|---|---|
| R1 | Production keys and a PIN in the client | §3, first table | Move Firebase config and the PIN into one `config.js` that reads from `.env` (template in `.env.example`). Use a separate demo Firebase project. Keep D4's "the PIN is a deterrent" note. | 1 |
| R2 | **Stored markup injection from world-writable data** (Ran, bug B4) | Rules accept writes from anyone. Unescaped values: `sqft` (`:3740`), tour `id` inside 16 single-quoted `onclick` attributes (Desk `:2102–3222`, iPad `:1134, 1262–1263, 1787, 1790`), quiz `pct` / `score` / `total` (`:2502`), floor-plan `href` accepts any URL scheme (iPad `:811, 1305`). | Escape every interpolated value. Pass ids through `data-` attributes with one delegated click listener. Allow only `https:` links. Legitimate data looks the same afterwards. **Needs your OK under hard rule 1.** | 2 |
| R3 | Anyone can delete every tour, overwrite the showsheet or change settings | `firestore.rules:23, 52`, and writes that check field shape only | Demo project: Firebase anonymous auth plus rules that require `request.auth`, and field-level validation. Document what the rules allow. D4 (no logins for staff) stays true. | 6 |
| R4 | Two very large single files, 288 inline handlers, 302 inline styles, 150 globals, lines up to 940 characters | §2, §5 | Phase 2 split. Note: **native ES modules (`<script type="module">`) let both apps import the shared files with no build step**, which retires D2's copy-paste. It does mean `file://` stops working, so "run locally" becomes `npx serve`. **Your call** (Q9). | 2 |
| R5 | Quoting logic written three times, and the copies disagree | M1–M5 in §8 | One `pricing.js` used by both apps, once you have ruled on M1–M5. | 2–3 |
| R6 | The core rules can't be unit-tested (DOM reads, inline filters) | §6 | Lift pure functions out unchanged. The flow tests and the email byte-compare guard the refactor. | 2 |
| R7 | Test tooling | A global `playwright-cli`, a 34-line one-liner jsdom test, no CI, real names in the seed | Vitest for units. Keep the Playwright scripts as end-to-end and document them. Readable test names (the brief's "reads like a rule"). Seed from demo data. | 3, 6 |
| R8 | Docs out of date | `README.md:14`; `SETUP.md:16, 51, 60`; `ORIGINAL_CLAUDE.md:14` still says about 5k / 1.8k lines; DATA_MODEL is missing 5 storage keys | Rewrite the README per the brief. Move ORIGINAL_CLAUDE.md, DEPLOY.md and SETUP.md into `docs/history/` or delete them. **Ask** (Q5). | 4 |
| R9 | No error handling on some reads (Ran, bug B5) | `loadHistory` `:2513` | Catch the error and show the existing offline message. | after OK |
| R10 | Unbounded history collection | `publishShowsheet` writes a full snapshot to `showsheet_history` on every publish, including every Dropbox auto-sync (`:2075`). The comment says pruning is manual. | Document it, or keep the last N. **Behavior change: ask.** | 4 / later |
| R11 | Confusing names | `leasing-desk/leasing-desk/index.html`; "toolkit" in code means the Desk (`source: 'toolkit'`); `startTour()` means two different things in the two apps (ORIGINAL_CLAUDE:18) | Folders `apps/desk/` and `apps/tour-companion/`. Rename the Desk's guided-tour `startTour` to `startGuidedTour`. Keep the Firestore value `'toolkit'` (data contract). | 2 |
| R12 | Calls to a Netlify function that isn't in the repo | `/.netlify/functions/dbx` (`:3023`) | Remove it, or document it as optional. **Ask** (Q10). | 2 |
| R13 | Real data in `audit/` | §2 | Keep it out of the public repo (it already is git-ignored). Regenerate screenshots from demo data after Phase 6 for the README GIF. | 6–7 |

### Strengths worth keeping visible (Inference: these are what a reviewer would credit)

- Decision records D1–D17, including the uncomfortable ones.
- Tests that load the **unmodified** HTML with a stubbed Firestore and a pinned clock.
- A byte-for-byte check that refactors don't change the Outlook email HTML.
- An explicit list of logic shared between the two apps.
- Offline honesty: no made-up "No wait" while disconnected.
- Accessibility and touch-target work that is measured, not claimed.

---

## 8. Behavior bugs and money disagreements found during the audit

Per hard rule 1, **none of these are fixed**. Each needs one of two answers from you:
- **(a) Keep the behavior.** I document it as a known issue and pin it with a test marked as current behavior.
- **(b) Fix it** in its own clearly labelled commit after Phase 3. The test is written first.

### Bugs (all Ran, on a copy, through the real code)

| # | Bug | How it shows | Cause |
|---|---|---|---|
| B1 | **A deleted Future Move-In comes back immediately** | Delete `tour-far`; the list still holds `tour-far`. | `flDelete` (`:3179`) removes the document. The leads listener then re-runs `flCaptureFromTours` (`:3148, 3152`), which re-adds any tour in the 30-day window that has no lead. The existing test only deletes a manual lead (`qa_future.js:32`). |
| B2 | **The 45-day cutoff depends on the time of day** | Move-in exactly 45 days after the tour: captured for tours started at 9:00 and 11:00, not captured for 13:00 and 17:00. | The gap is measured from the tour's start time to move-in at local noon (`:3140, 3158–3159`). The brief says "more than 45 days", so exactly 45 should never be captured. |
| B3 | **The template editor's "Opening Line" (Tour and Inquiry) has no effect** | Edit it, Save, preview: the old line is still there. The new text is saved in `templates.tour.opening`. | The email reads the `#openingLine` box, whose defaults are hardcoded (`:1174, 4141–4146, 5238–5240`). The Inquiry template's default even contains `{unit}` / `{building}` placeholders that are never filled in (`:1797`). |
| B4 | **Shared data becomes markup** | A unit with `sqft` set to `<b id=…>` renders a real element. A tour `id` containing `'` adds an attribute to its button. | See R2. |
| B5 | **History tab stuck on "Loading history…" when the query fails** | Text stays "Loading history…" and there is 1 unhandled promise rejection. | No `catch` in `loadHistory` (`:2513`). |

### Money disagreements (Ran; same inputs through both apps' real functions)

| # | Case | iPad says | Desk / showsheet says |
|---|---|---|---|
| M1 | "2 Months Free on 24-Month Lease", rent $8,950, showsheet net effective $8,204 | **$7,458** | **$8,204** |
| M2 | Custom unit with "½ Month Free" (the ½ character) and no showsheet net effective | Net effective $4,000, which is the full rent | Not applicable (the Desk only shows a net effective it was given) |
| M3 | Text mixing "and" and "or": "1 Month Free and $500 Credit OR 1 Mo. OP" | Treated as **AND**: broker gets the OP *and* prospect gets net | Treated as **OR** |
| M4 | Broker tour, **AND** unit (1 Month Free and ½ Mo. OP) | "$6,450 · … AND ½ Mo. OP · Net effective $5,913 · broker also gets the OP" | Email: "Concession: 1 Month Free and 1/2 Mo. OP", **no net-effective line**. The brief's rule says the prospect gets the net rent. |
| M5 | Broker tour, **OR** unit, iPad per-tour override "½ month free" | Quotes the OP to the broker; net only if the broker waives | Email offers the prospect "½ month free … Net Effective $3,977" and **drops the OP** |

**Why each one happens:**
- **M1:** the iPad uses a parsed month count before the showsheet's net effective, with `term = 12` hardcoded (`:1535, 1541`).
- **M2:** the month-count regex only reads digits and `n/n` (`:1528`), so the ½ character counts as zero months.
- **M3:** the two apps classify the text with different rules: iPad `:1530`, Desk `:3305`.
- **M4:** `applyTour` turns off "show net effective" for any tour with a broker (`:2798`).
- **M5:** `applyTour` turns off "OP only" when a free-month override exists (`:2799`), and "Other concession" ignores the broker flags (`:3963–3989`).

**Standard cases match the brief (Ran):**
- No broker on an OR unit: the iPad quotes "1 Month Free · Net effective $3,804".
- Broker on an OR unit: the iPad quotes "1 Mo. OP to the broker · if the broker waives: 1 Month Free → net $3,804".
- No broker on an AND unit: the OP is stripped.
- The calculator gives $4,150 with 1 month free on 12 months → $3,804.

---

## 9. Things I don't understand, or need you to decide

- **Q1. Starting version (§1).** Is this copy the same as your Mac's unpushed v1.19 / v1.16 working tree?
- **Q2. Where the repo lives.**
  - The brief says a new `portfolio-demos/<project>/` repo with fresh history.
  - We are in `build-portfolio/leasing-desk/`, inside a repo that has no commits yet.
  - Confirm this is the target, and that phase commits go into the `build-portfolio` history.
- **Q3. Bugs B1–B5:** keep and document, or fix after Phase 3? My recommendation:
  - Fix B4 and B5 now. They change nothing visible for normal data.
  - Ask you about B1–B3.
- **Q4. Money M1–M5:** which app is right in each case? These decide what the Phase 3 tests assert.
  - M4 and M5 touch the brief's broker rules directly.
  - **For M1:** do real showsheets ever carry multi-year or week-based incentives? If not, M1 is only a test-data artifact.
- **Q5. Production docs.** What should happen to `docs/ORIGINAL_CLAUDE.md`, `DEPLOY.md`, `ipad-app/SETUP.md` and `audit/REPORT.md` in the public repo?
  - Options: keep a cleaned copy as history, fold their facts into the new README and decision records, or delete.
  - The UI audit report is good evidence of process, but it is full of real names and screenshots.
- **Q6. Your own name.**
  - It appears as a staff member (Desk `:2119, 2381, 3115`; iPad `:1138`).
  - I'd replace it with a fictional one like the rest of the staff, and keep your name only in the README credits.
- **Q7. "Requirements tab math (45×, 75×)."** Nothing computes it. Options:
  - (a) Test that the displayed rules come from two constants.
  - (b) Add a tiny `incomeNeeded(rent)` helper used by the text. That is close to a new feature, which Part 6 says to avoid.
  - (c) Drop it from the test list.
  - I'd pick (a).
- **Q8. Storage-key prefix.**
  - The `<prefix>_*` storage keys and the service-worker cache name carry the employer's abbreviation.
  - Renaming them is a behavior change for an existing browser, but there are none in the demo.
  - OK to rename to neutral names?
- **Q9. Phase 2 shape.** Native ES modules with no build step (shared code imported by both apps, D2 retired), or keep two self-contained files that only split CSS and JS?
  - The brief says "no build tool unless one already exists". ES modules need no build tool, but they do need `npx serve` to run locally.
- **Q10. `/.netlify/functions/dbx`** (`:3022–3025`). Does this Dropbox proxy exist in production? It isn't in the copy. If not, I'll remove the call.
- **Q11. Dropbox sync in the demo.** It needs real shared links. Should the demo hide it, keep it with a note, or point at a demo file?
- **Q12. Fictional buildings** must keep a "#### Street Suffix" shape (§3). Do you have names in mind? Otherwise I'll propose five.
- **Q13. Legacy template migration** (`:1854–1863`). Is any Desk still on the old single-template format? If not, I'll treat it as dead code.

---

## 10. How this audit was done

- **Read in full:** both `index.html` files, `sw.js`, the manifest and headers, the rules, all docs, all test scripts and stubs.
- **Skimmed:** `audit/REPORT.md` by section; the screenshots and scratch logs were not opened, only counted.
- **Function sizes and the shared-logic diff:** the inline scripts were parsed with `acorn`, and each named function's source was extracted and compared between the apps.
- **Ran, on a copy in the session scratchpad:**
  - `npm ci` and `npm test`: 8/8.
  - `tests/desk_flows.sh`: 42/42.
  - `tests/ipad_flows.sh`: 25/25.
  - Two probe scripts using `qa_future.js`'s jsdom harness, for B1–B5 and M4–M5.
  - A probe of the iPad's real `parseIncentive` / `resolveStop` / `quoteHtml`, for M1–M3.
  - The real `rotationStats` in V8 and in JavaScriptCore (`jsc`), to compare tie order.
  - None of these files are in the repo.
- **Real-data scan:** grep across `leasing-desk/` (excluding `audit/` and the lockfile) for keys, emails, phone numbers, URLs, staff names, the employer's name and building numbers. Then a separate check of `audit/`.

---

## 11. Rulings (approved 2026-10-06)

The audit is approved. Line numbers above refer to the files as copied, before Phase 1; Phase 1 shifts them.

### Money rules (what the Phase 3 tests assert)

- **M1. The Desk is correct.** Net effective uses the unit's actual lease term. The iPad must use the unit's term instead of assuming 12 months.
- **M2.** Both apps parse the `½` character the same as `1/2`.
- **M3.** Mixed text such as "1 Month Free and $500 Credit OR 1 Mo. OP" is an **OR** incentive. The Desk is correct; the iPad's classifier is wrong.
- **M4. Bug in the Desk.**
  - Follow-up emails go to both the prospect and the broker.
  - On a broker tour with an **AND** incentive, the email shows the prospect's net effective rent together with the broker's OP.
  - The Desk hides net effective on every broker tour, which applies the OR rule too broadly. The iPad is correct.
- **M5. Bug in the Desk.**
  - A per-tour override changes concession **amounts** only. It never changes the broker rule.
  - Broker tour, OR incentive, overridden prospect concession: the broker is quoted the OP, and the prospect gets the overridden concession only if the broker waives.
  - The iPad is correct.
- **Broker banner.**
  - The iPad's "quote the OP only, unless the broker tells you to quote the net rent" is right for OR incentives only.
  - On AND incentives, net effective is always shown with the broker's OP.
  - I will propose a scoped or reworded banner and ask before changing it.
- **Override capability.**
  - Both apps can override the prospect concession, the broker OP (on the iPad, when "Touring with a broker" is checked) and the credit.
  - Only the Desk has the AND/OR selector and the lease-term field.
  - To do: record this in the decision records, and make the Desk email honor its own AND/OR selector.

### Follow-up rulings (Phase 3, 2026-10-06)

These settle the cases the Phase 3 tests surfaced. The tests in `tests/unit/money-rulings.test.js` assert them.

- **Lease term (M1).** Both apps read the term from the incentive text, for example "on 24-Month Lease", "24-Mo Lease" or "24 month lease". With no term written, the lease is 12 months. After an iPad override, the Desk email uses the unit's term too, since the iPad has no term field.
- **Mixed numbers (M2).** A whole number before a fraction adds to it: "1 1/2" and "1½" both mean 1.5 months.
- **Credits (M3 and all overrides).** A credit is quoted next to the rent and never included in the net effective. This covers credits written in the showsheet text, per-tour credits on the iPad and at the Desk, and the iPad's rent calculator. It does not cover the Lease Approval rider, which bills a credit against a specific month. An "include in net effective" toggle on a credit goes to the backlog.
- **Broker tour on a unit with no OP (M4).** The Desk email shows the prospect's net effective, as the iPad does. Adding an OP to a unit whose showsheet lists none isn't a real workflow; it is an example for the approved-incentives safeguard (backlog item 1).
- **The Desk's AND/OR selector (D19).** When "Other concession" has both free months and an OP, the unit's checkboxes follow the selector. Either/or shows "OP only": ticked quotes the OP alone; unticked quotes the free months and the net. Both (AND) shows "No broker": ticked drops the OP; unticked quotes both with the net. Defaults come from the tour's broker flag.

### Bugs

- B1–B5 are all fixed, each in its own commit after Phase 3, with the test written first.

### Backlog (record only; don't build during cleanup)

*Both items were dropped later: production tried concession guardrails and removed them (D21).*

1. A stored list of currently approved incentives. Any override outside it is flagged, and the user confirms before the email is built. This is the first feature after cleanup.
2. A confirmation step on any override, showing exactly what the email will say.

### Answers to §9

- **Q1.** This copy is the v1.19 / v1.16 batch. It was committed and pushed to its own branch, then copied.
- **Q2.** `build-portfolio` is the target repo, and phase commits go into its history. Scratchpad copies are fine for test runs; the "outside this repo" rule is about production.
- **Q5.**
  - Fold the facts from `ORIGINAL_CLAUDE.md`, `DEPLOY.md` and `SETUP.md` into the new README and decision records.
  - `audit/REPORT.md` stays out of the public repo; the README summarizes the audit process instead.
- **Q6.** Replace the owner's name in the app with a fictional staff name. The owner's name appears only in the README credits.
- **Q7.** Option (a): test that the displayed 45× and 75× rules come from two constants.
- **Q8.** Rename the storage-key prefix and the service-worker cache name to neutral names.
- **Q9.**
  - Native ES modules, no build step.
  - Retire D2: both apps import one shared pricing module.
  - Document `npx serve` for running locally.
- **Q10.** Unknown whether the Dropbox proxy function exists in production; the owner will check. Until then the call is optional and documented.
- **Q11.** Hide Dropbox sync in the demo, with a note that production syncs from a shared Dropbox file.
- **Q12.** Propose five fictional buildings in the "#### Street Suffix" shape.
- **Q13.** Unknown; the owner will check the data shape. Until then the migration code stays and is flagged.

### Security (Phase 6)

- The demo uses Firebase anonymous auth, plus rules that require `request.auth` and validate fields.
- D4 (no staff logins) stays true.
- The same fix will later go to production in a separate session. Record anything that session needs.
