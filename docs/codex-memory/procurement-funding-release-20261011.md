# Procurement funding plan — release handoff, 2026-10-11

## Approved scope

Owner approved committing and releasing the ADMIN funding plan. Runtime integration
is commit `49382d1` (initial release 1.1.17). This is a read-only planning aid:
manager cash selection, owner sources, payroll/rent reserves and dated bank limits.
No financial execution, 1C writes, schema migrations, manual payment linking,
notification changes or request-closing changes are part of this release.

The forecast uses existing payment reconciliation; it must not infer completion
from a missing row. Source failures retain a complete previous input/source pair
only within the mounted screen, visibly stale. Historical bank limits are dated
reference information, not confirmed current spending capacity.

## Release sequence

- 1.1.17 / `49382d1`: deployed and verified on the authenticated production screen.
- Concurrent 1.2.0 / `4facaea` and its handoff `bc9e20f` retained our funding plan.
  Merged without replacing the shared ADMIN header or expense work.
- `5753d4d`: bank reader timeout correction. Production read-only diagnostic found
  successful responses at 14.267s and 12.326s; the shorter general client timeout
  had interrupted them. Each of the two bank reads now has a bounded 20s timeout.
  No other 1C endpoint timeout or environment file changed.
- 1.2.1 / `131f69ae45413c9d002b43aed555698811e5dabf`: deployed successfully,
  remote command exit 0; independent SSH readback confirmed this exact commit.
  Both public domains report build `2026-10-11T18:48:05.315Z` / version 1.2.1.
  Authenticated Edge UI confirms 1.2.1 / 11.10.2026 21:48 MSK.

## Verification

- 53 focused funding/source/allocation/auth-loading tests and 73 payroll tests
  passed for the integration; TypeScript and clean archive production build passed.
- After merging 1.2.0: 11 source/integration/loading tests, TypeScript and five
  release metadata checks passed. Clean archive build produced its BUILD_ID.
- Isolated UI previously verified desktop and 390px layout, failed refresh,
  recovery and automatic inclusion of a new test request, without database writes.
- Unrelated local previews and the dirty ProcurementAdminList were not committed.
- Live funding screen loaded the dated bank limit, manager cash and owner sources.
  T-Bank shows 150,000 RUB as of October 10 and explicitly warns that later
  operations are not included. During auto-refresh the complete older snapshot
  remained visible with a stale notice; the notice cleared on successful refresh.
  This transient notice also appears during normal refresh, not just failure.
- Production screenshot is a private local artifact named
  `funding-production-1.2.1.png`, not committed business data.

## Separate production finding — unresolved

Production verification exposed old Baseus Jackson order 412 / RKO 001793 as
awaiting payment again. The funding release does not modify payment matching or
continuity modules. The actual cause has NOT yet been established. Do not infer
that this release caused it, or that it is fixed. No manual linking, closing,
exclusion or 1C modification was performed. Until resolved, the forecast consumes
that existing open state and can therefore include this disputed obligation.

## Governance

Procurement evidence progress remained 54.8/100; no item/stage or ledger change.
Autonomous procurement and 1C writes remain disabled. No package publication in
the separate AIAgentAPI repository was performed by this task.
