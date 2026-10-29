# Procurement mobile cabinet — release 1.19.3

Owner approved release of the visually accepted candidate, preserving the desktop
calendar, financial behavior and 1C integration. Owner separately approved reserve
recovery on 2026-10-29 before continuing the release.

## Release identity and checks

- Application version: 1.19.3.
- Code commit: `2c1d4961e1eb7fed8ce3a87dcd73092d2243e06a`.
- Previous production: 1.19.2, `4b174eb7abcfec3fc05c7dc4583bd98fcb0e3438`.
- Exact changed source files and local acceptance evidence:
  [candidate report](../codex-memory/procurement-final-candidate-20261029.md).
  Package version fields were subsequently aligned at 1.19.3.
- Before release: 74 policy/contracts, six SSR UI tests and five release metadata
  tests passed; TypeScript and production build passed. Candidate end-to-end
  evidence uses isolated local data and TEST 1C only, as described in the report.
- No changes to `lib/one-c.ts`, procurement API routes, Prisma schema/migrations,
  compose configuration or production environment. Desktop shell branch preserved.
- Local harness, uploads, credentials, node_modules links and experimental HTTP
  retries excluded from the code commit.

## Approved reserve recovery

The first deploy preflight stopped before checkout/build/restart: registered image
`sha256:5c2145cb117221f0a377ad591e066047ac607ae7e4bbde394f49259053dfe714`
was missing, and current 1.19.2 was not registered. Cause not established.

Rebuilt unchanged released source 1.18.27,
`dcee4abb9682a17053b1d7cd5b380eb635d92402`, from git archive in a separate
build directory, receipts flag enabled. This is a rebuilt reserve, not the missing
byte-identical artifact. Build timestamp: `2026-10-29T19:38:49.761Z`.
OCI revision/version labels identify the source.

- Rebuilt reserve image:
  `sha256:6cf6c3566b6bc959800e7a7e512c56057fa7e48a01d716b9aa4c36a5a2a712f1`,
  tag `portal-app:rollback-before-1.19.0`.
- Original verified 1.18.26 reserve retained:
  `sha256:d1b6036dea129e422f56fbfbed0a4e93cde4521379efdd66f861b2f3d0f65e6d`.
- Current 1.19.2 image independently checked:
  `sha256:9f82f5a5a5e4113a639a0f5d39d48dac6df10794f6f67a29c0116506469ffb9e`.
- Build and type checks passed. Reserve ran on an internal-only Docker network
  with disposable tmpfs PostgreSQL and generated temporary credentials, no
  production mounts, credentials or 1C access. Current schema was pushed only
  to that disposable database. Health/release/login, employee/admin login
  redirects and both unauthenticated API 401 checks passed.
- Temporary containers, internal network and credential files removed. No
  production restart or migration during reserve recovery. Source schema and
  migrations match the pre-release production revision.
- Registry backed up at
  `/var/lib/offonika-maintenance/verified-images.before-procurement-recovery-20261029.json`.
  Registered current 1.19.2 plus rebuilt 1.18.27 and original 1.18.26. Normal
  registration and maintenance dry run passed; 15.94 GiB free before new build.
- No pruning or broad cleanup performed during recovery. All operations serialized
  with `/run/lock/offonika-portal-storage.lock`; lock released before registration.

## Production outcome

Released successfully on 2026-10-29. Only portal-app was built/recreated.

- Independent SSH checkout: `2c1d4961e1eb7fed8ce3a87dcd73092d2243e06a`.
- Running image:
  `sha256:537f1682cf5c083b6bf59cf4a02413891dd0b143bd7506076b89d649076d1ff9`.
- Container:
  `e7e00b45991c8282d1d1761d3ffbfb9d7ab4dfa29f3b33fe0b4bccff6d878423`, healthy.
- Public `/api/health`: 200, `{ok:true}`. Public release metadata: 1.19.3,
  built `2026-10-29T19:45:46.994Z`. Metadata revision is null/source unknown
  because the existing Docker build excludes .git; independent server checkout
  and image identity are recorded above instead of inventing a metadata revision.
- Authenticated employee preview footer visibly reports 1.19.3, 29.10.2026
  22:45 MSK. Desktop before/after screenshots preserve layout and the same seven
  requests; normal transient refresh state changed after reads completed.
- Mobile preview at 390x844: payments, topup form open/cancel, history list and
  detail with actual order/RKO link, missing-receipt dialog, new payment form
  open/cancel and unified notification center checked without submitting.
  Browser read-only preview explicitly disables saving. No receipt uploaded or
  real financial request sent. Document scroll width 375 at viewport 390,
  no horizontal overflow. Temporary viewport override reset afterwards.
- Before and after restart: 78 existing migrations, database schema up to date.
  No new migration was added or applied by this release.
- Current 1.19.3 registered after independent public/UI checks and after releasing
  deployment flock. Registry now holds 1.19.3 plus verified 1.19.2 and rebuilt
  1.18.27. All three image identities checked again.
- Post-build maintenance dry run initially found 14.62 GiB free. Under the
  existing owner-approved build-cache retention policy, removed only unused
  build cache (`docker buildx prune --all --force --max-used-space 5GB
  --min-free-space 15GB`), reclaimed 4.205 GB. No images, containers, volumes,
  uploads or application data pruned. Final dry run passed, 18.25 GiB free;
  storage verification command exit 0.
- Production tracked files clean; pre-existing untracked `.rollback/` preserved.
  Local demo files and original dirty worktree remain untouched.
- Local operation logs: `/tmp/mobo-reserve-and-release-1.19.3.log` and
  `/tmp/mobo-release-storage-check-1.19.3.log`.
- Screenshots: `/tmp/mobo-desktop-before-1.19.3.png`,
  `/tmp/mobo-desktop-after-1.19.3.png`, and
  `/Users/bela/.codex/visualizations/2026/10/26/01a17a42-c4f9-76c3-a778-25efa747a27a/released-mobile-1.19.3.png`.

Account settings are unchanged: Astemir remains in Operations with PROCUREMENT
access; Diana remains disabled in Retail; Muhamed was not created. Workday
activation for these accounts is separate from deploying the approved code. Do
not silently alter these records under an instruction to preserve production data.

Physical phone camera, push delivery, system keyboard and safe-area behavior were
not newly tested on a real phone. Existing camera mechanism is reused; local
workday/QR policy checks are recorded in the candidate report. No guarantee of
permanent resolution of historical 1C network stalls.
