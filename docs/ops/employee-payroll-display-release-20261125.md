# Employee payroll display 1.25.28

Installed and verified on 25 November 2026 (Moscow). Runtime
`1cc56fefcaff25388ecba3e627923591eeb106fa`, built at
`2026-11-25T15:48:53.380Z`. Session
`1217a267bff74e0fb0006ba5dc63fb4e` reached COMPLETE. Exact archive retained
in the local verified store. Checked server commit, public metadata and health,
and the authenticated ADMIN release label.

The five changed application files implement three approved changes: past
planned days with no start mark no longer require confirmation to open salary,
Timur has My salary using his existing binding, and the preliminary calculation
shows its composition and the advance difference. Today/tomorrow plans,
today's QR start and unfinished-shift access policy are preserved. Calculation,
payments, settlement readers, closed payroll records, schema and Compose are
unchanged. Payment dates are outside this release.

The exact image showed equal values in a local employee session and the
read-only ADMIN preview on one repository-backed fixture with a test 1C cash
response. The production ADMIN view showed Timur's 40,800 preliminary accrual
and 58,000 advance before and after the change, with the new 17,200 difference
shown without a minus. Zalina retained 82,900 and both breakdown rows. Magomed
opened his November salary without the historical day-review prompt. His October
confirmed accrual loaded and the payment fields showed their existing
checking state. No production payroll records or shifts were changed for QA.
Physical employee phones were not tested.

Version metadata tests, 80 payroll regressions, 40 focused checks, the isolated
PostgreSQL access test, TypeScript and the production build passed.
Registered image `sha256:f1b0bc058d38a0432b96f9e26d7f998766a7b237a1291b9ee06540fc3777ced2`.
Protected reserves are 1.25.27
`sha256:13ba6a30d4b06f36a3f64a64fd120c402ebe5bc56008d55311509928d116b4f5`
and 1.25.26
`sha256:b3e2bbf036d44f6ad48e2a58a10b67433cad022e7b58af79097eee82d57c8d21`.
