# Data model

One Firebase project (Firestore); its web config comes from `.env` (see `.env.example`). Rules: `firebase/firestore.rules`. Timestamps are ISO strings (`…Iso`); dates are `YYYY-MM-DD`.

## Collections
| Path | Written by | Contents |
|---|---|---|
| `showsheet/current` | Desk (Publish or Dropbox sync) | `units[]` (Desk unit objects), `floorPlans[]` (`{key, url}`, key = `bldg\|unit`), `publishedAtIso`, `publishedBy`, `unitCount`, `filename`. Every Desk + iPad follows it live; newest wins. Two unit fields come from the showsheet's NOTES column, and only when set (the note text itself is never published): `availStatus` (`'occupied'` or `'reno'`, on a unit with an available date; D29) and `contest` (a note that mentions a gift card, as written with spaces collapsed, up to 120 characters) with `contestUntil` (`YYYY-MM-DD`, when the note has a date); the Desk's unit list shows the contest through that day, and nothing else does (D34). `backupApps: true` on a unit whose number cell is filled orange (`FFC000`): "Backup apps welcome", still on the market, so `hasApp` stays false (D48); left out otherwise. |
| `showsheet_history/{id}` | Desk | Create-only snapshots of past publishes. |
| `tours/{id}` | Desk + iPad | See below. Always `set(…, {merge:true})`. |
| `settings/assistants` | Desk (PIN) | `names[]`. |
| `settings/schedule` | Desk (PIN) | `byName{name: [weekday 0–6]}`. |
| `settings/availability` | Desk (the iPad stopped using it, D20) | `byDate{YYYY-MM-DD: [names marked out]}`, `inByDate{YYYY-MM-DD: [names marked back in]}` — overrides on top of the weekly schedule; reset each day. |
| `settings/appointments` | Desk | `byDate{YYYY-MM-DD: {'14.5': {tours, insp, asked}}}` — Outlook appointments per half hour. |
| `settings/dropboxSync` | Desk | `showsheetUrl`, `floorplanUrl`, `ssHash`, `fpHash`, `lastCheckIso`, `lastSyncIso`. The Desk changes the two links only after the manager PIN and downloads only Dropbox links (D41); the database itself checks neither. |
| `future_leads/{id}` | Desk | `id` (`tour-<tourId>` or `m-<time>`), `source` (`tour`/`manual`), `name`, `assistant`, `tourDate`, `moveIn`, `followUpDate`, `criteria`, `units`, `status` (`open`/`contacted`/`leased`/`lost`/`deleted`), `statusBy`, `statusAtIso`, `createdAtIso`, `updatedAtIso`. No contact info (D14). **`deleted`** (D45): Delete marks any lead, from a tour or added by hand, with `statusBy` and `statusAtIso` instead of erasing it; it's hidden from every list and count and kept so the capture doesn't add it again. The capture runs only after the leads list has loaded and only creates a lead whose ID isn't in the database; it never writes over one. |
| `quiz_results/{id}` | iPad | Create-only: `name`, `dateIso`, `startedAtIso`, `score`, `total`, `pct`, `passed`, `missed[]` (`{q, chosen, correct, category}`). Reports reads the newest 200. |
| everything else | — | Requires sign-in (other apps' data in the same project). |

## `tours/{id}`
- Identity: `id`, `kind` (`tour`/`inspection`), `prospect` ("Karen M."), `prospectFirst`, `prospectInitial`, `assistant`, `broker`, `brokerFirst`, `brokerLast`.
- No contact details: there is no prospect email field anywhere, not on tours, Future Move-Ins or the iPad's saved copy of the open tour (D14, D40).
- Content: `stops[]` (`{key, building, unit, type, sqft, view, monthly, netEff, incentive, avail, rent, free, term, op, opMode, credit, notes, custom…}`): `monthly` / `netEff` / `incentive` / `avail` = the showsheet's rent, NET EFF, concession text and availability when the apartment was added; `rent` / `free` / `op` / `credit` = what was typed on the tour (blank or 0 = the showsheet's); `opMode` (`and`/`or`) = how the concession and the OP combine; `term` = the lease term in months the net is worked out over (the unit's own, from its incentive text, 12 when none is written; on the Desk, the "Other concession" term when one was typed). Reports prices each showing from these (D36, D37). `profile{beds[], priceMin, priceMax, priceFlexible, moveIn, flexible, mustHaves}`.
- Profile (what the prospect asked for at sign-in): `beds` = sizes; `priceMin` / `priceMax` = whole dollars per month (numbers, or `null`); `priceFlexible` = true when the prospect gave no top price (D44); `moveIn` = `YYYY-MM-DD` or `''`; `flexible` = the **move-in** date is flexible; `mustHaves` = free text. A prospect tour can't be queued or started without at least one size, `priceMax` or `priceFlexible`, and `moveIn` or `flexible` (D44); older tours, inspections and iPad drafts not yet sent can lack them.
- Lifecycle: `createdAtIso` → `queuedAtIso` (waiting) → `startedAtIso` → `finishedAtIso` → `followUpSentAtIso` / `followUpSentBy` → `checkInSentAtIso` / `checkInSentBy`. Also `headsUpSentAtIso` (10-min-away note), `updatedAtIso` on every write. `startCorrectedFromIso` (iPad, set only when it was used): the original Start tap, kept when Finish came within a minute of Start and the iPad's "Did this tour start earlier?" set `startedAtIso` to an earlier time; the Desk's tour-times list marks that start "set at Finish" (D25).
- Tour times (D23): `timeExcluded` (true = a manager left this tour out of tour times), `timeExcludedBy` (the name they typed), `timeExcludedAtIso`; Count it again sets them to `false`, `''` and `null`. Written only by Leave out / Count it again in Reports, with merge and **without** changing `updatedAtIso`, so an old tour doesn't come back into the Desk's 30-day lists. Tour length itself is never stored; it is worked out from `startedAtIso` and `finishedAtIso`.
- Queries: Desk last 30 days, limit 800; iPad last 10 days, limit 400; Reports (with tour times) from the Monday 8 weeks before this week's, limit 2000, read when Reports opens (all ordered by `updatedAtIso`).

The Application Confirmation and Lease Approval forms, including a lease assignment's end date (D31), are not saved anywhere: they live in the open page until it's reloaded.

## Browser storage (per computer)
| Key | App | Meaning |
|---|---|---|
| `ld_showsheet`, `ld_ssMeta` | Desk | Last loaded units + metadata. |
| `ld_floorPlans`, `ld_fpMeta` | Desk | Floor plan map + metadata. |
| `ld_ssLocalIso` / `ld_ssAdoptedIso` | Desk | Last local change / last adopted publish — newest-wins logic. |
| `ld_agent` | Desk | Last leasing manager picked (Alex/Morgan): the name every Check-In "sent by" box shows unless that row's name was changed by hand (D50), and the name offered when leaving a tour out of tour times. A row's hand-picked name is kept in memory only (`checkinPick`), until that row is marked or the page reloads. |
| `ld_publisherName` | Desk | Name for manual publishes. |
| `ld_queueOpen` | Desk | `'0'` when the Tour Queue panel was hidden, so it stays hidden on reload (default: shown). |
| `ld_templates` | Desk | Email templates edited in this browser (merged over the defaults). |
| `ld_emailMode`, `ld_welcomeBuilding`, `ld_pfaSubMode` | Desk | Last email template, welcome building and PFA step picked. |
| `ld_tourSeen` | Desk | The guided tour has been shown (it opens on first visit only). |
| `ld_snowOff` | Desk | `'1'` when someone paused the snow with the ❄ by the title (Dec–Mar, D49); `'0'` or missing = snowing. |
| `ld_batDay` | Desk | Halloween 2026 only (D46): the day the bat last flew on this computer, so it flies once a day. Unused after Oct 31; harmless if it lingers. |
| `showsheet_cache` | iPad | Last showsheet received, for offline start. |
| `tour_current` | iPad | The open tour so a refresh doesn't lose typing; `_savedAt` guards live sync. A `prospectEmail` left in it is deleted when it loads (D40). |

Reports and its print checklist keep nothing in browser storage (D35); the contest flag, the Occupied / Renovation labels and `backupApps` travel inside `ld_showsheet` and `showsheet_cache` with the units.
