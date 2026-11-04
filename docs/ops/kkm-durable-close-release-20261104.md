# OFD closure evidence — production release 1.21.23

Released 2026-11-04 under the owner's explicit approval to deploy the app and the
minute OFD job. Runtime commit: `c42dd3eb293469e0132469ceea4ce47909bebc1a`.
Public build time: `2026-11-04T18:41:40.556Z` (21:41 Moscow).
Current image: `sha256:242a2ad2dc9a810fa28f521d41752a79f6643deab468dc635a152dfb64347d53`.

## Approved behavior

The independent minute collector records exact KKT/FN/shift OFD closure evidence
on the existing persistent fiscal volume. It survives worker/container restarts,
long pauses and later empty report responses. At handover the direct OFD receipt
stream checks for subsequent fiscal events independently of delayed 1C checks.
A new receipt needs a covering second closure; known later empty reopenings and
ambiguous evidence retain fallback. 1C document closure is not a prerequisite.

Existing employee screens/copy, immediate photo and not-printed completion,
financial fields, notifications, schedules, payroll, uploads and 1C publication
remain outside the change. A source/portal failure without reliable proof does
not remove the fallback or require the employee to wait for OFD recovery.

## Independent verification

- Server checkout matches the runtime commit above; public metadata and the
  authenticated ADMIN footer both show1.21.23. `/api/health` returned `ok:true`.
  Existing public metadata still reports `revision:null` / `source:unknown`;
  commit identity was verified independently on the server and image.
- New `offonika-kkm-close-refresh.timer` installed from the exact commit, enabled
  and active. Its dedicated service/lock does not replace employee push dispatch.
  Manual first run21:48:16MSK succeeded; subsequent scheduled21:51,21:52,21:53 runs
  succeeded, each with two physical KKT reads and two complete responses.
- Actual installed CLI `--inspect` confirms runner `kkm-close-background-v1`,
  current Moscow date and one retail working-day record.
- Current production verifier, with DB transaction forced READ ONLY, confirmed
  Magomed's fiscal shift353, closed19:52MSK, from persisted evidence; live report
  and direct-receipt guards complete; `photoRequired:false` (21:53:12MSK).
- 18 scenarios passed against the installed image in a network-isolated test
  container, including reopening/new OFD receipt before1C, durable observations,
  conflicts/corruption, independent source identity and photo/not-printed helpers.
- The final local build's authenticated real task PATCH completed without a photo
  from stored OFD proof, and completed with photo or not-printed during OFD failure.
  Cash input history preserved. Physical camera was not exercised; test photo
  metadata was seeded only in the disposable local DB.
- Existing workday263+10 checks, source/adapter10 checks, the further11-case empty
  workplace/OFD-only suite, typecheck/build and release metadata5 checks passed.
- Root-side before/after hashes matched182 existing protected records: saved
  payroll runs/results and completed handover status, day completion, cash,
  reserve, photos, original1C audit, cash input history, employee confirmation and
  comment fields. KKM verification metadata is allowed to update normally.
- The original workday-notification service/timer definitions compared identical
  before/after. Persistent uploads and fiscal-report volumes remain mounted.
- Release workflow exited0 and registered the independently verified image.

Local evidence: `output/kkm-release-12123/production-release.log`,
`production-postcheck.log`, `release-info.json`, `production-confirmed.jpg`.
Implementation scope and exact changed files:
`../codex-memory/kkm-durable-close-candidate-20261104.md`.

## Boundaries and rollback

No migration, manual production DB rewrite, 1C write, credential/env edit or
financial transaction was performed. Natural future device events and physical
phone camera/push behavior are not claimed to have been exercised.

If an exact prior runtime must be restored, disable only the new OFD collector
timer first, retain fiscal observations/uploads and follow the VPS runbook.
Existing employee-notification units must remain unchanged. Preserve current plus
both independently verified rollback images; never prune volumes/history.

Final storage verification: current plus both verified rollback images exist.
Routine owner-approved retention restored23.91GiB free (25,675,546,624 bytes).
Only eligible unused rollback images/build cache were handled by the existing
maintenance program; mounted volumes and financial/user history were preserved.
Rollback image IDs: `sha256:29f92435db1574c30fd5571e508d64acb4dd8a8637a98d597430295b3bf0f8cf`
and `sha256:e689310bc1aa31ffc537c9120720999ad2efe99a3ef42fea41575fffd75efb74`.
Final release and postcheck workflows both exited0; health remained `ok:true`.
