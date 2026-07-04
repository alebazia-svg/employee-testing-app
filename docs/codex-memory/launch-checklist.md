# Launch Checklist

This checklist is for launching the portal as the daily work tool for employees.
It is product/operations oriented, not a generic engineering roadmap.

## P0 - Required Before Employee Launch

- Run a full workday pilot on phone for 1-2 employees: start day, checklist,
  photos, cash operation, handover, stale-day closure and admin review.
- Keep shift-control templates limited to supported shifts and prevent empty
  `ShiftControlRun` creation.
- Finalize Workday V1 checklist wording so employees confirm real-world facts
  instead of copying 1C data.
- Make cash controls follow the "trust but verify" principle: employee enters
  physical cash fact first, admin/system compares with 1C after.
- Add or verify explicit employee-to-1C-cashbox mapping before scaling beyond
  the small pilot.
- Verify photo uploads persist through Docker volume `portal-uploads`.
- Ensure production dev/debug controls are hidden or disabled.

## P0 - Mobile Experience

Before employees start using the portal daily, the mobile version should feel
like a real app, not a regular website opened by accident.

Required checks:

- own PWA / Web App icon instead of a default browser letter;
- clear app name on the home screen;
- splash screen with Offonika branding/logo;
- launch as a web app without obvious browser chrome where supported;
- mobile login page shows the login form immediately without large scrolling;
- top promo/intro block on mobile is shortened or redesigned;
- check usability on iPhone and Android;
- verify the main Workday scenarios on an actual phone, not only desktop.

## P1 - Strongly Preferred Before Wider Rollout

- Push notifications for checklist timing and overdue tasks.
- Admin "today's exceptions" view for missed start, overdue checklist, unfinished
  day, cash discrepancy and stale-day closure.
- Daily shift report V1 that summarizes cash, acquiring, credits, photos,
  comments and discrepancies in one card.
- 1C read-only endpoints for KKM shift summary, acquiring summary and credit
  sales summary.

## P2 - After Launch

- OFD Control Event V1 with database-backed lifecycle and manager assignment.
- Payroll identity mapping instead of hard-coded aliases.
- Employee-facing salary explanation after payroll sources are stable.
- Banking statement automation and deeper financial reconciliation.
- AI Enhancement starts only after the employee launch is stable. Product
  direction is described in `product-vision.md`; do not turn this launch
  checklist into a separate AI roadmap.
