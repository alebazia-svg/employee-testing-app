# KKM / handover cash audit — 2026-10-25

## Scope / status
Owner approved correcting KKM verification to consult OFD before employee action.
Owner subsequently approved extending handover expense responsibility and preview.
Implemented locally; not released. Production investigation remains read-only.
Dedicated branch codex/kkm-ofd-cash-audit-20261025 from 6ec4005;
prior uncommitted credit/inbox worktree untouched. No production writes or release.

## Verified live incident
- Magomed issue 96953, created 18:02:48 MSK: 1C reported open.
- OFD KKT 0010475338013250, shift75, closed17:52.
- Issue currently closed, last check18:04; persisted old source evidence still says open.
- Existing verifier returned on 1C-open before checking OFD.
- Local fix reads OFD even when 1C says open, requires exact KKT/fiscal shift,
  valid same-day closure not before last employee check. Incomplete OFD is
  technical uncertainty, not an employee error. Confirmed resolution persists
  its evidence rather than leaving the former open-state payload.
- No reliable fiscal shift identity: existing behavior retained; never pick an
  arbitrary same-day Z report. Missing 1C shift is not repaired in this patch.

## Confirmed cash explanation
Magomed task499/run114, counted2390 at18:01, completed18:04;
saved 1C18390 => -16000.
Request00OF-001141 created18:09:01,103000, no header cashbox,
comment50000 Liana/16000 Magomed/37000 reserve.
Read-only native request state confirms complete/direct RKO links:
-00OF-001956,18:28:29,50000,Касса Хурзокова;
-00OF-001957,18:28:39,37000,Резерв Под Телефоны;
-00OF-001958,18:28:45,16000,Касса Костеренко,
posted=true,deletion=false,allocation16000,request_amount_conflict=false.
Request execution103000/remaining0. Owner confirms she distributed and posted
orders after shift finish. Thus the16000 difference has documented explanation;
this is not proof of personal shortage. Preserve original count/time/snapshot.

## Gaps / proposed next scope
1. Pending expense evidence is attached to initial/midday cash recounts only;
   handover uses independent personalCash snapshots and auto-checks.
2. Existing reconciliation only revisits issues already containing
   expenseEvidence; cannot discover a later-created multi-cashbox request/RKO
   explaining an earlier handover count.
3. Main team row gates app auto-check alerts on usesAppSchedule(name), still
   true only for Liana. Magomed has actual app shift/handover but displays
   no remarks despite handover mismatch. Do not treat plan source as evidence
   that an actual app shift's checks should be suppressed.
4. Recommend handover status 'Разница16000 — ожидает оформления', then
   'Подтверждено расходником' after exact cashbox/allocated amount/direct link
   proof. Never parse comment text as proof, never replace original2390/18390.
5. A request created after count cannot be known at original count time;
   retrospective reconciliation needs explicit late-document evidence and
   must not silently reinterpret current balances as historical balances.

## Verification
Local KKM tests7/7, npx tsc --noEmit, npm run build, git diff --check pass.
Production UI/API/OFD read-only audit only; no local UI change in KKM patch.
Not deployed. Physical PWA retry/finish cycle and live corrected verifier
have not been run. No schema/env/uploads/1C writes.
Files:lib/kkm-shift-close-control.ts,tests/kkm-shift-close-control.test.ts;
this scoped memory document (commit separately from runtime if committed).

## Approved handover responsibility — local implementation
- Pending own-cashbox requests fully explaining the counted shortage are owner
  responsibility: `К согласованию`; no personal shortage/close blocker created.
- Payable own-cashbox requests: `Оформите расходник`; existing payable PWA
  attention/push lifecycle retained, including after shift completion.
- Complete posted RKO allocations explain historical shortage with
  `Подтверждено расходником`; never overwrite counted cash or initial 1C audit.
- Multi-cashbox requests without a header cashbox require direct, posted RKO
  allocations. Text such as `16000 МАГА` is not allocation evidence.
- Only complete fresh synchronized sources may confirm. Full sums only;
  no arbitrary subsets; reversed/foreign/ambiguous documents cannot confirm.
- Documented historical requests must belong to the count's Moscow date;
  a later posting may confirm that original request. RKO before count cannot
  retrospectively explain that count.
- Existing notification refresh reconciles persisted PWA notices with CAS;
  ADMIN reads current evidence. No schema or 1C changes.
- Actual application run now enables its check visibility independently of
  Google/app plan source; plan gaps remain separate.
- Local preview: port3210, isolated postgres55471/handover_preview,
  named container mobo-handover-cash-preview-20261025. Demonstration request
  ПРИМЕР-001141 with copied2390/18390 amounts; not a production copy/dump.
- Live local PWA confirmed pending approval does not block finish; after
  approval its existing payable action appears even on a completed shift.
- Desktop ADMIN and390px PWA checked. Initial snapshots:
  /tmp/mobo-handover-approval-admin.png,
  /tmp/mobo-handover-approval-pwa.png,
  /tmp/mobo-handover-payable-pwa.png.

### Exact changed files for this scope
- lib/handover-cash-expenses.ts
- lib/handover-cash-expense-snapshot.ts
- lib/cash-expense-reconciliation.ts
- lib/workday-handover-view.ts
- lib/shift-control-one-c-audit.ts
- lib/team-control-summary.ts
- app/api/employee/shift-control/tasks/[id]/route.ts
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/(dashboard)/admin/workday/page.tsx
- app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx
- tests/handover-cash-expenses.test.ts
- tests/handover-cash-expenses.integration.test.ts
- KKM files listed above; this memory document.

### Test evidence / limits
Pure KKM/cash/handover policies23 tests pass. Dedicated isolated PostgreSQL
integration confirms pending->payable->documented->reversal while preserving
personalCash,oneCAudit,cashRecountInputHistory. Typecheck/build rerun for final
candidate. No real 1C writes, no physical device push test, no production deploy.
Old credit/inbox candidate and main checkout unrelated files left untouched.

## Final lifecycle audit
-25 policy tests plus1 isolated PostgreSQL lifecycle test pass. Typecheck and
 final build rerun after final corrections.
-Local rendered ADMIN cash result becomes Подтверждено расходником; PWA
 payable action disappears after posting and returns on reversal, even with
 completed workday. Original snapshots remain2390/18390.
-Partial own-cashbox RKO plus remaining request amount are combined; mixed
 pending/payable amounts retain both responsibilities. Technical/incomplete
 source is unknown, never proof of shortage.
-Removed duplicate ADMIN incomplete-data action for an already explained
 handover amount. A separate missing incashment source check in isolated
 preview stays visible; never hide another control merely to make row green.
-Employee copy: Заявку ещё не согласовали. Смену можно завершить.
-No production release or real1C writes; physical push not verified.

## Release preparation — not deployment approval
- Runtime change commit45456a9; candidate merge0a78484 includes current
  origin/design-local-updates5c96537 (production1.17.5).
- Live public1.17.5 built2026-10-25T16:10:24.346Z; server
  5c96537fc5c004dc9663057b37a271e0b969c870 independently checked.
- Production tracked tree clean; untracked .rollback/ untouched.
- Read-only filesystem available21GiB; storage maintenance Result=success.
-25 policies +1 isolated PostgreSQL lifecycle +5 release metadata tests pass;
  npx tsc --noEmit and npm run build pass after merge.
- Final review preserves original Google/app plan-source choice independently
  of actual app control visibility. No credit/inbox candidate included.
- No version reserved/bumped yet: owner approved preparation only. On explicit
  release approval, re-fetch branch/live version and increment compatible PATCH
  in package.json/package-lock root; rerun metadata/type/build checks.
- No migration,manual production DB/env/upload changes,1C writes,Telegram changes.
  Code rollback schema-compatible with existing production schema.
- Privileged Docker/current+two verified reserve image identity/existence checks
  and deployment lock/rollback tag preparation remain mandatory before build;
  sudo is interactive. Do not claim rollback-image verification was completed.
- No remote push or deployment performed. This document is committed separately
  from runtime. Old credit/inbox WIP and primary checkout remain untouched.

## Released 1.17.6 — production verified
Owner explicitly approved deployment. Runtime commit:
310198d0dfb28904d1a16aacd34e64091c8edf91.
Public release1.17.6 built2026-10-25T16:38:36.726Z (19:38 MSK).
Server commit independently verified exact. Authenticated production footer1.17.6;
/api/health {ok:true}, container running/healthy. Reviewed real Magomed task499:
2390 counted vs18390 initial1C, now Подтверждено расходником;
no personal shortage, closing confirmed, only4min lateness retained.
Screenshot:/tmp/mobo-production-1.17.6-magomed.png.
Previous image sha256:46710c96dd9abc8a3f773275d1ad307c44718cdddef828ebd833f3de7a93ccc0.
Replacement image sha256:2a442f4032ce85f7c5f11d39cf18cd7ecc47ba79107e99d648eae616c88955fa.
Preflight independently inspected all3 verified registry images, current image
matched registry. Rollback tag portal-app:rollback-before-1.17.6 preserved.
server.env hash and sorted mounts unchanged. No migrations or manual DB writes.
Deployment script reached RELEASE_VERIFIED_AND_REGISTERED; current image added
to existing verified registry only after independent server/public/UI checks.
Native macOS Terminal launched via open -a Terminal with narrowly reviewed
/tmp/mobo-kkm-release-1176.command; owner entered sudo only there.
PWA physical-device push not tested. Historical rejected credit/inbox WIP not
included. No1C package publication. Separate Zukhra control question remains
outside this release investigation; no production questions manually dismissed.
