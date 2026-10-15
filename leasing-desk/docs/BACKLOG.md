# Backlog

Ranked within each section. When something ships: move it to `CHANGELOG.md` and delete it here.

## First after the portfolio cleanup (owner's priority; not built during the cleanup)
1. **"Include in net effective" toggle on a credit.** Credits are quoted next to the rent and left out of the net effective (D19). A toggle on the credit, in both apps, would mark the rare credit that should be spread into the net.

## Next up
1. **Check v1.19 / v1.16 on real devices**: paste one Copy for Outlook email into Outlook (the HTML is byte-identical to v1.18, so this should be a formality), and glance at one dropdown on a real iPad (e.g. Free months in the calculator) to confirm it's as tall as the text boxes.
2. **"New version available — Reload" banner** on both apps (check the deployed build every few minutes; banner, not forced reload — see D5).
3. **Rebuild automated tests — partly done.** `tests/desk_flows.sh` and `tests/ipad_flows.sh` click through the TESTING.md checklists, and `tests/desk_capture.sh` / `tests/ipad_capture.sh` open every screen (see TESTING.md). Still missing: one test that runs a tour across a Desk *and* an iPad at once, and running the Playwright scripts without the global `playwright-cli`.
4. **Confirm "2 Bed, 3 Bath"** in the unit type list (unusual layout — keep or remove).
5. **iPad: Start tour in a dead zone (audit I14).** Test Start tour / Send to queue in airplane mode on a real iPad. If the screen seems to freeze until the connection returns, show the started screen immediately and save in the background. Left out of v1.16 on purpose.

## Known issues
- **Tours not finished reliably** by assistants → skews rotation and wait estimates. Proposed: auto-finish at 6 PM.
- **Appointment double-count**: when a queued tour starts during a half-hour slot that also has an appointment answer, it's counted twice. Proposed: auto-remove one appointment from the current slot.
- Neither app re-subscribes if the tours listener itself errors (rare: rules or quota, not a normal Wi-Fi drop). Both now say to reload / reopen. A retry would remove that step.

## Ideas (not committed)
- CSV export for History and quiz results.
- Weekly summary line in History (tours, follow-ups sent, check-ins sent per assistant).
- Wait estimator self-tuning from real tour durations (needs reliable Finish data first).
- Future Move-Ins: "Open in Email Builder" with name + preferences prefilled.
- Outlook calendar integration via an IT-registered Graph app (blocked today).
- Sign-in for managers (would allow storing contact info and real PIN security).
