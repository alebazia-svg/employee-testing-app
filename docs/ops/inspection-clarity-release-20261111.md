# Employee inspection clarity — 11 November 2026

Status: **released and independently verified 1.23.4 / 6e31ef8**, 11 November 2026.

Owner approved the actual local interface and explicitly authorised publication,
preservation of data/settings and building on the Mac rather than the VPS.

## Exact approved behavior

- The real employee cabinet renders immediately while device evidence loads or
  is missing, stale or unsupported. The selected following mode remains enabled
  by default; no checkbox change is required to open the cabinet.
- A concise status/time remains visible. Device choices, full timestamp, follow
  checkbox and prior source/push explanations remain in native closed Details.
- Fresh evidence remains distinct from the last known signal. The reconstructed
  cabinet is not represented as a historical screenshot of the phone.
- The procurement iframe is not recreated on the first connection report; its
  URL still updates for the selected connection and following mode. Phone versus
  desktop presentation remains available.
- Preview expiration, actor-bound read resources and mutation restrictions are
  preserved. No employee business API, event collection, auth, QR mode, names,
  settings, database schema or migration changes.

## Source and version

Current production baseline was **1.23.3 / 916facf8**, including self-service shift
extension and the iOS header correction. The candidate was ported from its
previous 1.23.1 baseline without changing these newer production files.

Continue the previously approved isolated-source workflow: the same uninstalled
transfer work/migration in the deployment branch is excluded. Runtime source is
`origin/codex/inspection-clarity-release-20261110`, commit
**6e31ef8f5fc12066f12e93893d2f576466baf773**, version **1.23.4**. Feature-only
commit **b6dd499** is also in `design-local-updates`, preserving the pending work
and preventing a subsequent release from losing the approved inspection change.

Exact runtime diff from 916facf8:

- `components/EmployeeInspectionDevice.tsx`
- `components/EmployeePreviewProvider.tsx`
- `components/EmployeePreviewViewport.tsx`
- `tests/employee-inspection-view.test.tsx`
- `package.json`
- `package-lock.json`

## Verification before installation

- Production build, TypeScript, whitespace and release-info consistency passed.
- 24 automated tests passed: inspection view/source/read restrictions, release
  metadata and neighboring shift extension. Two existing integration tests with
  different disposable DB URLs were skipped.
- Actual local UI acceptance covered fresh/stale/missing screen evidence,
  checked following mode inside Details, disabled mutation controls, initial
  procurement phone/desktop loading and a narrow screen with no horizontal
  overflow. Snapshots of the synthetic employees' users, schedules, shifts,
  notices, subscriptions and device observations remained identical.
- The actual linux/amd64 image passed HTTP/PostgreSQL checks on the separate
  `inspection_clarity_review` database: authenticated employee and procurement
  cabinets render while device evidence loads; scoped device reads work; POST
  mutation is rejected with 405, unauthenticated read with 401; protected employee
  records are identical before/after. Test container removed.
- Built on Mac using two CPUs, 4 GiB memory/swap ceiling, build-only heap 3072 MiB
  and RAYON_NUM_THREADS=2. Build limits are absent from the final runtime env.
  No compilation is performed on the VPS.

Artifact image:
`sha256:6a0fe6b17d7020dbbe8755d7375fd092b5a03ee4a5806714ba66c49d1523b46e`.
Archive SHA256:
`d3d807b615b9b75345f487559b93d8fcc8029e5e6b22621aa3194638d5ecd9d4`.
Build timestamp: **2026-11-10T21:00:21.781Z** (11 November, 00:00:21 MSK).

## Capacity gate and exact cleanup approval

Initial free space was below 15 GiB. Existing bounded storage maintenance left
13.33 GiB; all three current/verified images existed. The owner explicitly
authorised removing only the unused obsolete 1.22.6 image, and retiring 1.23.1 only
after successful verification and registration of the new current release.
Their legacy tags were excluded from the automatic cleanup pattern; no broader
image/container/volume cleanup was authorised.

Reviewed cleanup helper checks the exact image ID, exact tag set, actual embedded
version, all current and stopped containers, and the three-entry verified registry
again immediately before non-forced tag/image removal. Existing QA containers
and their older images remain protected.

The artifact was streamed through permission0600 FIFOs with bounded buffers; no
complete archive was placed on the VPS disk or in RAM. SHA256 computed during
transfer matched the approved artifact before tagging or replacing the app.
The source diff contained exactly the six approved files; no new or pending
migrations. Parent storage flock was released before independent verification
and registration. No VPS compilation occurred.

Server worker: `/home/bela/mobo-inspection-1.23.4-install.sh`.
Log: `/home/bela/mobo-inspection-1.23.4-install.log`.
Comparison evidence: `/root/mobo-inspection-1.23.4-20261111/`.

## Completed production verification

- Exact server commit 6e31ef8f5fc12066f12e93893d2f576466baf773, healthy running
  image 6a0fe6b17d70... and public 1.23.4 metadata match the verified Mac artifact.
  `/api/health` returned `{"ok":true}`. The authenticated shared version label
  shows 1.23.4 and 11 November 00:00 MSK. The existing ADMIN login remained valid.
- Actual Milana inspection renders its cabinet with following mode still
  checked, even when no screen evidence is available. Details opens and retains
  device choices, the checked control, dated push facts and prior explanations;
  the main view remains compact when collapsed.
- Actual Astemir procurement inspection loads its phone iframe on first opening,
  and switches to the desktop calendar successfully. These were ADMIN read-only
  inspections; no employee shift, payment, guide acknowledgement or notification
  reading action was performed. Final production screenshot:
  `/tmp/inspection-clarity-production-1.23.4.png`.
- Before/after fingerprints match for 10 user configurations including auth/QR
  settings, 11 browser-owner/name/group records, 9 templates and 5 cashbox mappings.
  All 332 existing upload hashes and 149 existing session identity/service/archive
  records match. Existing IDs are retained: 168 workdays, 740 schedule entries,
  109 cash operations and 1,691 notifications. This proves retention of those rows,
  not byte-identical business values during legitimate ongoing employee work.
- Database schema/applied migration set, server.env hash, all mount descriptions
  (normalized by destination) and workday notification service/timer definitions
  match. No database migration or manual production data repair was performed.
- Six unauthenticated route smoke checks completed without 5xx (200 streaming
  login responses); these are not authenticated business tests for every section.
  Public response spot checks remained around 0.3–0.8 s during/after installation;
  this is not a sustained performance guarantee.
- Registered current image 6a0fe6b... plus verified reserves b57dc03... (1.23.3)
  and acbeccbf... (1.23.2) all exist. Only the explicitly approved unused images
  a3e24af.../1.22.6 and06138424.../1.23.1 were removed, the latter only after
  successful independent verification and registration. Running/stopped QA
  containers, volumes and their older images remain.
- Storage service Result=success; approximately 16 GiB free and 3 GiB available RAM.
  Worker ended `VERIFIED_RELEASE_COMPLETE`, `INSTALL_EXIT=0`, final image healthy.

Physical iPhone behavior and every business scenario in every department are not
part of this inspection-only release. The unrelated dirty worktrees, personal
guide prototype, environment and existing uploaded files are not edited.
