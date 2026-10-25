# Receipt reminder candidate — 2026-10-26

Status: local candidate; not deployed. Owner approved 30-minute reminders and a
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
source-failure handover test, TypeScript and production build. Release still
requires current branch/live-version reconciliation and separate owner approval.
