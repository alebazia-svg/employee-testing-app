# Procurement day totals — 2026-11-04

Owner-approved scope: extend the existing admin calendar with date groups and RUB preparation amounts; preserve existing request actions, tabs, receipts and closure rules.

Release: 1.21.26, commit ac781b9f3867eaafd3ad439969ca7e85cfe0e206, based on origin/design-local-updates 512f1ac (live 1.21.25). No migration or 1C write.

Changed runtime files:
- app/(dashboard)/admin/procurement/AdminProcurementClient.tsx
- components/ProcurementAdminList.tsx
- components/ProcurementPreparationList.tsx
- components/procurement-preparation-list.css
- lib/procurement-day-preparation.ts
- package.json
- package-lock.json

Tests: procurement-day-preparation.test.ts, procurement-preparation-list.test.tsx, procurement-usdt-ruble-funding.test.ts. Relevant regression suite 56 + wrapper 8 + release metadata 5 tests passed. Local typecheck/build and production Docker build passed. Refreshed local Prisma client after rebasing to the current deployed schema; no production migration.

Totals use all active submitted/approved requests for the day, independently of selected tab. Cash and bank routes remain separate. No redundant subtotal for a single visible request. Search suppresses subtotal to avoid implying a filtered total. Existing all-or-nothing USDT wallet allocation is retained; no new partial currency/cash funding workflow. Unknown/stale evidence is shown as unknown, not zero. This projection does not match expense documents, change statuses, approve, pay, or close requests.

Production UI after fresh 1C reconciliation at 23:17:26 MSK: 5 November cash estimate 438845.80 RUB = Lucy 155339.80 + SupGlass 99036 + Cargo Yura 184470. Cargo dialog retained Edit, Defer, requisites and receipts. Version label 1.21.26, public build time 2026-11-04T20:10:58.586Z; public health OK. Public metadata revision is unknown because Docker excludes Git; server checkout independently matches the release commit.

Production mutations were not submitted as smoke tests. Local preview route and grouping fixture remain untracked and were not deployed. Unrelated worktrees/files untouched.

Initial foreground deployment process disappeared before restart; live version remained 1.21.25. First background retry never started. A root-owned nohup launcher then completed the same exact release. Do not claim the cause of the initial interruption is proven.

Post-release verification script independently checked the running image against sha256:062b9cc28515a980f777c879b87e676c8eee1b046f247caf3621f80857152e73 and exact server commit/public version, then successfully registered the verified image using portal-storage-maintenance outside the deployment lock.
