# October payment allocation — production 1.21.11

Owner explicitly confirmed that the two reviewed November 2 cash documents
belong to October. The existing exact-document reconciliation now assigns those
rows to October; changed identity/date/amount/comment requires review again,
and an explicit source month retains precedence. No general November payment
inference, salary formula, rounding, UI or saved FINAL change was introduced.

Runtime files: `lib/payroll-settlement-month.ts`,
`tests/payroll-settlement-month.test.ts`, `package.json`, `package-lock.json`.
43 focused tests, 79 payroll regressions, five release metadata tests,
TypeScript, production build and whitespace checks passed. Private source
replay and both actual authenticated employee payroll responses matched after
deployment. Physical employee phones were not exercised.

- Commit: `63c612176058963fa59061443ff69f9aa62256b2`.
- Version: 1.21.11; builtAt `2026-11-03T15:03:45.992Z` (18:03 MSK).
- Image: `sha256:3eb276d8a5dbd23cfeac8112eb8749822ee895722aa456ce604ebe1074203c73`.
- Source commit, public health/metadata and authenticated visible version
  independently verified before the verified-image registration marker.
- Root job `/home/bela/payroll-release-12111.log` ended `RELEASE_EXIT=0`;
  portal-app healthy; current and prior verified 1.21.10/1.21.9 images retained.
- Saved payroll/configuration hashes, server.env and mounts matched;
  current-day record IDs retained. No schema change, migration, manual payroll
  database edit or 1C write. Existing server `.rollback/` was left untouched.
- Approved storage maintenance retained 20 GiB free after release.

The subsequently reported November attendance refresh failure is a separate
approved local correction, absent from this release. An inactive employee must
retain historical evidence but must not require new empty-month attendance.
Private financial evidence remains in ignored `.wip/` and local `/tmp` files.
