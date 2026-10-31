# Cash safety and mobile navigation release — 2026-10-31

Owner explicitly approved releasing the reviewed cash and mobile-navigation changes,
with physical-phone acceptance after release. Scope excludes historical financial
correction, schema/migrations, 1C extension changes and unrelated UI redesign.

Runtime: **1.19.13 / 198996af21a69a9773b12c9ae891e75b827a4fdf**.
Previous: 1.19.12 / 9806c22cd5c4ddbd270cad42964e8a6903700a53.
Merged deployment branch 206e8ee; Diana's current payroll release is preserved.
Public builtAt: 2026-10-31T13:50:15.657Z (16:50 Moscow).

## Included behavior

- Serialize same-employee submissions before photo persistence and 1C writes;
  same-key replay returns the original. Separate same-amount drafts for the same
  shift/direction require explicit confirmation of another physical transfer.
- Read and strictly validate durable receipts before retransmitting a photo;
  preserve the draft on network/auth/invalid-response failures. Shared upload
  exclusion and bounded visible-app retries retain original keys and photos.
- Close the form only after verified portal persistence. Continue the existing
  server POST; workday shows pending 1C separately from confirmed posting.
  Late completion cannot clear another task's saving flag or newly opened draft.
- Keep attendance-only finish controls out of shift-controlled manager workdays.
- Shared employee/ADMIN dock recovery after keyboard/modal/background transitions;
  prevent-scroll return focus. Preserve normal scroll, styling and safe-area gaps.

## Verification

- Workday 243/243; mobile/UI/navigation 61/61; surrounding handlers and current
  payroll readers 66/66; standard payroll 78/78; metadata 5/5; real isolated
  PostgreSQL concurrency test 1/1. Total 454 passing tests, none skipped.
- TypeScript, local production build, VPS production build, diff check passed.
- Independent public health and metadata passed. Authenticated ADMIN rendered
  1.19.13 and the expected build time. At 390x844, after scrolling to scrollY1671
  and opening/closing More, dock bottom remained844 and visibility visible.
- API receipt read without authentication returns401. No production financial
  transfer was created for testing, and no original duplicate documents were
  cancelled or rewritten. Existing cash/shift interaction acceptance was run
  against an isolated demo database and fake 1C endpoint.
- Real iPhone/software keyboard/installed PWA remains unverified, explicitly
  accepted by owner as post-release work. Forced server death during posting
  and delivery while the phone/server is off are not guaranteed by this change.

The deployment built and started successfully and public metadata switched.
The post-start verification tail of the first temporary shell script had a
heredoc delimiter typo and exited1 after APP_HEALTH_OK. This did not roll back or
restart the new app. The initial verification SSH session then closed while
waiting for sudo (exit255); its log was preserved. Owner explicitly requested
finishing now, and the reviewed verification-only script was reopened in native
Terminal. After owner sudo, it finished with **VERIFY_EXIT=0**.

Final verification: all runtime environment values, server.env fingerprint and
all mounted storage identities/paths/modes match the pre-release baseline.
Container health is healthy. Public version/build time and server commit match
the release above. No additional build/restart or production financial write was
performed during this final step. Current plus two preceding verified images
all exist and are registered:

- Current1.19.13: `sha256:e442b44f5c332885a69a0a7e1c51f9cc6aa3942525f4283b7593b6feabc7bfdd`.
- Previous1.19.12: `sha256:d961b9001fccd128c4135fb6255a70be6fd829061572a03c062cff8229283815`.
- Second reserve1.19.11: `sha256:c4aaaa7fa4ac7780ef1b8b78723f9bf10d661caba120b4de2b2cc0586dfe4498`.

Free space after verification:21.09GiB. Final log:
`/tmp/mobo-cash-nav-verify-1.19.13.log`. Physical iPhone acceptance remains pending
as explicitly agreed; no claim that its specific keyboard bug is proven fixed.

## Exact changed files relative to prior production

- `app/(dashboard)/admin/employees/EmployeeAccessDialog.tsx`
- `app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx`
- `app/(dashboard)/employee/CashIssueClient.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/api/employee/cash-operations/route.ts`
- `app/globals.css`
- `components/AdminShell.tsx`
- `components/EmployeeNavigation.tsx`
- `components/FiscalNotificationDialog.tsx`
- `components/NotificationRecordDialog.tsx`
- `components/useMobileNavigationViewport.ts`
- `components/workday/EmployeeNotificationInbox.tsx`
- `docs/codex-memory/cash-duplicate-delay-candidate-20261030.md`
- `docs/codex-memory/diana-pwa-known-earnings-20261031.md`
- `docs/codex-memory/mobile-navigation-viewport-candidate-20261031.md`
- `lib/cash-operation-duplicate.ts`
- `lib/cash-operation-submission.ts`
- `lib/employee-audit-timeline.ts`
- `lib/employee-cash-outbox.ts`
- `lib/employee-cash-receipt.ts`
- `lib/employee-operation-policy.ts`
- `lib/employee-process-view.ts`
- `lib/mobile-navigation-viewport.ts`
- `package-lock.json`
- `package.json`
- `tests/cash-operation-duplicate.test.ts`
- `tests/cash-operation-replay.test.cjs`
- `tests/cash-operation-submission.integration.test.ts`
- `tests/cash-outbox-lifecycle.test.cjs`
- `tests/employee-cash-receipt.test.ts`
- `tests/employee-encashment-ui.test.mjs`
- `tests/employee-handover-photo-flow.test.cjs`
- `tests/employee-process-view.test.ts`
- `tests/employee-pwa-design-baseline.test.mjs`
- `tests/employee-sheet-regressions.test.mjs`
- `tests/mobile-navigation-viewport.test.ts`
- `tests/pwa-copper-presentation.test.mjs`
- `tests/pwa-upload-presentation.test.mjs`

Unrelated dirty files in the owner's main checkout were not staged or changed.
The server's existing untracked .rollback/ directory was preserved.
