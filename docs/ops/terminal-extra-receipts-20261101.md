# Automatic extra-receipt checks — released 1.21.1

Historical preparation notes below are retained; production verification is recorded
in the final section.

Owner approved a system-generated possible-extra-receipt check, parallel to missing
receipt checks, with the SAME native mobile receipt sheet, structured facts and
«Это дубль», «Была вторая продажа», «Нужна помощь». Personal owner-message copy,
standalone question page and desktop notification dialog were rejected. Employee
sending stays disabled until the agreed preview/release step. No production writes.

## Verified real 900 case

Read-only 1C, Platforma OFD and aQsi agree: terminal check000478, SBP900 at14:22:29;
1C00OF-00375914:28:05 / FD3297 and00OF-00376014:32:21 / FD3298 contained the same
holder900. At19:55:15 Zukhra registered refund00OF-000079 with explicit
links.originalCheck.ref pointing to00OF-003760. OFD accepted refund FD3306 at19:55:25
(KKT clock19:47). Bank has no refund. Net electronic totals18400 in all three
sources. Remaining sale is00OF-003759. Portal's19:57 read still left the original
question open; source adapter previously discarded originalCheck.ref. Do not send
an obsolete request to Zukhra or claim production alerts already closed.

## Implementation

- terminal-extra-receipts: conservative possible duplicate detector: complete
  bank/1C/OFD/peer reads;30-minute quiet period; one nearby payment across equipment,
  two distinct equal-goods/OFD-backed same-cashier receipts; no mixed/ambiguous case.
- Exact referenced reversal netting requires both immutable fiscal identities,
  same KKT, amount and goods, and no real terminal refund. Never chooses a wrong
  receipt by proximity, drops an unlinked return, or infers identity from totals.
- Source adapter preserves documentNumber and originalCheckRef.
- Existing runner integrates via TERMINAL_FISCAL_EXTRA_RECEIPTS_ENABLED=true.
  Employee notifications additionally require TERMINAL_FISCAL_EXTRA_RECEIPTS_NOTIFY=true.
  Both default OFF. Existing behavior remains with flags absent.
- Same Workday issue/notification/attention pipeline; new warning rule only.
  Possible extra receipts do not block handover. Existing required issues unchanged.
- Mapped actual 1C cashier only; otherwise existing ADMIN financial review remains.
- Serializable/retried idempotent staging and responses; owner inbox response.
  Second sale asks its payment method in the same sheet. No response closes the
  financial check. Closure requires every original receipt matched or explicitly
  reversed, with at least one live uniquely matched sale. Incomplete reads never
  close it. Cancel pending reminders; preserve sent history and answers.
- ADMIN issue details show the actual receipt facts/response, not credit-sale labels.

Changed source: lib/terminal-extra-receipts.ts, terminal-extra-receipts-sync.ts,
terminal-extra-receipt-response.ts, terminal-extra-receipt-transaction.ts,
terminal-fiscal-sources.ts, terminal-fiscal-matching.ts (optional metadata only),
terminal-fiscal-runner.ts, employee-attention-snapshot.ts, workday-required-issues.ts,
workday-notifications.ts, admin-workday-issue-detail.ts;
app/api/employee/extra-receipts/[id]/response/route.ts;
app/(dashboard)/admin/workday/WorkdayIssueDialog.tsx.
Tests: tests/terminal-extra-receipts.test.ts, workday-required-issues.test.ts.

## Acceptance

88 focused tests pass; TypeScript passes; isolated Next production build passes.
Real saved before/after snapshots:1 possible extra before,0 after,1 exact referenced
reversal; remaining payment matches00OF-003759 as confirmed. Private inputs stay
in.wip only. PostgreSQL integration: shadow/no-send, parallel idempotency, wrong
employee rejection, answer preserved, no close on answer/incomplete OFD, exact
reversal closure; repeat closure idempotent; new warning excluded from handover.
Build used separate /tmp copy; original3241 preview and3242 development untouched.
Initial copied build missed types/bcryptjs.d.ts; complete-copy rebuild passed.

Real mobile preview screenshot:.wip/extra900-automatic-mobile.png (before correction
fixture). No physical push tested, no production notification or activation,
no 1C/OFD write, no fiscal correction by Codex, no migration.
Current production UI observed1.20.10, candidate based on1.20.9 worktree. Before
release merge the latest deployment baseline, follow version/runbook/approval gates,
recheck these modules for concurrent changes and allocate a new portal version.
No version reserved; no deploy authorized/performed by this local candidate.

## Production installation authorized

Bela explicitly authorized installation, automatic future extra-receipt checks and
closure of both existing900 alerts, with NO employee notification for the corrected
case. Final text now exactly reuses terminalPaymentCopy and the native missing-
receipt sheet: «В 1С два чека на одну оплату», ordinary terminal payment line,
then both1C check numbers/times. Earlier long/personal/desktop examples rejected.
Buttons retained. No existing controls removed. Extra warnings stay nonblocking.

Merged the complete verified1.21.0 payroll baseline, including its original salary
rules and owner verification. Release1.21.1 source c71ee6529b6e98efcfaaeadbc86120aaf5302219.
130 focused tests +5 release metadata tests pass, PostgreSQL lifecycle tests and
final isolated production build pass. Matching metadata/cache version mvp-1.11.
Verified reversal pairs are grouped as «Чек отменён возвратом» in daily transactions;
both original and refund documents and every movement remain visible.

Additional protection: save a resolved evidence record for an already corrected
case before enabling delivery; later stale readings cannot reopen/notify it.
Pending/unconfirmed returns also suppress an obsolete employee question. Only
complete exact fiscal evidence closes a case. No arbitrary total-only closure.

Reviewed installer /tmp/mobo-extra-receipts-release.command opens native macOS
Terminal for Bela-only sudo. Root task pins the1.21.0 server source, checks registered
images/disk/global deployment lock, preserves env/mounts/networks, first starts with
new employee delivery masked, previews then invokes normal application recheck,
independently verifies both legacy alerts resolved and zero new900 notifications,
then enables future checks/delivery and verifies again. No migration/server.env edit,
manual business-row patch, fiscal write, unrelated container or upload change.
It awaits independent public/server/authenticated-UI verification before registering
current plus two rollback images. Native launch succeeded; completion is not yet
claimed. Final production results will be recorded below.

## Production verification — 2026-11-02

Installed 1.21.1, runtime source c71ee6529b6e98efcfaaeadbc86120aaf5302219,
build 2026-11-01T17:40:59.507Z (1 November, 20:40 Moscow). Independent SSH source
and package checks, both public release-info hostnames, health, and a freshly
reloaded authenticated ADMIN payment card confirmed the release. Final sheet
preview: .wip/extra900-like-missing-preview.png; real production closed card:
.wip/extra900-production-verified.png. Earlier screenshots/text are superseded.

The normal application recheck, followed by a separate read-only Prisma process,
confirmed both legacy900 alerts resolved, the extra-case evidence resolved,
payment matched to00OF-003759, and ZERO employee notifications for this case.
The independent readback passed both before and after enabling future delivery.
Report totals balance; original and exact referenced refund remain in history.
Both EXTRA_RECEIPTS flags are true. Baseline comparison confirmed unchanged other
environment, server.env, mounts, networks and ports. No migration, manual financial
row patch, 1C/OFD write or message to Zukhra was performed.

The root resume reached DEPLOY_READY_FOR_INDEPENDENT_VERIFICATION. Before its final
marker, the separate tax release advanced the server checkout to55e1d48 /1.21.2.
The exact-source marker guard correctly refused to register against a changed
checkout. Its release resume explicitly registered the running verified1.21.1
image8591a688c92ef41572539d7a8c5ac43ad8fa5cf341c9d2eaaf94f4a1d1f696e1;
its subsequent preflight requires that image to be the registry current and that
all three reserves exist before proceeding to build. The tax release passed that
preflight and began its build. No marker for the newer release was supplied by
this task. Extra-receipt runtime files and compose are unchanged in55e1d48.

Operational verifier fixes only: temporary TS dynamic imports needed the CJS
module.default fallback; the initial runtime guard confused OCI index/config
identities and was replaced with exact runtime source hashes. Installed application
code was not rebuilt or changed by these fixes. Earlier failed script exits are
not evidence of an application outage; the public health stayed healthy.

Checks completed before release:130 focused tests,5 release metadata tests,
TypeScript, isolated production build and PostgreSQL lifecycle scenarios. Physical
phone push display was not tested, and no fake production incident was created.
Existing missing-receipt controls, handover rules and prior payroll/shift behavior
were preserved. New extra-receipt warnings are nonblocking and use the same native
mobile receipt sheet; closure follows verified fiscal evidence, not an answer alone.
