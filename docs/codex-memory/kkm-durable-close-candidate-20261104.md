# Durable OFD closure evidence — released 1.21.23, 2026-11-04

Owner approved: proactively collect exact KKT/FN/shift closures, retain evidence
across pauses/restarts/empty source responses, prefer OFD fiscal events over delayed
1C document closure, preserve immediate photo / not-printed completion during
source or portal failures. Reopened shifts with a new receipt require their own
closure. Existing cash, reserve, checklist, notification and payroll policies stay.

## Implementation

- `kkm-close-report-journal.ts`: append-only, content-addressed observations on the
  existing `portal-fiscal-reports` volume; identity is KKT + FN + fiscal shift;
  calendar-period/source-scope isolation, observation/event time checks, atomic
  publication, conflicting/corrupt evidence fails closed. Empty/incomplete reads
  never erase saved proof. No DB schema, migration or manual source edits.
- `kkm-close-report-cache.ts`: journal is independent of the 75-second cache.
  Fresh source checks continue; observations distinguish stored proof from current
  live-read completeness. Stored proof is not proof that no later shift exists.
- `kkm-shift-close-control.ts`: bounded direct OFD receipt read after the first
  known closure guards subsequent fiscal events independently of delayed 1C
  checks. A newer fiscal receipt invalidates the old closure; an exact later
  covering OFD closure confirms it. Known later empty reopenings still block.
  Ambiguous same-minute events, incomplete reads or conflicting identity retain
  the existing fallback. 1C closure timestamps never substitute for OFD proof.
- Dedicated `refresh-kkm-closures.ts` plus systemd service/timer run prefetch and
  existing open-issue reconciliation. Independent lock/job avoids blocking or
  replacing existing employee notification dispatch. Existing internal HTTP
  endpoint uses the same KKM cycle. `--inspect` reads runner/population only.
- Task PATCH, photo/not-printed validation and completion paths remain intact.
  No layout/copy, accounting, payroll, 1C publication or financial writes changed.

## Verification and limits

Local tests include two sequential OFD closures with a new OFD receipt absent
from 1C, persisted proof after ten minutes/new worker, empty/incomplete responses,
conflicting and corrupt proof, independent identities, unknown receipt stream,
same-minute ambiguity, bounded request attempts and actual installed entrypoint
wiring. Existing workday/source suites, typecheck and production build are required.

Dedicated disposable DB: `kkm_close_durable_20261104`, local Docker port 55479.
Authenticated real task PATCH: confirmed stored OFD closes without a photo;
OFD outage closes via photo and via not-printed; cash input history preserved.
Photo upload metadata seeded for the HTTP case; physical camera not tested.
Real local PWA: fallback shown, not-printed click completes shift; completed
OFD-confirmed employee shown without photo action. No production mutations.
Evidence scripts/logs/screens are in local `.wip/` and `output/kkm-durable-20261104/`.

## Release gate — completed for 1.21.23

Owner explicitly approved deployment with the minute collector. Released runtime
`c42dd3e` and production verification: `../ops/kkm-durable-close-release-20261104.md`.
The following gate remains mandatory for future releases of this mechanism.
Before release reread AGENTS and VPS runbook, compare newest live + deploy branch,
merge unrelated intervening releases and increment the application patch version.
Install and enable the exact new `offonika-kkm-close-refresh.service` and `.timer`
from this commit after the app is healthy. Verify `systemctl cat`, enabled/active
state, actual successful minute execution/output and runner `--inspect`, persistent
fiscal volume mount and metadata/server/image/UI identity. Preserve existing
workday-notifications unit/timer byte-for-byte. Do not deploy only app code and
leave the new collector disconnected again. Register image after verification.
Rollback disables only the new KKM timer before restoring the prior verified
runtime; keep persisted fiscal observations and all financial/user history.

Production API propagation cannot be guaranteed instantaneous. An empty source
response without previously observed matching proof remains unconfirmed; fallback
must remain available. No blanket claim of zero future source failures.

Final local readback: workday suite263+10 passed (one further empty-1C/OFD-only
case then passed in its11-test focused suite),10 source/adapter checks passed,
7 durable chain checks passed, `tsc --noEmit` and final production build passed.
Authenticated real PATCH was repeated against the final build and passed all
three completion paths. The actual dedicated CLI ran on the disposable DB:
checked one physical KKT and reconciled three existing demo issues successfully.
Live read-only source smoke,21:32MSK: today's Magomed KKT returned shift353,
closed19:52MSK; direct OFD receipt guard complete with zero later receipts,
combined source duration4129ms. No production mutations or service installation.
Physical camera and live installed timer execution remain release/device checks.

## Exact changed files

- `lib/kkm-close-report-journal.ts`
- `lib/kkm-close-report-cache.ts`
- `lib/kkm-shift-close-control.ts`
- `lib/terminal-fiscal-sources.ts`
- `lib/kkm-close-background-cycle.ts`
- `scripts/refresh-kkm-closures.ts`
- `ops/systemd/offonika-kkm-close-refresh.service`
- `ops/systemd/offonika-kkm-close-refresh.timer`
- `app/api/internal/workday-notifications/run/route.ts`
- `tests/kkm-close-durable-chain.test.ts`
- `tests/kkm-empty-workplace.test.ts`
- `package.json` and `package-lock.json` (standard test command and release1.21.23)
- `docs/codex-memory/project-index.md`
- `docs/codex-memory/kkm-durable-close-candidate-20261104.md`
- `docs/ops/kkm-durable-close-release-20261104.md`

Unrelated pre-existing `.cache/` and `output/` content was preserved. New local
verification artifacts are separated under `output/kkm-durable-20261104/`.
