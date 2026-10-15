# Testing

## Automated

### Unit tests (`npm test`)
Vitest, in Node, against the rule modules the apps themselves import (`apps/shared/` and `apps/desk/js/rules/`): no browser, no DOM, no Firebase. Each test name states the rule it checks, for example "broker on an OR unit: the OP goes to the broker; the prospect gets the free month only if the broker waives". The clock is faked where a rule depends on "now", and the time zone is pinned to New York so the date rules cross a clock change on every machine.

| File (`tests/unit/`) | Rules |
|---|---|
| `broker-rules`, `net-rent` | What the Desk email and the iPad quote say with and without a broker, on OR, AND, OP-only and no-incentive units; net effective; the iPad's per-tour overrides; the Desk's "Other concession" |
| `money-rulings` | The rulings on the cases where the apps disagreed (AUDIT.md M1–M5, with the follow-up rulings) and the Desk's own AND/OR selector (D19) |
| `rotation`, `wait-estimate`, `stale-tours` | Who goes next, who is busy and until when, Out today / Back in, tour length from units / buildings / walking, the wait simulation, tours left open overnight |
| `follow-up-pipeline` | Current Queue → Follow-Ups to Send → Check-In, when the check-in is due, the check-in wording, Future Move-Ins capture and follow-up dates |
| `showsheet-publish`, `showsheet-parse` | Newest publish wins (D7), the "not published" warning, the Floor Plan Links line with and without a file name, reading the showsheet and floor plan master |
| `lease-approval`, `pfa`, `requirements` | Pro-rata rider, concession month, deposit, typed dates; lounge fee and due date; the 45× / 75× / $20 rules come from one place; tax years |
| `service-worker` | The iPad's offline shell lists exactly the modules the app imports |

### Browser flows and captures
Every script loads the apps **unmodified** from `apps/` in a real browser. The Firebase CDN script is answered with a fake Firestore, the generated `config.js` with `tests/config.test.js`, and the clock is pinned to Tue Oct 6 2026, 2:10 PM in New York time (`tests/cli.config.json` sets the browser's time zone), so every run is identical on any machine. Nothing touches a real Firebase project.

Setup: the Playwright CLI (`npm install -g @playwright/cli`, plus `playwright-cli install-browser webkit` for the iPad) and `npm install` in the project root. Output goes to `audit/` (git-ignored). `npm run test:flows` runs the three flow scripts in a row.

| Script | What it does |
|---|---|
| `tests/future_flows.sh` | Future Move-Ins (auto-capture at 45 days, no duplicates, due counts, manual add, Contacted / Reopen, the Outlook `.ics`, Delete, and a deleted auto-captured lead staying deleted) on `tests/stub_firebase_future.js`. |
| `tests/desk_flows.sh` | Clicks through the **Desk checklist below** (plan tour → … → History Undo, wait buttons, Rotation, Future Move-Ins + .ics, Dropbox **Sync now** against fixture files). Prints PASS/FAIL per step; exits non-zero on any failure or console error. |
| `tests/ipad_flows.sh` | Same for the **iPad checklist** in WebKit with iPad emulation (the quiz PIN prompt is cancelled, never typed). |
| `tests/demo_check.sh` (`npm run test:demo`) | The in-browser demo as a visitor gets it: `apps/` served by Python's static server, a fresh browser, every outside request blocked. Opens `desk/demo/` and `tour-companion/demo/` and checks the banner, the seeded showsheet, queue and wait estimate, a built follow-up email, Today's tours and the quiz, with no console errors and no outside requests. It also checks that Floor Plan Links taken from a publish (no file name) shows only the time, that a unit with no floor plan link is flagged in the list and gets the placeholder in the email, and that a published unit with only a building, number and rent puts "undefined" nowhere on the Desk. |
| `tests/desk_capture.sh before\|after` | Screenshots every Desk screen at 1440 and 1280 → `audit/<phase>/`, plus `capture.json` with console errors, keyboard-focus checks and the exact Preview & Copy HTML per template. |
| `tests/ipad_capture.sh before\|after` | Screenshots every iPad screen at 820×1180 and 1180×820 → `audit/ipad/<phase>/`, plus touch targets under 44pt and text below WCAG AA per screen. |
| `tests/site_screenshots.sh` | The six README screenshots of the demo, 1440 px wide, into `docs/screenshots/` (same static server and pinned clock as `demo_check`). |
| `node tests/compare_emails.js audit/before audit/after` | Byte-for-byte check that a change didn't alter the Outlook email HTML (run both captures first). |

The flows and captures use `apps/shared/demo/fake-firestore.js` (the same one the in-browser demo runs on), a reactive fake Firestore seeded with a busy Tuesday (tours in every state, a week of history, quiz results, future leads). Seed options (set `window.__SEED_OPTS`): `seedLocal` (Desk browser storage), `dbx` (Dropbox sync on), `empty`, `offline`, `ipadCache`, `stale`, `hostile` (quotes, markup and a `javascript:` link in shared fields; the Desk and iPad flows check that none of it becomes markup, runs, or links).

How the scripts reach inside the page: functions the HTML calls are on `window` (see each app's `main.js`); anything else is read with an in-page `import()` of the app's own module, e.g. `(await import(new URL('js/state.js', location.href).href)).state`.

Screenshots of unchanged code can differ slightly between runs (sub-pixel text placement in the queue rows, background dithering on full-page shots, random quiz order), so compare a change against more than one baseline run.

Still missing (backlog): one test that runs a tour across a Desk and an iPad at the same time.

## Manual checklist (until the suites are rebuilt)
Run the parts touched by the change. Use a test prospect name and delete it afterwards.

**Desk**
- [ ] Page loads, footer shows the new build, no console errors.
- [ ] Showsheet: Dropbox line shows; **Sync now** works (or Upload + Publish if sync is off).
- [ ] Email Builder: each template (Tour, Inquiry, Welcome, PFA, App Confirmation, Approval) renders; add a showsheet unit and a custom unit; floor plan fills in; **Copy for Outlook** pastes correctly into Outlook.
- [ ] **+ Plan tour** → send to queue → assign → Start → Finish → appears in Follow Ups → ✓ Mark Sent → Leasing Manager Check-In → Copy check-in → ✓ Mark Sent → History shows both, Undo works.
- [ ] Wait estimate panel on a waiting row; appointment buttons change the estimate.
- [ ] Rotation tab: counts, Mark out / Mark back in.
- [ ] Future Move-Ins: a tour with a far move-in appears; + Add future lead; Add to Outlook downloads a file that opens in Outlook.

**iPad (Safari, ~820px)**
- [ ] Version line shows the new build.
- [ ] Availability search; Tour Planner: new tour → pick units → Start → summary + building cards → Finish (also from Today's tours).
- [ ] New inspection → Start → one-line bar → Finish.
- [ ] A tour open on the iPad updates when the Desk finishes it.
- [ ] More → calculator, cheat sheet, training quiz (start one question, exit with PIN).
