# Diana PWA known earnings — 2026-10-31

Owner approved connecting the reviewed local screen to real payroll and releasing it.
Released and independently verified: 1.19.12 / `9806c22cd5c4ddbd270cad42964e8a6903700a53`.

Only the private current-month projection for the uniquely bound Кумахова Диана,
from October 2026 onward, may display known sales while days, manual lateness or
Finbox are missing. Shared ADMIN formulas, approval blockers, drafts, FINAL/CLOSED
history, other employees, workday/calendar rules and 1C remain unchanged.

- Reuse the existing complete contiguous daily sources and classification checks.
  A source failure is never repaired with a fabricated zero or fixture amount.
- Missing days or an automatic zero with no marks displays «Выходы — Не отмечены»;
  omit its monetary component. An explicit owner manual correction of zero remains
  authoritative. Once sourced days appear, use their existing calculated day pay.
- Keep the normal hero and «Предварительный расчёт». The approved caption is:
  «Заполняйте график в календаре. Каждый выход подтверждайте QR-кодом в начале смены
  и отмечайте её завершение в приложении.» PWA planning does not create QR facts;
  the released Google schedule fallback is retained.
- Finbox is entered by the owner. Until entered, omit it without asking the
  employee for a report. Once entered, show its existing calculated component
  as «Финбокс». Do not display discipline or one-time bonuses in this estimate.
- Preserve the current/previous rolling month pair. Current is the default;
  previous supports reconciliation with salary now being issued. No new month
  policy or navigation changes were authorized by the owner's question.
- The former local fixture route and financial JSON are excluded from the commit.
  No schema migration, production financial write or 1C write.

Verification before release: 78 standard payroll tests, 63 focused payroll/history/
load/attendance-source tests, 5 release metadata checks, TypeScript and production
build passed. Five other isolated manager profiles retained both monthly results,
settlement reconciliation, private no-store responses and identity override denial.
Actual ordinary local PWA screen renders captured source earnings (through October23)
with missing-day instruction; these are older captured sources, not claimed current
production financial truth. Physical iPhone not tested. Read-only production comparison passed: seven other active employee projections
were identical to the old reader, source evidence unchanged. Diana renders an
estimate of 9,500 RUB through October23, days unmarked, Finbox not entered.
Production public metadata and authenticated PWA About dialog confirm1.19.12,
built2026-10-31T09:42:54.175Z (12:42 MSK). Server commit matches runtime.
Diana current view shows known earnings, missing-day caption and no unknown
advance/Finbox card. September remains22,800 accrued/received,0 remaining.
API without auth returns401; healthok. Mounts and1C connection fingerprint unchanged.
Deploy exit0, containerhealthy, free26.38GiB; current plus two verified images
registered. No claim of physical-iPhone verification.

Replacement image: sha256:d961b9001fccd128c4135fb6255a70be6fd829061572a03c062cff8229283815.
Previous1.19.11: sha256:c4aaaa7fa4ac7780ef1b8b78723f9bf10d661caba120b4de2b2cc0586dfe4498.
Second reserve1.19.10: sha256:ae9335a0cae8f5290aaaf3d2c0bd7f7dcf3849963d3aeb1ef3882cbe14158e6d.
No schema delta; rollback remains compatible.

Exact runtime files:
- app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx
- lib/employee-payroll-estimate.ts
- lib/employee-payroll-read.ts
- lib/employee-payroll-view.ts
- lib/payroll-current-read.ts
- tests/employee-payroll-read.test.ts
- tests/employee-payroll-view.test.ts
- tests/payroll-current-read.test.ts
- package.json
- package-lock.json

Owner subsequently requested local access-condition examples (missing today/
tomorrow schedule, missing shift start, day off). These are a separate visual
proposal, not approval to enable production restrictions or change salary rules.
