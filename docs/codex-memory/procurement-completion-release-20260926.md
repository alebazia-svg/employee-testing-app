# Procurement completion release — 2026-09-26

## Deployed scope

Explicit owner operations approval: commit and deploy the approved ADMIN residual
completion action and exact RKO/order settlement linking. Application release:
`70bc8e6385a61542347ee2298a73a53eb4487aca`, built from
`origin/design-local-updates`, VPS `/docker/employee-testing-app`.

Code commits: `b2f7506` (feature), `7fa6de5` (31-calendar-day evidence windows),
`70bc8e6` (inactive-order isolation). Only portal-app rebuilt/restarted.
No schema changes, pending migrations, 1C writes, manual request completion,
new checkout, or unrelated dirty files included.

## Behavior and changed files

- `lib/procurement-payment-completion.ts`,
  `lib/procurement-payment-completion-server.ts`,
  `app/api/admin/procurement/payment-plans/[id]/completion/route.ts`,
  `components/ProcurementCompletionAction.tsx`: ADMIN-only reversible completion
  of confirmed partial requests, reason required, fresh evidence, quote/version
  checks, advisory lock, audit event. Original request amount and 1C debt unchanged.
- `lib/procurement-settlement-payment-link.ts`,
  `lib/procurement-currency-payment-source.ts`: exact full RUB RKO settlement
  movement may supply a missing header basis. No fuzzy or split allocation.
  Complete/fresh evidence required; inactive orders remain unlinked without
  stopping unrelated reconciliation. Unknown flags still fail closed.
- Calendar pages/clients, history components, payment-link and revision paths,
  payment evidence/control, cash forecast and USDT reservations now honor
  `COMPLETED_WITHOUT_TOPUP` and preserve ownership of previously allocated RKOs.
- Regression coverage: completion, source contract, payment history, buyer
  hardening, and PostgreSQL completion integration tests.

## Verification and observed result

- 234 unit tests + 28 SSR tests passed; four isolated PostgreSQL integration
  tests passed (completion, payment link, revision, basis change).
  React SSR tests run without `--conditions=react-server`; server tests use it.
- TypeScript, diff check, and exact committed VPS production build passed.
- Read-only fresh reconciliation of all 10 production requests before and after
  restart passed: two partial, seven paid/issued, one without evidence.
- Authenticated production ADMIN browser verified Galida order 407 (67,500 RUB)
  and lamps/tripods order 411 (74,900 RUB versus 74,871 requested) in paid history,
  no longer offered for manual matching.
- Actual completion dialogs verified Baseus residual 142 RUB and Glass residual
  115 RUB, empty-reason disabled confirmation and working Cancel. No production
  completion POST issued. Complete/reopen writes tested only in isolated DB/demo.
- Container healthy; HTTPS health 200; new endpoint without session 401.
  Uploads and procurement-planning snapshot volume mounts retained.
- Rollback image retained as `offonika-procurement-rollback:20260926-pre-70bc8e6`;
  previous application commit `6467be16031e7e1ec72934b1d4cca1981fab5675`.

## Remaining boundaries

Financial-summary/refresh WIP and earlier uncommitted advance-review UI remain
local and excluded. No claim that broader financial recommendations are complete.
No authenticated buyer session exercised after deploy; actual buyer component
active/history behavior covered by SSR tests. Production completion/reopening
remains an owner action, not a smoke-test mutation.

Procurement evidence progress 54.8 → 54.8; no item IDs/stages changed. Autonomous
orders, 1C writes, supplier contact, scheduling and spending remain disabled.
Next operational step: owner may use «Завершить без доплаты» for an agreed residual;
it archives the request in both calendars without writing off debt in 1C.
