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

## Owner correction after production review (local, not yet deployed)

Latest explicit owner decision supersedes earlier settled/small/review filters:
all posted, nondeleted own orders in the last 90 Moscow calendar days are
available for linking requests, regardless of status or balance. Refinement of
unnecessary orders is deferred. Today plus 89 prior days, no future documents.
Active-request duplicate and manager/supplier ownership protection remain.
Amounts are entered by purchaser and are not required to match a disputed
order remainder. Extra explanation is optional. ADMIN retains the warning for
unverified debt; no payment approval or 1C financial write is automated.

`fetchRequestOrderCatalogue` is isolated from the financial snapshot used by
ADMIN forecasts. It requires the explicit complete `supplier-request-catalogue-v1`
contract on existing `/supplier-order-finance-control?catalogue_days=90&limit=1000`;
production 418 DOES NOT implement that mode. Do not deploy portal ahead of 1C.
Old API responses fail explicitly rather than silently returning five orders.
Identity is refreshed at submission without all-supplier reconciliation.

One selector, no history/review tabs; descending individual confirmed remainder,
unverified rows afterwards, search by 1–3 digit suffix or supplier/full number.
Paid request history remains; useless settled-order history section removed.
Supplier debt choices still require >500 RUB; that threshold does NOT filter
orders. All-history background financial collection is unchanged.
Production owner uses Edge at `https://team.mobo-opt.ru/procurement`; do not
confuse it with the isolated local page or assume another host is identical.

Local request/date/search tests and production build passed. No production
requests were sent. Pending: install test candidate, run focused API smoke,
publish/install numbered production package, then portal deployment and actual
Astemir catalogue count. Candidate lives in ai-business-os:
`.wip/supplier-request-catalogue/AIAgentAPI-test-supplier-request-catalogue-2026-09-24.zip`.
Builder and focused checker: `tools/build_supplier_request_catalogue.py` and
`tools/check_supplier_request_catalogue_live.py`. Candidate changes only existing
finance GET handler; date constraint in query, closed orders retained, explicit
completeness/count, no metadata/roles/new endpoints or document writes.
Existing unrelated WIP was preserved.

### Catalogue test installation verified

Owner installed the test candidate. Focused live GET passed: window
2026-06-27 through 2026-09-24, 83 total orders, 60 closed, 57 belonging to
Astemir; all 23 recent legacy orders are present. These are TEST counts, not
production counts. The checker now accepts the Russian document-date format
returned by 1C. Production candidate package is
`AIAgentAPI-v0.15.419-supplier-request-catalogue-2026-09-24.zip`; production 1C
was still 418 before publication. Portal deployment must wait for confirmed
production 419 installation and a fresh complete catalogue read.

### Production catalogue deployment completed

Production /version confirmed 419. Direct read parsed by the portal consumer:
2026-06-27..2026-09-24, 127 total orders, 88 Astemir orders, 70 of those closed;
complete=true. Active requests still prevent a duplicate new request, so the
picker's available count can be lower than 88.

Code commit `547e5573807fe0d147f8004ddcae8543838a3685` pushed and deployed.
Visible-Terminal sudo workflow completed with exit 0. Before activation the
new image successfully read the complete catalogue using its production env;
health and existing sync timer were checked by the deploy script. No migrations,
financial writes or production test requests. Rollback image:
`offonika-portal-app:rollback-547e557`; override
`/tmp/procurement-rollback-547e557.yml`. Previous code: e8414cc.
Production Edge interaction timed out, so post-deploy visual confirmation is
not claimed. Local actual component was exercised before deployment.
