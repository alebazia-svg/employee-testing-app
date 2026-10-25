# Receipt reminder release — 2026-10-26

Status: released to production as 1.18.1. Owner approved 30-minute reminders and a
fresh read at handover. Explicit follow-up: missing receipts must NOT block
finishing a shift. No production env/database/1C changes in this task.

- Before 30 minutes, evaluate silently. Sources must be complete, the payment
  uncovered, and actual app shifts plus workstation mapping must identify one
  active employee safely. Ambiguous attribution, split sales, possible OFD
  receipts and technical failures remain ADMIN-only.
- One initial reminder per payment/recipient. No hourly repeat. Existing PWA
  compact attention list is reused; a review stays visible until reconciliation.
- Handover and ordinary finish read acquiring/1C/OFD up to now (not the background
  polling cutoff). For the finishing employee's safe attribution only, the
  30-minute wait is bypassed. Source failure never blocks completion.
- After successful completion, remaining open employee reviews generate an
  idempotent ADMIN inbox event linked to the same review. Subsequent polling
  must not retire that employee review just because the shift has ended or
  create a second ADMIN-first event. Later matching resolves the shared review.
- Document date, fiscal register time, OFD receipt time and first observation
  are distinct facts. Document/payment difference is not fiscalization latency.
  Hardware clock alignment and physical push delivery are not verified here.
- Report amount coverage accepts the new OFD-candidate review state only under
  the existing complete fiscal coverage safeguards. Cached reports carry the
  matching algorithm version; old caches are recalculated, not trusted as current.

Validation: policy tests, isolated PostgreSQL lifecycle (including 29:59/30:00,
recent-payment handover, deduplication, completed-day escalation and late check),
source-failure handover test, TypeScript and production build. Owner approved release after reviewing the short PWA wording. The release was
reconciled with the parallel cashbox-routing release 1.18.0 before deployment.


## Verified production release

- Target: https://team.mobo-opt.ru, portal-app only.
- Runtime commit: `9b944cdf788c5d68894c0234541ba74537c5a07e`.
- Version: 1.18.1; built 2026-10-26 01:16 MSK
  (`2026-10-25T22:16:39.847Z`).
- Previous runtime: 1.18.0, `1e2c67b4ea1a0b4b9b0e06474138476349f0e5eb`.
- Previous image: `sha256:b3a365c8c1fefe108c77b1dfc47fe38db3c147bc4afb5388598f38b36f7c1c81`.
- Replacement image: `sha256:a39a49a9bcdd44182528950bbe1f7927897b97e41859ba27f1ea8afefcc7b0b7`.
- Rollback: previous image retained as `portal-app:rollback-before-1.18.1`;
  no schema/migration/Docker/compose changes. Verified registry contains the
  new current image plus the two preceding verified images.
- Server commit, healthy container, public release metadata/API health and
  authenticated ADMIN footer/control-day rendering independently verified.
  Release script exit 0; env checksum and mounts remained unchanged.
- Tests after merging: fiscal suite 204 pass / 1 optional live-fixture skip,
  chain UI 2 pass, cache/handover 2 pass, attention/expense/fiscal views 25 pass,
  release/UI contract 7 pass, isolated PostgreSQL lifecycle 11 pass.
  TypeScript, build and diff checks passed.
- Actual new phone push receipt and a new real missing-check handover were not
  forced in production. No synthetic examples or manual data updates deployed.
- Final PWA wording: “Не найден чек в 1С”; amount and payment timestamp shown
  separately; “Если чек ещё не пробит — пробейте его в 1С.”

### Changed runtime and test files

- `app/api/employee/shift-control/tasks/[id]/route.ts`
- `app/api/employee/workday/finish/route.ts`
- `components/TerminalFiscalTransactionTable.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `lib/employee-attention-snapshot.ts`
- `lib/employee-attention.ts`
- `lib/fiscal-review-data.ts`
- `lib/terminal-fiscal-admin-gate.ts`
- `lib/terminal-fiscal-coverage-policy.ts`
- `lib/terminal-fiscal-employee-review-view.ts`
- `lib/terminal-fiscal-employee-review.ts`
- `lib/terminal-fiscal-handover.ts`
- `lib/terminal-fiscal-matching.ts`
- `lib/terminal-fiscal-report-cache.ts`
- `lib/terminal-fiscal-runner.ts`
- `lib/terminal-fiscal-sources.ts`
- `lib/terminal-fiscal-transaction-report.ts`
- `package-lock.json`
- `package.json`
- `tests/fiscal-review-data.test.ts`
- `tests/terminal-fiscal-admin-gate.test.ts`
- `tests/terminal-fiscal-daily-report.test.ts`
- `tests/terminal-fiscal-employee-review.test.ts`
- `tests/terminal-fiscal-handover.test.ts`
- `tests/terminal-fiscal-matching.test.ts`
- `tests/terminal-fiscal-one-c-adapter.test.ts`
- `tests/terminal-fiscal-persistence.integration.test.ts`
- `tests/terminal-fiscal-report-cache.test.ts`
