# OFD closure read acceleration — 2026-11-02

Released version: **1.21.3**.
Runtime/server commit: `879da68d6117df5259e2f92e5106fa87c367e34c`.
Code commit: `62f890d13e9b90d5992631de837af90aa9d47ca3`.
Public build timestamp: `2026-11-02T06:30:19.451Z` (09:30 MSK).
Authenticated ADMIN independently displayed version 1.21.3 and that build date.

## Approved scope and preserved behavior

The owner approved releasing OFD read acceleration while keeping the existing
employee handover workflow. The local candidate with a mandatory waiting window
was withdrawn before this release. EmployeeTodayClient.tsx, reminder/notification
policy, schema and existing photo/not-printed confirmation actions are unchanged
relative to the immediately preceding 1.21.2 baseline.

The server starts a source-only OFD prefetch before existing handover receipt
refreshes. Verification reads OFD immediately for an established workplace,
parallel to 1C receipts and shifts. A closed 1C document is not required to accept
the correct fiscal closure. Actual receipt identity still takes priority; a home
workplace prefetch cannot confirm a different KKT. FN, latest fiscal receipt,
reopening and stale-cache guards remain unchanged.

Evidence now records request/response timestamps, duration, completeness, cache
origin, returned fiscal shift numbers and optional proxy fetchedAt. These facts
distinguish portal waiting from missing/incomplete source data. Historical logs
cannot establish when the specific November 1 report first became available at
the provider; this release does not claim to fix provider publication latency.
The proxy, its timeout and the existing background runner interval were not changed.

Changed runtime/test files:

- `app/api/employee/shift-control/tasks/[id]/route.ts`
- `lib/kkm-shift-close-control.ts`
- `lib/terminal-fiscal-sources.ts`
- `tests/kkm-close-confirmation.integration.test.ts`
- `tests/kkm-empty-workplace.test.ts`
- `package.json`, `package-lock.json` — aligned release version only.

## Verification

- Latest deployment branch was fetched before the version bump and immediately
  before push. The preceding independently released/registered tax version 1.21.2
  was preserved. No parallel deployment was interrupted.
- `test:workday`: 258 passed.
- `test:terminal-fiscal`: 280 passed across both commands; 1 environment-gated skip.
- Dedicated PostgreSQL integration suite: 5 passed, including later OFD proof
  with an open 1C document and preservation of cash/photo/history/end time.
- Workday extension checks: 5 passed; release metadata checks: 5 passed.
- `npx tsc --noEmit`, `npm run build`, `git diff --check`: passed.
- Server HEAD independently matched the runtime commit. Container was healthy;
  public health and release metadata returned 200. Unauthenticated employee,
  workday, payroll and taxes route smoke checks returned 200 shells; they do not
  prove authenticated behavior. Authenticated workday ADMIN was separately loaded
  and inspected, including all eight employee rows and the release label.
- Read-only before/after hashes of **23 completed handovers**, October 26 through
  November 1, matched exactly after excluding only kkmCloseCheck evidence. Stored
  financial values, photos, history, completion status and original end time did
  not change.
- A read-only November 2 snapshot found 15 retail workdays in the checked window,
  14 completed, and 13 historical KKM issues, all resolved with confirmed source
  status. No open KKM issue appeared in this snapshot. This is persisted-state
  verification, not a fresh independent OFD probe for every historical report.

No production DB writes, migrations, financial corrections, 1C publication or
employee closing actions were performed. The next real employee phone closure
and the next provider delay have not been observed after release.

## Deployment and rollback

Only portal-app was rebuilt/restarted with server.env via the approved compose
file. The common deployment/maintenance flock serialized the operation. Existing
approved retention was applied because free disk was below 15 GiB: only eligible
older unused rollback images and unused build cache were removed; protected
images, volumes and uploads were preserved. Free space rose to 22.8 GiB before
the build and was approximately 18 GiB after deployment. No broad system prune
was used.

After independent public/server/authenticated-UI verification, the release image
was registered. All three verified image IDs were inspected successfully:

- Current 1.21.3: `sha256:518d132292ed950879f49b3bd03554b31c249afbe8ffad0a568aadd70b4eba9f`
- Previous 1.21.2: `sha256:5e7b0869590711076a0c8e73cdc0edbae81ee9db140762c91c98acefd666c00e`
- Previous 1.21.1: `sha256:8591a688c92ef41572539d7a8c5ac43ad8fa5cf341c9d2eaaf94f4a1d1f696e1`

The immediately preceding image also has tag portal-app:rollback-before-1.21.3.
Root release job completed with RELEASE_EXIT=0. Uploads remain mounted at
/app/uploads in offonika-portal_portal-uploads. Untracked local .cache/output and
the VPS .rollback directory were left outside commits.

Local evidence: output/kkm-release-20261102/production-release.log,
release-info.json, admin-version-1.21.3.jpg. Documentation is committed separately
from runtime changes; a docs-only commit does not require another application
version or rebuild.
