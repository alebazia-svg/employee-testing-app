# Mandatory release capability guard — 12 November 2026

Owner approved making preservation checks apply to every future release.
Code `e3efeb2`, branch `codex/release-capability-guard-20261112`.
Status: **installed and independently verified at 11:16 Moscow on 12 November**.
No application release, version bump, restart, migration, production business
write or notification change. Production remains 1.24.11 / `6a8f577`.

## Scope and established workflow

The current production app is 1.24.11 / `6a8f577`. The existing preparer exports
one committed source and builds outside the VPS; the pinned root-owned session
validates source/version/capacity/archive, loads, recreates only portal-app,
checks health/env/mount/DB identity and waits for independent review. Registration
remains separate and verifies current plus two reserves. These boundaries remain.

The missed regression happened before startup: a compiled-out receipt component
did not mount or make a failed request. The general health endpoint checked only
`SELECT 1`. Runner ENV inspection could not recover the builder's public flag.
Current source inventory has one public feature argument (receipts) and four
public release-metadata values. Existing runtime configuration is protected by
the installer's full env/mount snapshot and compatible-source restrictions.

## New mandatory boundaries

- Trusted policy derives receipt build argument `1`, checks the committed Compose
  value and declared Docker/public-source flags. A manual `0` or an unregistered
  feature argument is rejected before building.
- The real built image is read in a network-none, read-only, capability-dropped,
  bounded Node process. The receipt loader/read endpoint must exist. The manifest
  pins the actual capability result, app-page/API and public-file inventories.
- The host independently reads the running artifact and the loaded candidate
  before retagging/recreation. False/incomplete reports or disappeared existing
  routes/files stop installation. New entries are allowed. An already broken
  baseline can be repaired; required candidate capabilities remain enforced.
- Recheck the actual running report after restart (failure invokes the existing
  rollback) and after independent review (failure refuses registration).
- Preserve source/schema/capacity/env/mount/DB/rollback protections; expand public
  route status checks to all main ADMIN destinations and employee/login.
- No force/skip exception. Old bundles without evidence must be prepared again;
  intentional removal/disablement needs a separately approved trusted policy.

## Evidence and limits

- 43 tests passed, including two real local Docker tests: committed-source build
  with automatic approved flag/dirty-source exclusion and actual recreation plus
  rollback after injected HTTP 502. Forty-one unit cases cover existing guards,
  disabled/new flags, missing/forged capability reports, disappearing routes and
  assets, post-start mismatch/rollback and post-review refusal to register.
- First prepare-fixture run exposed a missing empty directory in its Git archive;
  the fixture now creates that directory in the build. The corrected prepare and
  full 43-test run passed. No production failure was inferred from that fixture.
- Real exact existing images, not fixtures: 1.24.8 is rejected because its compiled
  receipt loader is absent; 1.24.11 passes. Both contain 187 page/API entries and
  275 public files. Probe results are read-only and do not execute application
  startup or contact 1C/database. Ten current public route checks passed.
- Python compilation, `git diff --check`, final unit rerun passed. No app
  TypeScript/build rerun is required for this Python-only host tooling change;
  the Docker tests exercise the new preparation/install boundaries directly.
- Presence of a route/file/loader does not establish that every business action,
  calculation, permission, notification or 1C relation is correct. Actual changed
  workflows still need their representative transaction/cancel/retry tests and
  real ADMIN/employee acceptance. There is no universal semantic bug guarantee.
- No new runtime synthetic monitor, automatic incident notification or changes
  to existing System/attention/push policy are included.

## Separate retention-policy finding; unchanged in this scope

A pure local replay against the byte-identical installed maintenance script
(`051a48946b6ee340fa3fc90231115e8fd3582066ae6001305ea9bfe2a353bf2f`)
confirmed that an unused image carrying the new standard
`offonika-portal-release:<version>-<commit>` tag remains excluded even after it
leaves the three protected images. The legacy rollback-only equivalent is
eligible. This is established policy behavior, not an observed new outage or
evidence that any protected/test data may be deleted. Capacity gates still stop
an unsafe release. Review this separately before broadening cleanup eligibility;
preserve all container-used images, current plus two verified reserves and
unknown/debug artifacts. No maintenance code, cleanup, retention limit or timer
was changed by the capability guard.

## Files

- `ops/release/portal_release_contract.py`
- `ops/release/portal_release.py`
- `ops/release/portal_release_session.py`
- `ops/release/test_release_contract.py`
- `ops/release/test_portal_release.py`
- `ops/release/test_portal_release_session.py`
- `ops/release/test_docker_release.py`
- `ops/release/README.md`, `AGENTS.md`, this verification note

## Installed default host guard

- Entry point `/usr/local/sbin/portal-release` now targets the immutable root-owned
  `/usr/local/lib/offonika-release/releases/e3efeb2/`. Both old installed source
  modules were byte-identical to the candidate's base before applying this change.
- Before activation, all seven pinned source/test hashes were checked, the 41
  non-Docker unit checks passed on the VPS, the actual running 1.24.11 artifact
  passed, and the actual reserve 1.24.8 artifact was rejected for its absent loader.
  No active release worker was interrupted; activation held the existing lock.
- Before/after equality preserved the app and DB container identities, images,
  start times/restart counts, source HEAD, metadata, sorted env/mount hashes,
  image/volume inventories, registry (current plus two reserves), maintenance
  binary and storage timer. There was no application recreation or cleanup.
- Ordinary SSH independently compared all seven installed source hashes and the
  default entry hash with reviewed local bytes. The actual default CLI rejected
  a clearly isolated legacy-manifest fixture without `--apply`, before archive
  loading or any application action. The external verification initially looked
  for the diagnostic on stdout; the tool correctly uses stderr. Checking both
  streams confirmed the expected safe rejection; no tool correction was needed.
- Public metadata on both origins and server HEAD remained exactly 1.24.11 /
  `6a8f57753998a1ed8974706111367b0f8036e6ac`, build
  `2026-11-12T06:15:24.929Z`; public health returned `ok:true`.
- Entry SHA-256:
  `26a25266db08025cc2ae839796bd4b4249c1d271f3a77be1a0fb6c34fc08552f`.
  The old entry is retained under
  `/var/lib/offonika-maintenance/tooling-backups/20261112-e3efeb2/` together with
  before/after hashes and server unit-check output. Old immutable tool versions
  remain available for an explicitly approved tooling rollback.
- Owner-readable activation evidence:
  `/home/bela/portal-release-capability-e3efeb2-result.json` and
  `/home/bela/portal-release-capability-e3efeb2-install.log`.
  No secret values or business rows are included in this repository evidence.
