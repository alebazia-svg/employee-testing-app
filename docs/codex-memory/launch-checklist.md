# Launch Checklist

Last reviewed: 2026-08-28. Priority and future scope are owned by
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
- [x] Workday tests pass (38/38 at the 2026-08-28 review).
- [x] Credit-control tests pass (20/20 at the 2026-08-28 review).
- [x] Expense-request tests pass (38/38 at the 2026-08-28 review).
- [x] Terminal/acquiring tests pass (108/108 at the 2026-08-28 review).
- [x] Payroll regression tests pass (10/10 at the 2026-08-28 review).
- [x] Dedicated 1C date tests pass (9/9 at the 2026-08-28 review).
- [x] All current automated quality gates are green.

## Production Safety Gate

- [x] Inconsistent 1C date parsing was replaced with one shared RU/ISO/Moscow
  parser for ADMIN 1C, Workday, OFD, terminal normalization and credit control.
  Dedicated date tests, all domain suites, TypeScript and production build pass.
- [~] Portal publication is separated from actual push delivery; transient
  failures retry with bounded backoff and delivery/no-subscription/configuration
  outcomes are exposed by the dispatcher inspector. The production migration
  and repeated real-iPhone delivery are verified through multi-day owner
  testing; one controlled transient-failure retry remains to be proven.
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
- [~] The static department QR is explicitly a required start ritual and
  department gate, not independent proof of physical presence. Server
  `qrAcceptedAt`, versioned lateness shadow and department shift-combination
  control are deployed. On 2026-08-30 schedule-aware shift selection and a
  five-minute audited correction were added: one worker receives the long
  department shift; the second of two receives the remaining paired shift;
  an explicit solo override protects against a stale schedule. Verify the full
  QR -> shift -> correction -> WorkDay flow on the pilot iPhone. Shadow data
  cannot drive automatic discipline or payroll consequences.
- [~] Explicit employee-to-1C cashbox mapping exists; verify every pilot
  participant before their first real shift.
- [~] Employee schedule editing, monthly overview, audited changes and
  non-blocking replacement requests are deployed. During owner testing Google
  Sheets remains authoritative. Before the employee pilot, verify a guarded
  Google -> portal synchronization and document the cutover that disables the
  import when the PWA becomes authoritative.
- [~] Upload persistence is designed around `portal-uploads`; perform one final
  upload/rebuild/readback drill.
- [~] Encashment uses an idempotent RKO/PKO pair, deferred reconciliation and a
  manual takeover guard; perform live safe failure/recovery drills.
- [~] Cash operations can be retained locally during a connection failure;
  verify photo, amount and idempotency after reconnecting.
- [~] Push/portal notifications, truthful delivery state and bounded retry are
  deployed; production timer health and repeated delivery to the owner's real
  iPhone are confirmed. Verify one controlled transient retry, exact links and
  automatic lifecycle closure before the employee pilot.
- [~] Terminal, credit, expense and reconciliation jobs exist; verify production
  timers and fresh logs immediately before pilot.
- [~] Current production commit, running container, healthy timers and no fresh
  unexplained application errors were reconfirmed on 2026-08-28. Production is
  on the expected deployed commit; employee and ADMIN Workday routes return
  HTTP 200.
  Application healthcheck and infrastructure watchdog are implemented; deploy
  and verify persistent terminal-finalization catch-up and its 36-hour freshness
  check. Rehearse the application rollback path before marking complete.

## ADMIN Clarity Gate

- [x] ADMIN Главная counts and problem details use the same deduplicated model;
  the former `1 problem / no active problems` contradiction is removed.
- [x] Ordinary `Ожидаются данные` terminal state remains neutral until it is
  actually overdue, incomplete or erroneous.
- [x] Attendance opens on the current Moscow month, normalizes known duplicate
  identities, loads safe Google sources in parallel and states clearly that
  Google remains the temporary payroll source.
- [x] The old credit issue is removed from the employee's active work and kept
  only as unresolved history by explicit owner decision. No new exception or
  escalation workflow is required for that historical case.

## Device Gate

- [x] Installed PWA, QR workday use and repeated push delivery on the current
  iPhone are confirmed through the owner's multi-day employee-role testing.
- [x] Android is not part of the current launch device scope because neither the
  owner nor the planned employees use Android. Run the same device check only
  when an Android user actually enters the rollout.
- [x] Wi-Fi/mobile switching and temporary full loss of internet were verified
  on the owner's iPhone on 2026-09-01: the open PWA remained usable, an offline
  relaunch showed the neutral connection screen and recovery returned to the
  employee view automatically. Weak/unstable-network observation continues
  during the pilot but no longer blocks its start.
- [x] Offline cash-operation and unavailable-1C wording states what was saved,
  what will retry and whether the employee or ADMIN must act.
- [x] The boundary is documented: cash-operation amount/photo retention exists,
  but the whole PWA is not guaranteed to operate without internet.

## Real Employee Pilot Gate

- [x] Prepare one-page employee onboarding and owner phone pilot instructions;
  the employee guide covers internet, camera, 1C/OFD, push and stale-day states.
- [ ] Confirm credentials, department, shifts, schedule and 1C cashbox mapping
  for one Retail and one Wholesale pilot employee.
- [ ] Limit active portal rollout to those pilot participants before their first
  shifts, so employees who have not received the PWA do not create false
  `Рабочий день не начат` attention in ADMIN.
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
