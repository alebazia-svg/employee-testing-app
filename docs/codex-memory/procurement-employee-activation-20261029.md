# Procurement employee activation — 2026-10-29

Owner explicitly approved configuring Astemir's workday and creating Кумыков
Мухамед in Procurement, WORKDAY only, linked to the existing payroll identity.
Production application remains 1.19.3 / runtime `2c1d4961`. No code release,
migration, production SQL, 1C write or financial submission was needed.

## Saved through authenticated ADMIN Employees

- Existing `a.tokhov`, display Астемир Тохов: changed only department from
  `operations` to `procurement`. Retained active EMPLOYEE, PROCUREMENT area,
  payroll name `Тохов Астемир`, purchase_manager rule from 2026-08 and exact
  oneCManagerName `Тохов Астемир`. Existing password/access not reset.
- New `m.kumykov`, display **Кумыков Мухамед** (one м after а): active EMPLOYEE,
  department procurement, portalArea WORKDAY, default SCAN QR mode, no purchasing
  or financial area. Default automatically generated password was left masked
  in the owner-visible access dialog; not copied into logs, chat or docs, not
  sent to the employee. Do not reset just to retrieve it without authorization.
- Payroll name explicitly saved as **Кумыков Мухаммед** (two м after а), matching
  the existing canonical payroll entry exactly. No duplicate payroll row and no
  new salary rule. User-level salary fields remain null so existing builtin
  purchase_daily rule is inherited. ADMIN's generic “Требует настройки” label
  for this legacy builtin rule does not mean a new salary formula is required.
- Diana was not part of this activation request; disabled Retail access retained.

## Verification

- Fresh ADMIN read confirmed both saved employee records and the canonical
  payroll name. Checked inactive employees before creation; no duplicate access.
- Reloaded actual October payroll: exactly one Кумыков Мухаммед row, unchanged
  24,000 accrual, 7,500 advance and 16,500 after advance. No calculation approved
  or saved, no historical statement rewritten.
- Existing pure directory builder checked before/after linking: identical full
  directory for October and November, one canonical row; purchase_daily, rate
  1,500, agreed days 16 for October / 20 from November retained. Attendance marks
  do not replace the existing agreed-days salary policy in this task.
- Real actor-bound employee preview at 390x844 confirms Muhamed's own name,
  Procurement QR prompt, no shift selector, only Day/Schedule navigation and
  department colleague Astemir. Schedule opens normally; no actual dates marked.
- Nine existing workday-end policy tests pass, including exact published
  Procurement poster QR, three bounded slots, stale end-time validation and
  cancellation after completion. Existing policy: actual start/end only, no
  late penalties; start requires Procurement QR, end does not require QR;
  forgotten day requires actual end time, never auto-closes.
- Read-only server check: offonika-workday-notifications.timer active, service
  Result=success / ExecMainStatus=0. Reminders at 18:00, 18:30, 19:00 Moscow apply
  only to an actual unfinished workday. No fake shift created to test delivery.
- No real physical camera scan or phone push delivery was performed. Existing
  local/test start/finish end-to-end evidence remains in the candidate report.
- Temporary viewport override reset. Local untracked demo harness, node_modules
  and uploads links left untouched. No application build needed for account-only
  settings and this documentation update.

Screenshot:
`/Users/bela/.codex/visualizations/2026/10/26/01a17a42-c4f9-76c3-a778-25efa747a27a/muhamed-workday-configured-20261029.png`.

## Subsequent owner-approved Diana activation

Owner separately confirmed enabling Diana's disabled access on 2026-10-29. Through
normal ADMIN Employees, changed only isActive to true; retained Кумахова Диана,
login d.kumakhova, Retail, WORKDAY, SCAN and existing payroll identity/rule.
Re-read shows active access. Actor-bound preview confirms Retail QR prompt with
no shift selector, Day/Schedule/Salary navigation. Existing named Diana exception
uses actual marks, end without QR and three 18:00/18:30/19:00 Moscow reminders.
No real workday started, password reset, fiscal/financial action or 1C write.
Existing workday policy tests cover Diana. Screenshot saved as
`diana-workday-active-20261029.png` in the same visualization directory.

Muhamed's original masked access dialog still exists in Microsoft Edge tab
831432177; user was viewing the local Codex preview and could not see that Edge
tab. Do not reset the password or reload/close this one-time dialog. Screenshot
`muhamed-access-dialog-masked.png` shows where Show/Copy controls are located,
without recording the password.
