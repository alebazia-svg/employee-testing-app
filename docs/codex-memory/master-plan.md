# Offonika Portal Master Plan

Last reviewed: 2026-08-23.

This is the single operational roadmap for the portal. It separates accepted
scope, launch blockers and future ideas so that a new idea does not silently
become part of the active implementation task.

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `DONE` | Implemented and accepted; change only for a concrete defect. |
| `VERIFY` | Implemented, but still needs a production/device/failure drill. |
| `NEXT` | The active work queue before employee rollout. |
| `PILOT` | Must be proven by real employees, not only by ADMIN simulation. |
| `AFTER LAUNCH` | Useful, but must not delay the initial employee rollout. |
| `IDEA` | Requires business, UX, architecture and evidence review before planning. |
| `NOT NOW` | Intentionally excluded from the current product phase. |

## Current Product Phase

The portal has moved beyond prototype UI work. ADMIN/PWA structure and the
primary Workday workflow are sufficiently mature for launch hardening. The
current phase is:

```text
launch hardening -> two-employee pilot -> controlled wider rollout
```

Do not start another broad redesign or a new business domain until the pilot
gate is complete, unless a newly discovered P0 defect makes the pilot unsafe.

## Accepted And Implemented Baseline

| Area | Status | Current accepted result |
| --- | --- | --- |
| PWA entry and navigation | `DONE` | Branded mobile login, PWA icon/manifest, compact Workday and Schedule navigation. |
| Workday start | `DONE` | Department QR scan inside the PWA, supported shift selection and immediate action focus. |
| Workday checklist | `DONE` | Supported templates only, no empty runs, reversible unfinished flow and audited corrections before handover. |
| Schedule | `DONE` | Real Google Sheets schedule is imported into the portal as the temporary source while employees are not yet fully migrated. |
| ADMIN structure | `DONE` | Main ADMIN, Inbox and Workday Control have distinct purposes and exception-first presentation. |
| Required issues | `DONE` | Active issues remain visible after notification read and close only after factual resolution. |
| Cash recount | `DONE` | Employee records the physical fact; hidden 1C evidence and differences remain on the ADMIN side. |
| Encashment | `VERIFY` | Atomic/idempotent RKO+PKO pair, deferred 1C control, manual takeover guard and later reconciliation are implemented. |
| Connectivity protection | `VERIFY` | Failed cash uploads can be retained on the phone and retried; this is not full offline PWA support. |
| Credit receipt control | `VERIFY` | Deterministic 1C/OFD lifecycle and employee-safe exception wording are implemented; production observation remains required. |
| Terminal/acquiring control | `VERIFY` | Rules fail closed, ambiguous cases remain ADMIN-only and employee attribution requires reliable evidence. |
| Employee notifications | `VERIFY` | Portal Inbox/push lifecycle and the dedicated one-minute production dispatcher are deployed; timer health is confirmed and device delivery still requires verification. |
| ADMIN Telegram | `VERIFY` | Only events requiring owner attention should be duplicated; read state is separate from business-resolution state. |
| Printable QR holders | `DONE` | Separate approved A5 Retail and Wholesale print layouts are available from ADMIN. |
| Payroll | `DONE` for current process | Existing formulas and the agreed discipline rule remain unchanged. Direct 1C payroll and employee earnings are not part of launch. |

## Active Queue Before Pilot

Complete in this order:

1. `DONE` Restore the full automated quality gate:
   - repair the payroll regression harness after the page/client split;
   - update the expense-request Telegram link expectation for Inbox routing;
   - update the terminal-message test fixture for ADMIN Telegram delivery;
   - rerun TypeScript, build and all domain test suites.
2. `NEXT` Conduct one cross-functional pre-pilot audit of the whole product:
   - business usefulness and completeness of every employee and ADMIN workflow;
   - PWA and ADMIN information architecture, wording, visual hierarchy,
     accessibility and device-specific usability;
   - all reminders, Inbox items, push messages and Telegram duplicates, including
     trigger, recipient, timing, wording, deep link, read state and resolution;
   - 1C/OFD/bank/schedule dependencies, source-of-truth boundaries, stale data,
     idempotency, recovery and manual-takeover safety;
   - empty, duplicated, obsolete, unreachable or half-working screens, actions,
     tasks, notifications and history states;
   - data retention, permissions, personal-data exposure, logs, uploads,
     performance, monitoring, backup and rollback readiness;
   - operational edge cases and small inconsistencies that can confuse an
     employee or ADMIN even when the main flow technically succeeds.

   Produce one evidence-backed register with exact locations and four outcomes:
   `launch blocker`, `fix before pilot`, `after launch` or `remove/decline`.
   Close or explicitly accept every launch blocker before starting the pilot.
3. `NEXT` Run controlled failure drills in production-safe scope:
   - 1C unavailable before/during encashment;
   - connection loss during a cash operation/photo upload;
   - locally retained operation is sent after connectivity returns;
   - ADMIN has already handled RKO/PKO manually and automatic retry does not duplicate it;
   - delayed 1C recovery moves the case to the correct ADMIN state without blocking the employee;
   - notification disappears only when its underlying action is no longer active.
   - verify employee push delivery on a real device; the dedicated production dispatcher is already active.
4. `NEXT` Verify the device matrix:
   - installed PWA on the current iPhone;
   - at least one supported Android device;
   - camera permission and QR scan;
   - push permission and delivery;
   - app resume after screen lock/backgrounding;
   - Wi-Fi/mobile-data switching and weak connection behavior.
5. `NEXT` Verify production operations:
   - current server commit and container health;
   - notification, expense, terminal, credit and reconciliation timers;
   - persistent uploads volume;
   - recent logs contain no unexplained fresh application/API errors;
   - rollback path is ready.
6. `NEXT` Prepare a one-page employee onboarding instruction and an ADMIN incident
   script for internet, 1C, camera, notification and unfinished-day problems.

## Pilot Gate

Pilot participants:

- one Retail employee;
- one Wholesale employee;
- at least five real shifts performed by the employees themselves.

During the pilot, ADMIN observes and resolves exceptions but does not perform
the employee's normal path on their behalf. Do not add broad new features during
these shifts.

The pilot passes only when all of the following are true:

- the cross-functional pre-pilot audit is complete and every launch blocker is
  closed or explicitly accepted with a safe operating procedure;
- every shift can start, progress and finish without developer intervention;
- no entered amount or required photo is lost;
- no duplicate cash documents are created in 1C;
- 1C/source outages do not create false employee accusations or block the day;
- active issues and notifications open the exact required action;
- resolved or obsolete notifications leave the active employee view;
- ADMIN can understand every exception and required action within seconds;
- employees can explain what to do when internet, 1C or a notification fails;
- no P0 defect remains open after five consecutive pilot shifts.

## Wider Rollout Gate

After the two-person pilot passes:

1. Enable the PWA for the remaining employees in controlled groups.
2. Keep enhanced ADMIN monitoring for the first full working week.
3. Preserve the previous operating procedure as a recovery instruction, but do
   not duplicate the same financial operation in both paths.
4. Review pilot evidence and promote only proven follow-up needs into the active
   roadmap.

## After Launch Roadmap

These items are useful but do not block employee rollout:

1. Replace Google Sheets attendance/schedule history with portal WorkDayEntry
   data after the real employee process has enough trustworthy history.
2. Stabilize payroll identity mapping and direct read-only 1C payroll sources.
3. Run one or two payroll periods in ADMIN-only shadow comparison.
4. Design the employee-facing `Мой заработок` explanation only after payroll
   sources and policy are stable. The current agreed discipline rule stays
   unchanged until a separate policy decision.
5. Design useful novice/experienced employee attestations from verified business
   processes and evidence, not from generic questions.
6. Continue OFD Control Event V1 and deeper financial reconciliation without
   mixing that architecture into Workday launch hardening.
7. Add AI explanations/briefs only on top of reliable deterministic events.

## Idea Inbox Requiring Separate Analysis

These are captured ideas, not accepted implementation tasks:

- correct 1C treatment of retail prepayments linked to customer orders without
  distorting the shared retail-customer balance;
- detection of duplicate/unnecessary PKO documents and cases where PKO is used
  instead of acquiring;
- treatment of legitimate wholesale debt/credit payments in those controls;
- a transparent employee earnings view and possible future bonus-event model;
- broader offline queues for workday actions beyond cash operations;
- removal, archiving or repurposing of the remaining Analytics area;
- future expansion of attestations and management knowledge-gap reporting.

For every idea, first decide: business problem, source of truth, affected user,
false-positive risk, operational cost, legal/policy impact, relationship to an
existing feature and the earliest safe roadmap phase. Only then move it from
`IDEA` to an implementation status.

## Explicitly Not In The Launch Scope

- automatic payroll penalties or new discipline rules;
- unconfirmed financial actions from Telegram;
- automatic 1C writes without an explicit approved workflow and idempotency;
- claiming that the whole PWA works offline;
- AI as the source of truth for money, payroll, discipline or employee errors;
- redesigning accepted screens without a concrete usability defect from pilot.

## Plan Maintenance Rule

- New user ideas enter `Idea Inbox` first.
- Accepted decisions belong in `decision-log.md`.
- Current launch evidence and gates belong in `launch-checklist.md`.
- This file owns priority and phase status.
- Update status only from verified code, production evidence or an explicit
  business decision; chat discussion alone is not implementation evidence.
