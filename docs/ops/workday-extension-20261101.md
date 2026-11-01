# Retail extension and solo cashier — local acceptance 2026-11-01

Scope approved by Bela: proposal to extend a remaining 09–18 Retail employee
until 20:00 after an early departure, one ADMIN click; confirm a known mapped
1C cashier even when only one employee is currently working. No production
publication or real employee schedule change has been performed.

Baseline: ace10bd (latest deployment branch when work began). Isolated checkout:
portal-workday-extension-20261101, branch codex/workday-extension-confirm.

Changed files:
- app/(dashboard)/admin/workday/page.tsx
- app/(dashboard)/admin/workday/WorkdayExtensionProposal.tsx
- app/api/admin/workday/extension/route.ts
- lib/workday-extension.ts
- lib/terminal-fiscal-admin-gate.ts
- lib/terminal-fiscal-manager-loader.ts
- tests/workday-extension.test.ts
- tests/workday-extension.integration.test.ts
- tests/terminal-fiscal-admin-gate.test.ts
- tests/terminal-fiscal-manager.test.ts
- docs/codex-memory/workday-playbook.md
- docs/codex-memory/decision-log.md
- docs/ops/workday-extension-20261101.md

Validation:
- 34 focused extension / fiscal manager / existing review-routing tests passed.
- 3 isolated PostgreSQL integration scenarios passed: concurrent/repeated
  approval; replacement + started handover reject; employee/past-day reject.
- 256 existing Workday tests passed.
- TypeScript and final production build passed; git diff --check passed.
- Actual authenticated mobile Workday page, synthetic Zukhra/Milana:
  one click changed 09–18 to 09–20. Independent Prisma read: start 08:57,
  original shift audit 09–18, one change, one ADMIN actor event, one notice,
  opening amount 10000 unchanged, handover deadline 1200, actual end null.
- Own synthetic fixture reset to pre-approval after saving independent readback
  so Bela may try the button. No real users, 1C/OFD, Google or push credentials.
- Live demo http://localhost:3241/admin/workday (localhost-only production build).
  DB workday_extension_test on localhost:55483, dedicated container.

Behavioral differences: adds one proposal card before existing Workday content;
requires explicit ADMIN approval, rereads department inside serializable
transaction, preserves original shift and attendance/lateness snapshots,
completed tasks and cash. Pending closing/handover deadlines move two hours.
A later replacement never silently shortens an already approved extension.
Missing/unmapped/conflicting fiscal identities retain existing safeguards;
solo display opt-in does not alter employee review routing.

No migration, deploy, release version allocation, real schedule write, 1C write
or real employee notification. Actual device push delivery not tested. Other
checkouts and unrelated changes untouched. Release must recheck current live
version and latest branch, then assign a new version under owner authorization.

## Today's pilot release authorization

Bela authorized the simple current-day flow on 1 November: ADMIN notification
and one confirmation; employee extension notice and handover at 20:00; existing
early-finish button preserved. Future uncompleted cash midpoint retimes 13:30 →
14:30; already due/completed recount remains. Existing minute dispatcher creates
one ADMIN proposal, inbox checks current eligibility independently, and final
pending-task delivery rechecks the saved deadline. No new service or migration.

Additional changed files: lib/admin-inbox-attention-policy.ts,
lib/admin-inbox-data.ts, lib/admin-operations-view.ts,
lib/workday-notifications.ts, package.json, package-lock.json.
Checks: 45 focused tests, 4 PostgreSQL scenarios, 256 Workday tests,
5 release metadata tests, TypeScript and release build passed.
Latest deployment branch 8c4bee8 / 1.20.8 merged without conflicts;
release candidate 1.20.9. Production schedule approval remains Bela's own click.
