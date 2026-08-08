# Portal Decision Log

## 2026-07-02 - Codex Memory Split

The AIAgentAPI/1C extension memory lives in:

```text
C:\Users\kbr4\OneDrive\Рабочий стол\ai-business-os
```

The portal memory lives in this repository:

```text
C:\Projects\employee-testing-app-main
```

Do not assume one repo's `AGENTS.md` covers the other.

## 2026-07-02 - OFD Next Step

Stop treating `/admin/ofd` as an endless UI polishing task. The next major step
should be `OfdControlEvent V1` with database-backed event state, assignment,
status lifecycle and later notifications.

## 2026-07-02 - Workday Pilot

Workday pilot should prioritize:

- supported shift templates;
- no empty checklist runs;
- persistent photo uploads;
- clear stale-day closure;
- admin visibility of cash statement data and checklist state.

Early-close approvals, discipline impact and notification automation can come
after the basic pilot path is stable.

## 2026-07-02 - Cash Statements

1C cash statement endpoints are live through AIAgentAPI and useful for admin
workday checks. They should not automatically replace the employee's real cash
recount. The employee should not be encouraged to simply copy 1C balances.

## 2026-07-02 - Payroll Identity

Magomed Kosterenko and the old trainee retail account should be aggregated as
one payroll person for current historical data. The generic trainee account may
be reused later, so long-term identity needs a safer mapping than display-name
matching.

## 2026-07-02 - Push Notifications

Checklist timing notifications are important for pilot usability. The preferred
direction discussed was push notifications rather than Telegram as the first
channel.

## 2026-07-02 - Codex Operating Memory

The portal memory should encode repeated mistakes as prevention rules:

- stage exact files, never `git add .`;
- separate portal and AIAgentAPI release work;
- verify deploy by server commit, container rebuild and route behavior;
- park future Prisma/OFD database work in `.wip/` until explicitly started;
- investigate existing implementation before proposing new architecture.

Future sessions should update these playbooks when a workflow changes or a
mistake repeats.

## 2026-07-02 - Trust But Verify

The portal should not make employees copy 1C data or fill long forms for the
appearance of control. Employees confirm facts that need human action; the portal
uses 1C/OFD/other sources for automatic checks where possible.

If an employee marks "everything is OK" and later automation finds a mismatch,
that mismatch becomes a separate control event that can request re-check,
comment, manager notification, violation journal entry and future discipline or
bonus impact.

## 2026-07-09 - Workday Manual Answers Are Declarations

Accepted target architecture for Workday Control:

- an employee checklist answer is only a manual declaration;
- the system truth/control result is built separately from portal data, 1C,
  OFD/SABY, photos and other trusted evidence;
- automatic verification must not block checklist completion by default;
- contradictions between the manual declaration and system evidence become
  warnings/control events for admin review;
- future integrations should keep manual response, system evidence, system
  check result and admin review status as separate concepts.

Examples to preserve in future design:

- employee declares no T-Bank/acquiring operation, but 1C or OFD finds one;
- employee declares "verified", but 1C and OFD amounts or receipts differ;
- OFD receipt exists without a matching 1C document;
- 1C document exists without a matching OFD receipt;
- source data is unavailable or delayed, so the task is completed but marked
  as pending/needs review when evidence arrives.

Do not retrofit employee-facing checklist fields into sources of truth. They
remain inputs for later verification.

## 2026-07-02 - Mobile Experience Is P0 For Launch

Before employees use the portal daily, the mobile experience must feel like an
app: proper PWA icon/name/splash, login form visible without large scrolling,
short mobile intro, and actual iPhone/Android verification of Workday flows.

## 2026-07-04 - Workday QR Start UX

The Workday start flow should use in-app QR scanning as workplace confirmation.
The main path is not an external QR link opened by the phone camera.

Accepted MVP:

- department QR payloads are `offonika-workday-start:retail` and
  `offonika-workday-start:wholesale`;
- employee taps `Сканировать QR` inside `/employee`;
- after a valid scan, shift selection opens as a bottom sheet;
- after shift selection, the workday starts immediately and the first checklist
  action is the main focus;
- `/admin/workday` shows QR codes for printing/opening;
- `/admin/dev/qr-test` remains available as a diagnostic camera test.

The first employee screen should now be considered closed for this phase unless
testing finds a concrete usability problem. Avoid reintroducing the old large
circular start/finish control or a separate active-day finish button.

## 2026-07-04 - Workday Cashbox Mapping

`Наличные по 1С` in `/admin/workday` must use the explicit
`UserOneCCashboxMapping` relation:

```text
portal userId -> oneCCashboxRef / oneCCashboxName
```

Do not use surname/family-name matching as the source of truth for 1C cashbox
checks. Name-based matching may appear only as an admin suggestion/diagnostic
when no explicit mapping exists.

This decision supports Workday cash reconciliation and the Trust But Verify
principle: employees count real cash, while the portal compares against the
correct 1C cashbox selected by admin-controlled mapping.

## 2026-07-04 - AI Direction For Portal

AI should be layered on top of deterministic business control, not built as a
separate product or a replacement for rules.

Accepted direction:

- first create reliable source-backed control events and evidence snapshots;
- use rules, 1C, OFD/SABY and PostgreSQL as the factual base;
- use AI for explanations, daily briefs, grouping, drafts and investigation
  support;
- keep financial, payroll, discipline and 1C-changing actions human-in-the-loop;
- treat AI Operations Copilot as a long-term evolution of the portal after the
  employee launch and business control platform are stable.

## 2026-07-24 - Workday Automatic 1C Checks

The first Workday automatic-verification layer is calculated read-only in the
admin portal without changing employee checklist answers or writing to 1C.

Accepted scope:

- cash is checked at the actual task completion time from 1C cash-register
  movements;
- the shared reserve uses the exact 1C cashbox `Резерв под телефоны`;
- Sberbank uses KKM/acquiring usage tied to the employee's explicitly mapped
  cashbox;
- T-Bank uses posted realizations and manager-name matching;
- encashment requires paired accounting movements between the employee cashbox
  and reserve.

The current KKM contract is not sufficient to prove X/Z reports or reconstruct
an intermediate terminal total. Those checks must be shown as
`Нельзя проверить автоматически` instead of being presented as confirmed facts.

## 2026-07-25 - Workday Manual Review Audit

Automatic evidence and administrator decisions remain separate.

- unreliable automation uses `Нельзя проверить автоматически`; the ambiguous
  status `Частично` is not used;
- a manual review records either `данные подтверждены` or
  `проблема подтверждена`;
- every manual review is append-only and stores the administrator, exact time
  and required comment;
- confirming data manually resolves only that automatic check;
- confirming a problem keeps the employee in the attention workflow;
- employee answers and original 1C evidence are never overwritten.

## 2026-07-25 - Workday Time Violations

Workday time status is calculated by one shared rule set for the admin table and
employee detail card.

- late start, late checklist completion and overdue pending tasks are separate
  violations;
- an active day is not treated as unfinished until its selected shift end;
- a missing same-day start becomes a violation only after the latest supported
  department shift start;
- if a department has no fixed supported shifts, the portal does not invent a
  start deadline;
- completion after midnight remains a real late completion for the original
  workday;
- test data follows the same timing rules as production data.

## 2026-08-08 - Employee Checklist Corrections

Employees may correct a completed checklist answer while the workday is still
active. Corrections are controlled rather than destructive:

- navigation inside an unfinished checklist remains freely reversible;
- a completed task exposes `Исправить ответ` until shift handover;
- the original answer, correction time and prior evidence are appended to the
  task revision history and remain visible to administrators;
- the original task `completedAt` remains unchanged, so terminal intervals do
  not move or overlap after a correction;
- a cash correction keeps the 1C snapshot captured at original completion;
- changing a conditional answer clears data that is no longer applicable;
- an existing required photo may be retained or replaced, but not silently
  removed while the corrected answer still requires it;
- after shift handover, employees cannot edit the completed workday.
