# Browser versions in the main device list — 10 November 2026

Status: released and independently verified **1.23.1 / 00b989a**, 10 November 2026.
Public build time **2026-11-10T16:23:48.284Z** (19:23:48 MSK).

Owner approved the actual local screen on 9 November and release on 10 November.
Scope: show the reported browser version next to its name in current employee
and administrator/check rows, with per-field provenance. Keep the reported OS
value and explicitly qualify unconfirmed OS versions. Portal version stays
separate. Assigned names, device groups, codes, history, collection and settings
are unchanged. No employee business UI or logic, schema, migration, compose,
notification or administrator action-audit changes.

## Isolated source exception explicitly approved by the owner

Live baseline was **1.22.7 /956006a0**. The deployment branch already contained
uninstalled warehouse-transfer work **9696749 /315710a**, package version 1.23.0,
including a migration. Owner explicitly authorised releasing only this feature
from the live baseline on a separate branch. Deployment source:
`origin/codex/access-browser-version-release-20261110`, runtime
**00b989ae8be9e21301fc9abf84a1f8cb482edc5a /1.23.1**.

The feature-only commit **c77258f** was also integrated into
`design-local-updates` without reverting or deploying the pending transfer work.
That branch's pending package1.23.0 is not the production truth: future releases
must use the maximum live/branch version and increment from live 1.23.1.

Exact production diff from956006a0:

- `components/PortalAccessDevices.tsx`
- `lib/portal-device-observation.ts`
- `tests/device-observation-ui.test.tsx`
- `package.json`
- `package-lock.json`

## Verification before installation

- Production build, TypeScript and whitespace checks passed on the live baseline.
- 66 focused UI/grouping/observation/server tests and 5 release-info tests passed.
  One existing PostgreSQL test was skipped because its dedicated fixture URL was
  not configured. Actual UI was tested against a separate synthetic PostgreSQL
  database, including details, history, service grouping and narrow/wide layouts.
- Existing local WIP, separate personal guide prototype, production environment,
  uploads and manual business records were not changed by the feature.

## Server preflight and verification evidence

Preflight found1.22.7 healthy but not registered. Its omission stopped the daily
storage job. The oldest registry entry8fc64d1... was missing; the other two
previously verified entries9e505019... and432332e6... were present. Independent
public metadata and authenticated1.22.7 UI checks preceded normal registration
of the current22c76a3... image. Normal registration retires the oldest entry and
retains the current image plus the two existing verified reserves; no arbitrary
reserve replacement or reduction in retention was used.

The first server build was stopped before installation. During compilation the
host reached load 192.54, available RAM 316 MiB and full 2 GiB swap. Both HTTPS and
SSH temporarily timed out. Stopping only the release systemd unit restored
responses (HTTP 200 in 0.22 s); the original 1.22.7 image remained healthy and its
source checkout was restored to 956006a0. This incident is not a successful
installation. Initial disk checks alone were insufficient; memory and bounded
build resources must also be checked for future releases on this shared host.
The original log is `/home/bela/mobo-browser-1.23.1-release.log`.

Recovery uses a locally built linux/amd64 artifact from the same clean runtime
commit. Only the temporary build-stage command adds NODE_OPTIONS heap 3072 MiB
and RAYON_NUM_THREADS=2; the final runtime environment is unchanged. Docker
actually enforced memory=swap=4294967296 and CPU affinity 0-1. No application
business code, Dockerfile or compose change is shipped for this build control.
The production server imported the artifact rather than compiling it.

The reviewed artifact installer uses the storage flock, verifies artifact
hash/architecture/version, the exact five-file source diff and no new/pending
migrations, captures configuration/upload/session fingerprints and waits for
independent verification before registering the image.

## Completed installation and final evidence

- linux/amd64 image:
  `sha256:06138424f68c027baed11d5f33d71ba18f6f74707c2504701cb3e6b5ebc1b9f3`.
  Transport archive SHA256:
  `0aac669abbdf8dcee05d890cc20c3deea2dab2337a95e4861d1e977ca8dd1043`.
- Artifact HTTP check against the isolated synthetic PostgreSQL DB passed:
  authentication, protected-route login redirect (including Next streaming
  redirect), actual reported Safari 27.0.1 / OS 18.7/source labels, separate portal
  version and retained Mac Бэлы / Codex / Claude groups. Build-only limits are absent
  from the final image's NODE_OPTIONS/RAYON environment. Test container removed.
- Actual authenticated production UI retained the existing account login.
  Main Milana row shows Safari 27.0.1 and browser provenance, retained OS 18.7
  with uncertainty, and separate last-reported portal 1.22.7/update-available.
  The shared footer shows the current release 1.23.1 and its build date.
  Details agree with the main list. Five existing service/computer cards and
  individual browser versions remain; Codex and Claude are separate.
- Read-only fingerprints before/after/final are equal: 10 user configurations
  (including QR mode/auth settings),11 browser owners/names/groups, 9 templates,
  5 cashbox mappings, 330 existing upload SHA256 values and 143 existing session
  identity/service/archive records. Database schema and applied migrations match;
  no pending migration. All 7 mounts, server.env hash and workday notification
  service/timer definitions match.
- The initial mount comparison stopped on JSON array order alone. A dedicated
  finalizer normalized by mount destination and verified full semantic equality;
  it did not rebuild or reinstall. Final comparison and registration succeeded.
- Server source is exactly 00b989ae8be9e21301fc9abf84a1f8cb482edc5a; running image
  matches the checked artifact and is healthy. Public metadata agrees. Six
  unauthenticated route checks completed without 5xx; these do not substitute for
  a manual business scenario in every department. Physical iPhone scanning was
  not changed or retested as part of this display-only release.
- Registry contains the new current 06138424..., previous 22c76a3... and preceding
  verified 9e505019... images; all 3 exist. Storage service Result=success,
  approximately 18 GiB free and 2.3 GiB available RAM at final verification.
  Warm public response checks after recovery returned HTTP 200 in 0.22–0.83 s;
  this is a spot check, not a sustained performance guarantee.
- Logs: `/home/bela/mobo-browser-1.23.1-artifact-install.log` and
  `/home/bela/mobo-browser-1.23.1-finalize.log`. Root-only comparison snapshots:
  `/root/mobo-browser-1.23.1-artifact-20261110/`. Finalizer ended
  `VERIFIED_RELEASE_COMPLETE /FINALIZE_EXIT=0`.

Other dirty worktrees and the personal-guide prototype were left untouched.
Documentation is separate from the five-file runtime release.
