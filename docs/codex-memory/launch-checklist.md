# Launch Checklist

Last reviewed: 2026-08-26. Priority and future scope are owned by
`master-plan.md`; this file is the release gate only.

Status keys: `[x]` verified baseline, `[~]` implemented but still needs a live
or device check, `[ ]` incomplete launch gate.

## Baseline Already Accepted

- [x] Supported Retail and Wholesale shift templates exist and empty
  `ShiftControlRun` creation is prevented.
- [x] Workday V1 wording follows Trust But Verify: employees enter real-world
  facts while system evidence stays separate.
- [x] QR start, shift selection, current action, handover and stale-day handling
  are implemented.
- [x] ADMIN Workday is exception-first and separates business results from
  technical diagnostics.
- [x] Required issues remain active independently from notification read state.
- [x] Production debug mutation routes are disabled.
- [x] PWA branding, manifest, icons, standalone launch and compact mobile login
  are implemented.
- [x] Printable A5 department QR layouts are implemented.

## Code Quality Gate

- [x] `npx tsc --noEmit` passes.
- [x] `npm run build` passes.
- [x] Workday tests pass (22/22 at the 2026-08-23 review).
- [x] Credit-control tests pass (18/18 at the 2026-08-23 review).
- [x] Expense-request tests pass (38/38 at the 2026-08-23 review).
- [x] Terminal/acquiring tests pass (98/98 at the 2026-08-23 review).
- [x] Payroll regression tests pass (10/10 at the 2026-08-23 review).
- [x] All current automated quality gates are green.

## Production Safety Gate

- [x] Inconsistent 1C date parsing was replaced with one shared RU/ISO/Moscow
  parser for ADMIN 1C, Workday, OFD, terminal normalization and credit control.
  Dedicated date tests, all domain suites, TypeScript and production build pass.
- [~] Portal publication is separated from actual push delivery; transient
  failures retry with bounded backoff and delivery/no-subscription/configuration
  outcomes are exposed by the dispatcher inspector. Apply the migration and
  verify successful delivery plus one controlled retry on a real device.
- [x] Critical/high production dependency findings are closed: production runs
  Next.js 15.5.24 and official SheetJS 0.20.3; `npm audit --omit=dev` is 0 and
  full regression/build pass.
- [x] Cash and shift-photo uploads are capped at 8 MB and validate real
  JPG/PNG/WebP signatures and MIME types.
- [x] Daily PostgreSQL/uploads backup, integrity checks and one isolated restore
  rehearsal are proven. A daily public-key-encrypted copy is sent to Yandex
  Disk; download, SHA-256 readback, decryption and PostgreSQL dump inspection
  were proven on 2026-08-28. The private key remains on the owner's Mac.
- [x] Legacy 1C cash states were reconciled or explicitly archived and the one
  stale consumed/approved close-request inconsistency was repaired with readback.
- [ ] Decide whether the static QR is only a convenient start ritual or must be
  server-validated physical-presence evidence; do not use self-selected shift
  lateness for discipline before this boundary is explicit.
- [~] Explicit employee-to-1C cashbox mapping exists; verify every pilot
  participant before their first real shift.
- [~] Upload persistence is designed around `portal-uploads`; perform one final
  upload/rebuild/readback drill.
- [~] Encashment uses an idempotent RKO/PKO pair, deferred reconciliation and a
  manual takeover guard; perform live safe failure/recovery drills.
- [~] Cash operations can be retained locally during a connection failure;
  verify photo, amount and idempotency after reconnecting.
- [~] Push/portal notifications and the dedicated one-minute dispatcher are
  deployed; production timer health is confirmed. Truthful push state and retry
  handling are implemented locally. Apply the migration, then verify real-device
  delivery, one controlled retry, exact links and automatic lifecycle closure.
- [~] Terminal, credit, expense and reconciliation jobs exist; verify production
  timers and fresh logs immediately before pilot.
- [~] Current production commit, running container, healthy timers and no fresh
  unexplained application errors were confirmed during the 2026-08-25 audit.
  Add an application healthcheck, timer catch-up monitoring and a proven
  rollback/restore path before marking complete.

## ADMIN Clarity Gate

- [x] ADMIN Главная counts and problem details use the same deduplicated model;
  the former `1 problem / no active problems` contradiction is removed.
- [x] Ordinary `Ожидаются данные` terminal state remains neutral until it is
  actually overdue, incomplete or erroneous.
- [ ] Open Attendance on the current month, normalize duplicate identities and
  state clearly that Google remains the temporary payroll source.
- [ ] Resolve the current old credit issue and define an audited exception path
  for a factual correction that an employee cannot perform.

## Device Gate

- [~] Verify installed PWA, QR camera, screen-lock resume and push delivery on
  the current iPhone.
- [ ] Verify the same path on at least one supported Android device.
- [ ] Test Wi-Fi/mobile switching, weak connectivity and temporary full loss of
  internet.
- [ ] Confirm that every offline or unavailable-source message states what was
  saved, what will retry and what the employee must do now.
- [ ] Document the boundary: cash-operation retention exists, but the whole PWA
  is not guaranteed to operate without internet.

## Real Employee Pilot Gate

- [ ] Prepare one-page employee onboarding and ADMIN incident instructions.
- [ ] Confirm credentials, department, shifts, schedule and 1C cashbox mapping
  for one Retail and one Wholesale pilot employee.
- [ ] Let both employees perform at least five real shifts themselves.
- [ ] Observe QR start, due reminders, corrections, cash, encashment, issues,
  notifications, handover and next-day state.
- [ ] Complete at least one controlled internet-loss drill and one 1C-unavailable
  drill without losing data or duplicating 1C documents.
- [ ] Reach five consecutive pilot shifts with no open P0 defect or developer
  intervention in the employee's normal path.

## Wider Rollout Decision

Approve wider rollout only when:

- [ ] every automated quality gate is green;
- [ ] all pilot days close correctly;
- [ ] no amount/photo is lost and no cash document is duplicated;
- [ ] unavailable sources remain neutral and never falsely accuse employees;
- [ ] notifications always lead to a current concrete action;
- [ ] ADMIN explains every exception and next action within seconds;
- [ ] employees know what to do for internet, 1C, camera and notification
  failures;
- [ ] rollback and first-week enhanced monitoring are assigned.

Payroll transparency, new discipline rules, attestations, prepayment/PKO
analysis, OFD Control Event V1, attendance-source migration and AI are explicitly
after-launch work. They do not block this checklist.
