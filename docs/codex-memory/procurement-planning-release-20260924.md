# Procurement planning release — 2026-09-24

## Approved and deployed scope

Owner explicitly approved commit and deployment after the local review and
production AIAgentAPI 418 read-only smoke. Code commit:
`e8414cc99186bfe415706c380303ae9296e8240a`, based on production
`0ef699b21d165453e0ad6e9fc2221c3bbbf7c20d`. Pushed to
`origin/design-local-updates`. The newer unrelated production changes were
preserved. No 1C financial writes, manual production DB changes or new migrations.

Working-order selection now uses a private background settlement snapshot.
Receipt/payment evidence and supplier reconciliation govern payment eligibility;
the 1C order status alone does not establish that payment is complete. Ambiguous
orders remain under review and cannot become an invented payable amount. Small
balances up to 500 RUB are hidden from actionable orders, not written off in 1C.
Selected orders are freshly verified before submission and overlapping active
requests are guarded against. Settled history does not require loading the full
order archive on every page visit.

## Runtime

- Compose sets `PROCUREMENT_PLANNING_MODE=snapshot` and mounts the private cache.
- `offonika-procurement-planning-sync.timer` is installed and enabled on the VPS.
- It runs three minutes after the previous job completes; this is not a promise
  that a slow source completes a refresh every three minutes.
- First production snapshot is prepared before switching containers. Incomplete
  initial collection aborts deployment; later failed refreshes preserve the
  previous snapshot. Old data does not grant new payment eligibility indefinitely.
- No snapshot contents or credentials are committed.

## Verification actually obtained

- Clean release worktree: 49 focused tests, TypeScript check and production build
  passed; `git diff --check` passed.
- Remote HEAD verified as the code commit above after deployment.
- Deployment process finished and status file appeared at 13:50:14 UTC.
- Timer is active and enabled. Its first service run started 13:50:14 UTC and
  finished 13:50:17 UTC, `Result=success`, `ExecMainStatus=0`.
- Next scheduled run was 13:53:17 UTC.
- Public `/api/health` returned `{"ok":true}` after deployment.
- Authenticated production admin calendar opened successfully. Existing Remax
  and Kurban completed requests remain in payment history. No financial request
  was submitted, approved, cancelled or edited during this production smoke.

Limitations: the external Terminal UI was unavailable to Computer Use. Root-only
deploy log/status contents and Docker socket could not be read through the
unprivileged SSH account. Service status and authenticated page verification
were read independently; the raw `DEPLOY_EXIT` line was requested from the owner.
Do not claim a production Astemir end-to-end submission: the available production
browser session is admin. Employee submission and error states were checked
locally against the isolated test database before release.

## Explicitly unfinished / not bundled

Admin forecast changes in the original dirty worktree were NOT included. The
production admin screen still reports missing cash/payroll inputs and contains
the old “Расчёт уточняется” wording. This release does not certify the complete
30-day financial forecast or reconcile all historical supplier discrepancies.
Do not mix that next task with order snapshot deployment or silently stage the
original worktree's unrelated files.

## Recovery and worktrees

VPS release launcher: `/tmp/procurement-release-e8414cc.sh`. Prior container image
was tagged `offonika-portal-app:rollback-e8414cc`; rollback compose override:
`/tmp/procurement-rollback-e8414cc.yml`. Do not delete the persistent cache volume
or user data for rollback. Follow the VPS runbook and obtain any new operational
authority needed for another release.

Clean release worktree:
`/Users/bela/Projects/offonika-procurement-release-20260924`.
Original local worktree with preserved unrelated changes:
`/Users/bela/Projects/offonika-procurement-ui-only-20260921`.
Original feature commit there is `a1912d5`; the deployed cherry-pick is `e8414cc`.
