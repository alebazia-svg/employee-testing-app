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

Release source pushed: 224968091b502dbc33a50e3d0c522f07f71fbe15.
Reviewed installer: /tmp/mobo-workday-release-1209.command and server
/tmp/mobo-workday-release-1209-root.sh. Native Terminal opened successfully.
Server command sudo -v is awaiting Bela's password; service
mobo-workday-release-1209 is not started and no release log exists yet.
Never handle the password or claim installation completed. Monitor via SSH
read-only /home/bela/workday-release-1209.log, continue automatically after
authentication. Root installer guards prior verified image, disk and source,
serializes the release, preserves env/mounts and awaits independent verification
flag before image registration. No real shift approval has been clicked.

## Production acceptance

Released 1.20.9, source 224968091b502dbc33a50e3d0c522f07f71fbe15,
build 2026-11-01T15:50:11.987Z (18:50 Moscow). Native Terminal sudo completed,
server task exited 0. Independent server HEAD/package and both public hostnames
confirmed 1.20.9; health ok. Env checksum and canonical mount comparison passed.
Actual ADMIN Workday shows Zukhra proposal “Подтвердить до 20:00”, original
09–18 and start 08:57 retained. Actual inbox contains one proposal at 18:56.
No production confirmation click by Codex.

Fresh acquiring report at 18:58: 2000 / FD3296 is matched and manager attribution
is “Подтверждено 1С · совпадает со сменой”; later known-cashier operations after
11:00 also confirm. Missing-cashier/ambiguous 900 at 14:22 remains unresolved,
with old safeguards preserved. Actual phone push receipt is not verified.

Running verified image: sha256:a246f2a5700827a16cc0d9333e737f48871b24bf8081d88e52cd0e5f8a2f6de2.
Registry also retains cee5a79c1086b1c4c87826c58546d87ac9b26b909fde49c6bae75f5a8c39678d
and a7972b5150790124b63f054b69da5a643c89eda936ad7625a7d0dea72ef1ea2e.
Preflight verified all three previous images and 17 GiB free; after release
14 GiB free, so the next build must satisfy the 15 GiB preflight gate again
using the existing approved storage maintenance policy. No arbitrary cleanup.
No migration, direct production DB edit, 1C/OFD write, unrelated session closure.
Evidence screenshot: .wip/production-proposal-1.20.9.png.

### Real pilot confirmation observed

After the owner's own confirmation, actual Zukhra day shows 09:00–20:00,
start 08:57, active. History records 18:57, 09:00–18:00 → 09:00–20:00.
Opening task 566 and completed midpoint 567 retain their amounts, facts and
original deadlines (09:00 and 13:30). Pending handover 568 is due 20:00.
Terminal attribution is confirmed 10/10. Codex did not click the production
approval. Screenshot: .wip/production-confirmed-1.20.9.png.

Read-only investigation of the separate 900 payment at 14:22:29 found two
same-amount receipts, FD3297 and FD3298. The bank payment is not reliably linked
to a 1C document; cashier therefore remains unresolved. This does not prove
missing fiscalization or a duplicate receipt. No linkage or fiscal write made.
