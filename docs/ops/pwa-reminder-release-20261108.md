# Unified PWA reminders — release1.21.48,8November2026

## Owner-approved scope

Only the approved common reminder presentation and missing schedule-day qualifier.
Runtime commit `6915be8e1660d6aa9e294826d0485297b1f2e642`, based on verified1.21.47
plus its documentation8a62648. The existing Workday attention caption now also
travels through the shared reminder to Schedule, Salary and Procurement.
Today/tomorrow/both are taken from the same current attention snapshot; no new
horizon, source, push or repeat policy. Existing save/refresh event removes the
filled day immediately; working/off/vacation handling is unchanged.

The icon, text and chevron are one semantic button/link instead of a separate
«Открыть». Same onOpen/href; «Напомнить позже» is a separate sibling button and
never opens the task. Applies to all uses of ActionReminderNotice, including
receipts, payable requests, KKM/checklist and personal end reminder. Existing
priorities, waiting states, event routing and source failure handling retained.
No notification copy other than the approved missing-day caption changed.

No API/auth/schema/migration, schedule policy, financial/shift/check/1C/OFD/payroll
change. Exact six files listed below. Other dirty worktrees left untouched.

## Verification

Production build and TypeScript passed on the exact fresh release worktree;
52targeted tests +5release metadata tests passed,0fail/skip. Whitespace gate passed.
Real authenticated isolated application, not recreated demo screen: Workday,
Schedule, Salary, mounted Procurement sections; caption today/tomorrow/both,
real employee save one-day→remaining-day→none, off day accepted, single missing
date opens original editor. Own clone only, no production schedule mutation.
Receipt/checklist priority retained; whole-card text opens exact credit check;
independent defer hides only the reminder, opens no dialog. Bell retains count
and five fixture notices stay unread after ADMIN inspection. Mobile390x844:
document width375; full-page screenshots saved to
`/tmp/mobo-schedule-copy-20261108/unified-{schedule,receipt}-full.png`.
Physical employee phone, actual push delivery and live financial actions were not
tested. No real employee save/read/finish was used as a production smoke.

Logs: `/tmp/mobo-reminder-release-{build,tsc,tests,metadata}.log`.

## Installation / preservation

Installed and independently verified8November2026. Public release1.21.48,
builtAt `2026-11-07T22:22:52.681Z` (01:22MSK). Docker metadata revision/source
remain null/unknown; exact VPS HEAD independently confirmed as6915be8 and image
`sha256:53a7a3596fb1250dd11eee88940fe4315dcd6b391782458efcceaee9a7ad8132`.
Public health ok; authenticated ADMIN footer and employee About display1.21.48.
Production Muhamed inspection: same today+tomorrow caption on Workday and Schedule;
whole-card button opens the calendar, no separate Open control; bell/back works,
existing notification setup state preserved. No real employee save/read/finish.
Screenshots `/tmp/mobo-reminder-release-20261108/production-{schedule,version}.png`.

Root worker compared before/after and again after independent UI verification:
1571existing notification read markers,157workdays,713plans and558tasks unchanged;
10users/9templates/5cashbox mappings retain hashes;324mature original upload paths
and sizes preserved. Cash operations104 before/after. env/mounts/notification
unit+timer definitions unchanged. No pending/new migration. Only portal-app built.

Existing release flock used, target SHA/current source gates passed. No other chat
was messaged or stopped. After independent verification marker, image registered
and approved bounded storage policy completed. Current1.21.48 plus verified
1.21.47 and1.21.46 images exist,20.10GiB free. `RELEASE_VERIFIED_AND_REGISTERED`,
`RELEASE_EXIT=0`, finalhealthy. Root evidence
`/root/mobo-reminder-1.21.48-20261108/`; owner-readable log
`/home/bela/mobo-reminder-1.21.48-release.log`; reviewed native Terminal launcher
`/tmp/mobo-reminder-1.21.48.command`. No release action remains pending.

## Exact changed files

- `components/workday/EmployeeActionReminder.tsx`
- `components/workday/EmployeeActionReminder.module.css`
- `lib/employee-action-reminder.ts`
- `tests/employee-schedule-attention.test.ts`
- `package.json`
- `package-lock.json`
