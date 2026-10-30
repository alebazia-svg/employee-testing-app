# ADMIN saved-app schedule correction — verified release 1.18.27

Owner approved the local correction and explicitly approved production release.
The old per-name pilot selector ignored saved app plans for everyone except
Liana. On the authenticated production screen, Zalina's editor held `off` while
the employee overview incorrectly showed an empty schedule.

The selected employee/date's saved `working` or `off` record now wins in the
overview, employee detail and team calendar. Google remains the fallback for
empty dates outside the original app-only Liana pilot. An actual start does not
fabricate a plan. Vacation still wins. No schedule records, source configuration,
notifications, cash rules, schema or migrations were changed.

## Source and checks

- Runtime fix: `346926d`.
- Release source: `dcee4abb9682a17053b1d7cd5b380eb635d92402`.
- Previous production source: `331c2630122a0e99ebc0663af44f341aa6733ece` / 1.18.26.
- Package and both lockfile root versions: 1.18.27.
- 227 workday tests, 57 schedule/source/attendance/ADMIN regression tests and
  5 release metadata tests passed; TypeScript, production build and diff checks
  passed.
- Isolated PostgreSQL on localhost:55481: real PWA edit from off to working,
  persisted employee audit, ADMIN calendar, overview and detail verified. No
  production plan was edited. Google outage/conflict and vacation covered by
  regression cases; no physical-phone or live Google mutation test.
- Product/test files: `lib/team-control.ts`,
  `app/(dashboard)/admin/workday/page.tsx`,
  `components/admin/TeamScheduleServer.tsx`, `components/admin/TeamSchedule.tsx`,
  `tests/team-schedule-source.test.ts`; release adds package.json/package-lock.json.

## Production proof

- Target: https://team.mobo-opt.ru, portal-app only.
- Public build: `2026-10-29T06:21:40.424Z` (09:21 Moscow).
- Exact server source and public metadata independently verified. Authenticated
  ADMIN footer showed 1.18.27; Zalina and Zukhra showed their saved days off.
- Healthy replacement image:
  `sha256:5c2145cb117221f0a377ad591e066047ac607ae7e4bbde394f49259053dfe714`.
- Previous 1.18.26 image:
  `sha256:d1b6036dea129e422f56fbfbed0a4e93cde4521379efdd66f861b2f3d0f65e6d`.
- Second retained verified image:
  `sha256:e7a4516a315df87770ab2e69ba3ff419946eb232b38f3da95651165bf8462af2`.
- Shared deployment flock used; initial free space 28 GB. No cleanup needed.
  Verified registry contains new current plus the two preceding verified images.
  Post-release free space 22 GB.
- The initial wrapper exited 1 after successful restart because it compared the
  order-sensitive Docker mount JSON hash. A separate verification matched the
  entire original mount list exactly under permutation, confirmed unchanged env,
  healthy container, source and build, then registered the independently verified
  release. Verification exit 0; no second deployment or env/mount changes.
- Evidence: `/home/bela/mobo-schedule-source-1.18.27.log` and
  `/home/bela/mobo-schedule-source-1.18.27-verification.log`. Do not rerun scripts.

On resumption on October 30, production had advanced to 1.19.11 / `26ed845`.
Ancestry and current source retain this fix. Public health and authenticated
October 30 ADMIN overview were checked again: saved working/off plans remain
visible. No downgrade or repeat deployment was performed.

Unrelated dirty files in the owner's main checkout were left untouched.
