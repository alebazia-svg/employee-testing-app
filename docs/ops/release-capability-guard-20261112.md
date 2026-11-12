# Mandatory release capability guard — 12 November 2026

Owner approved making preservation checks apply to every future release.
Code `e3efeb2`, branch `codex/release-capability-guard-20261112`.
Status: locally verified; host installation pending. No application release,
version bump, restart, migration, production write or notification change.

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

## Files

- `ops/release/portal_release_contract.py`
- `ops/release/portal_release.py`
- `ops/release/portal_release_session.py`
- `ops/release/test_release_contract.py`
- `ops/release/test_portal_release.py`
- `ops/release/test_portal_release_session.py`
- `ops/release/test_docker_release.py`
- `ops/release/README.md`, `AGENTS.md`, this verification note
