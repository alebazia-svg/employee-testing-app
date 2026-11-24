# Calendar and Day Control — released 24 November 2026

Production **1.25.22 / fc075d0f6d56a7615c7d0902a84a6f77b2f06373**,
from exact live **1.25.21 / 116de58a9e2bca62e598890c85718e8e3f868a16**.
Image: `sha256:d38fbfcf44df2578e77d6c70a4704b4226ca10e35ff0b0f488ab9faa257b009e`.
Clean build: `2026-11-24T19:04:59.128Z` (22:04 Moscow).
Guarded session: `8c875085585d4144b13e60cda2fb0b9e`, reached COMPLETE and
independently rechecked after expected-image registration.

## Released scope and boundaries

A saved day off without attendance retains its plan source instead of becoming
an automatic absence. The main calendar omits redundant source captions when
plan and attendance agree; day details and source-comparison views retain full
provenance. A QR-created working plan remains labelled По QR until a later
explicit plan edit, rather than appearing independently completed.

A committed application workday has priority. Valid Google arrival or departure
is optional positive reserve evidence when no app workday exists. A missing,
unconfigured or unavailable Google reserve never blocks ordinary automatic off
after the existing department closing boundary. Available later evidence can
replace automatic off on a subsequent source read. Departure-only data never
invents an arrival time. Control preserves real Google arrival/completion states
and filters; Home uses the same accounting. Original plans and manual correction
history are retained. Scan intents are still not committed shifts.

No employee UI or ADMIN employee-preview screen is affected: changed readers
are used only in ADMIN Calendar, Day Control and Home. Employee start/finish,
QR/shift choices, checklist/handovers, financial writers, cash, payroll, OFD,
notification policies, schema/migrations, Compose/startup and environment are
identical to the exact live base. The existing Google per-field end fallback,
24 October attendance cutover and department closing times are unchanged.

The maintained deployment branch contains unrelated pending modules and a
migration/Compose difference. It is not the runtime artifact. Those changes were
preserved there, excluded from this release, and must not be silently installed
in a future compatible release. The narrow runtime is reachable through the
maintained integration `d017b16`; do not replace its source with that merge tip.
Original dirty worktrees were left untouched.

## Verification

177 regression checks, one real server-component render test and two isolated
PostgreSQL integration checks passed (180 total); TypeScript and production
build passed. The exact linux/amd64 image was run against synthetic isolated
PostgreSQL data. Calendar, Control, matching captions, original saved-off plan,
Google reserve, real arrival/completion cards and filters were inspected. Home
showed 2 working / 4 completed / 1 off for the synthetic scenarios. Business
snapshots across nine tables remained byte-equivalent after JSON normalization.
Compiled capability guard retained 190 routes and 275 public assets, with the
approved receipt loader flag 1. No production database test writes occurred.

Authenticated production review compared all eight real 22 November rows:
start times, completion times, plans, open questions and historical fiscal 4/4
summary remained the same; only approved source captions changed for planned
off days. Astemir's existing manual working confirmation remained. Off filter
returned Liana, Magomed and Timur. The employee day card and graph editor opened
and closed without saving. Calendar day details retained original plans. Home
loaded 1 working / 5 completed / 2 off for the current date; existing actions
remained. Footer showed 1.25.22, matching public metadata and server commit.

No physical iPhone/PWA test, new production QR start or production financial
operation was performed. No background job implementation or schedule changed.
The previous unrelated procurement shift-modal limitation was not expanded or
changed by this release. Employee preview parity requires no new role comparison
because no employee/preview reader, choice, action or data contract changed.

## Delivery and retention

Ordinary capacity precheck and repeated locked checks passed; no pre-transfer
maintenance was needed. One native-Terminal sudo session installed the exact
archive. Independent UI/business checks preceded ordinary session-confirm and
expected-image registration. COMPLETE, public health/metadata and three healthy
pinned images were independently read back. Current 1.25.22 plus verified
1.25.21 / 1.25.20 reserves remain. Guarded retention rotated only obsolete 1.25.19
references; volumes, uploads, backups and all test environments were untouched.

Exact original archive retained under
`/Users/bela/Library/Application Support/Offonika/portal-release-archives/d38fbfcf44df2578e77d6c70a4704b4226ca10e35ff0b0f488ab9faa257b009e/`.
Durable local checks, session identity and screenshots:
`/Users/bela/Library/Application Support/Offonika/calendar-control-release-20261124/`.
Production immutable session audit remains on VPS. The initial capacity plan
required 19,932,508,879 bytes; the 15 GiB reserve was never reduced.

## Exact application/test/version files

- `app/(dashboard)/admin/workday/page.tsx`
- `components/admin/TeamSchedule.tsx`
- `components/admin/TeamScheduleServer.tsx`
- `lib/admin-home-data.ts`
- `lib/team-calendar-evidence.ts`
- `lib/team-calendar-fact.ts`
- `lib/team-control-calendar.ts`
- `lib/team-control-order.ts`
- `package-lock.json`
- `package.json`
- `tests/admin-home-calendar.test.ts`
- `tests/team-calendar-correction.integration.test.ts`
- `tests/team-calendar-fact.test.ts`
- `tests/team-calendar-google-reserve.test.ts`
- `tests/team-calendar-render.test.ts`
- `tests/team-calendar-start-boundary.test.ts`
- `tests/team-control-calendar.test.ts`
