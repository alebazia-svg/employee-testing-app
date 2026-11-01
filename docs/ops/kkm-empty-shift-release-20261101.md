# Cash closure recovery — 1.20.6, 2026-11-01

Owner approved implementation and then release with preservation of existing
behavior. Runtime commit: `4432efee8957be2afb23d1926a0f2f1d57e8e48d`.
Feature commit: `909196d55ec1aab4cf943a6eae0a5c279cc303ec`.
Both public origins and authenticated ADMIN showed 1.20.6, built
`2026-11-01T10:07:48.024Z` (13:07 MSK). Container healthy; public health OK.

## Approved behavior

Normal closure remains automatic. Complete cashier receipt identity keeps
priority. When it is absent, reuse actual workday, dated manual assignment,
explicit home KKM or the existing retail home/replacement workplace policy and
effective TerminalFiscalMapping. Conflicting/unknown equipment stays unconfirmed.
An empty physical KKT can be confirmed by one exact OFD report for that KKT and
the fiscal shift number. A closed 1C document is not a prerequisite when OFD
proves closure. Existing fiscal chronology/FN guards still protect reopened
shifts; partial conflicting device identities must not be combined.

The existing minute HTTP runner now warms OFD closure sources for current retail
workdays. Only complete, nonempty exact-device reports are cached (75 seconds);
newer fiscal evidence invalidates an older closure. Prefetch does not create tasks
or photo requests. On-demand fast failures get one bounded retry. Photo and
not-printed responses, automatic rechecks and ADMIN escalation remain available.
First saved check evidence is retained going forward; earlier overwritten source
errors cannot be reconstructed by this change. No employee UI was replaced.

## Production verification

- Completed Milana day 142 / handover 574 was unavailable because no cashier
  receipts identified her KKT on 1 November. The existing home workplace rule
  resolves KKT 0010475338013250 without a new manual assignment.
- The scheduled runner confirmed OFD shift 82; owner issue 107042 automatically
  resolved at 10:15:01 UTC. ADMIN shows closure confirmed, the original photo,
  cash 8,602 and reserve 200,000. Owner attention no longer includes this issue.
- The before/after SHA256 of all handover JSON except kkmCloseCheck is identical:
  `f76f5c0cd374b18aa1fbbf442b5434c2ad940290b31fd313801b6f6d970215b0`.
  Day status/end remains completed / `2026-11-01T08:00:56.985Z`.
- All eight recorded retail closure issues for 28 October–1 November are resolved;
  the seven previously resolved cases retained their state and timestamps.
- Owner explicitly requested archiving the 112,000 operation of 30 October,
  16:17 MSK. The existing archive-unresolved UI action was used before release.
  Its actual financial mismatch remains in history as uncorrected; notifications
  for that archived operation are disabled. New operations remain controlled.
- No application schema/migration, environment, 1C command or upload changes.
  Production data was not repaired manually; closure recovery used normal code.

## Validation

256 workday tests passed; fiscal suites 277 passed and one environment-gated
test skipped; four isolated PostgreSQL closure scenarios passed; five release
metadata checks passed. Type check and production build passed after integration
with the existing 1.20.5 tax/payroll baseline. Actual isolated PWA handover with
no receipts completed without a photo; actual authenticated production ADMIN
checked in mobile and desktop layouts. Physical employee-phone push display
and a new live employee handover were not tested.

## Deployment and rollback reserves

Preflight stopped before replacing the app: registry still referred to missing
1.20.4 image `797678d4…`, while running 1.20.5 was not registered. Rebuilt the
exact 1.20.4 source `8cd33ddea14071d59e4cb3cf0b02f4b415582d5e`, validated
metadata/login in an isolated networkless server, retained a copy of the original
registry and replaced only that missing version's image identity. The isolated
test ran Next directly; it had no production DB or migrations.

An SSH disconnect interrupted the first 1.20.6 image build before restart;
public version remained 1.20.5. Retry of the same release ran in the transient
`mobo-kkm-release-1206` server unit. Existing approved storage maintenance freed
unused cache before retry; no containers, uploads or volumes were pruned.

After independent commit/public/authenticated-UI verification and lock release,
the standard register-verified command completed. Final protected images:

- 1.20.6: `sha256:a7972b5150790124b63f054b69da5a643c89eda936ad7625a7d0dea72ef1ea2e`
- 1.20.5: `sha256:c10538c221d9972e5648f58dbaeb77fada41be786b45daae85406037d51311de`
- restored 1.20.4: `sha256:9820aa583c7cfcfcf9e07852f9c2dbae9b087f5900dad66678e7edd38c489117`

Deployment exit 0. Free disk after verification: approximately 21 GiB. Uploads
remain mounted as offonika-portal_portal-uploads. Server's pre-existing
untracked .rollback/ and local output/cache materials were not committed.
