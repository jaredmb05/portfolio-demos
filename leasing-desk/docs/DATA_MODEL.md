# Data model

One Firebase project (Firestore); its web config comes from `.env` (see `.env.example`). Rules: `firebase/firestore.rules`. Timestamps are ISO strings (`…Iso`); dates are `YYYY-MM-DD`.

## Collections
| Path | Written by | Contents |
|---|---|---|
| `showsheet/current` | Desk (Publish or Dropbox sync) | `units[]` (Desk unit objects), `floorPlans[]` (`{key, url}`, key = `bldg\|unit`), `publishedAtIso`, `publishedBy`, `unitCount`, `filename`. Every Desk + iPad follows it live; newest wins. |
| `showsheet_history/{id}` | Desk | Create-only snapshots of past publishes. |
| `tours/{id}` | Desk + iPad | See below. Always `set(…, {merge:true})`. |
| `settings/assistants` | Desk (PIN) | `names[]`. |
| `settings/schedule` | Desk (PIN) | `byName{name: [weekday 0–6]}`. |
| `settings/availability` | Desk + iPad | `byDate{YYYY-MM-DD: [names marked out]}`, `inByDate{YYYY-MM-DD: [names marked back in]}` — overrides on top of the weekly schedule; reset each day. |
| `settings/appointments` | Desk | `byDate{YYYY-MM-DD: {'14.5': {tours, insp, asked}}}` — Outlook appointments per half hour. |
| `settings/dropboxSync` | Desk | `showsheetUrl`, `floorplanUrl`, `ssHash`, `fpHash`, `lastCheckIso`, `lastSyncIso`. |
| `future_leads/{id}` | Desk | `id` (`tour-<tourId>` or `m-<time>`), `source` (`tour`/`manual`), `name`, `assistant`, `tourDate`, `moveIn`, `followUpDate`, `criteria`, `units`, `status` (`open`/`contacted`/`leased`/`lost`/`deleted`; a deleted tour lead is kept so it isn't captured again), `statusBy`, `statusAtIso`. No contact info. |
| `quiz_results/{id}` | iPad | Create-only: `name`, `score`, answers. |
| everything else | — | Requires sign-in (other apps' data in the same project). |

## `tours/{id}`
- Identity: `id`, `kind` (`tour`/`inspection`), `prospect` ("Karen M."), `prospectFirst`, `prospectInitial`, `prospectEmail` (optional), `assistant`, `broker`, `brokerFirst`, `brokerLast`.
- Content: `stops[]` (`{key, building, unit, type, monthly, rent, concession, op, credit, notes, view, custom…}`), `profile{beds[], priceMin, priceMax, moveIn, flexible, mustHaves}`.
- Lifecycle: `createdAtIso` → `queuedAtIso` (waiting) → `startedAtIso` → `finishedAtIso` → `followUpSentAtIso` / `followUpSentBy` → `checkInSentAtIso` / `checkInSentBy`. Also `headsUpSentAtIso` (10-min-away note), `updatedAtIso` on every write.
- Queries: Desk last 30 days, limit 800; iPad last 10 days, limit 400 (ordered by `updatedAtIso`).

## Browser storage (per computer)
| Key | App | Meaning |
|---|---|---|
| `ld_showsheet`, `ld_ssMeta` | Desk | Last loaded units + metadata. |
| `ld_floorPlans`, `ld_fpMeta` | Desk | Floor plan map + metadata. |
| `ld_ssLocalIso` / `ld_ssAdoptedIso` | Desk | Last local change / last adopted publish — newest-wins logic. |
| `ld_agent` | Desk | Last leasing manager picked (Alex/Morgan). |
| `ld_publisherName` | Desk | Name for manual publishes. |
| `ld_queueOpen` | Desk | `'0'` when the Tour Queue panel was hidden, so it stays hidden on reload (default: shown). |
| `ld_templates` | Desk | Email templates edited in this browser (merged over the defaults). |
| `ld_emailMode`, `ld_welcomeBuilding`, `ld_pfaSubMode` | Desk | Last email template, welcome building and PFA step picked. |
| `ld_tourSeen` | Desk | The guided tour has been shown (it opens on first visit only). |
| `showsheet_cache` | iPad | Last showsheet received, for offline start. |
| `tour_current` | iPad | The open tour so a refresh doesn't lose typing; `_savedAt` guards live sync. |
