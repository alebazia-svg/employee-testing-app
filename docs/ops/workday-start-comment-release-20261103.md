# Workday arrival comment — 2026-11-03

Owner reviewed the real local card and approved verification and release.
Runtime:1.21.8 / `7b6a4b4acb15d3da9cb35b071f01dbb67154c99e`.
Previous production:1.21.7 / `fb96ab7ca8ba98a0277e89092420d9b402fb15d4`.
Preserves that independently verified payroll release; deployments were serialized.
Server build metadata:2026-11-03T12:33:29.762Z (15:33 Moscow).

## Approved difference from the baseline

Inside the opened day card only, add the existing late-arrival explanation
immediately below Plan/Start/State. Use the employee's stored comment, or the
chosen standard reason when there is no custom text. Do not infer a different
shift or change the recorded start/116-minute calculation from that explanation.

Short text is visible in full. Long text takes two lines, with an accessible
Expand/Collapse button only when it actually overflows. Re-measure on width
changes. Empty explanations do not create an empty section. Preserve the
existing Start and changes disclosure, its original reason/comment, history,
team list, other checks and completion actions. Other deviation kinds retain
their existing presentation; no broader comment redesign is included.

## Verification before release

- Workday suite261/261 and capture/Google-date continuation10/10.
- ADMIN card/photo/revision, team order/control, timing, navigation, process
  and preserved payroll source tests116/116.
- Release metadata5/5. Total392 passing tests, no failures or skipped tests.
- TypeScript, production build and diff check passed.
- Authenticated actual local application with a separate synthetic PostgreSQL
  database. The observed November3 text was copied from Zukhra's live card for
  visual acceptance, without changing production. A short comment is visible
  immediately; a long example expands39px→78px at desktop and39px→176px at390px
  width, then collapses. A card without a comment has no new comment region.
- Existing Start and changes disclosure still opens/closes and retains its
  original content. The local financial values are fixture data for layout,
  not a claim of a new live financial verification.
- Physical iPhone not tested. No production financial action is part of smoke
  verification. No schema, migration, 1C extension, stored comment, schedule,
  lateness formula or payroll logic change belongs to this patch.

## Production verification

Released and independently verified. Transient server job:
`mobo-arrival-comment-release-1218.service`.
Log:`/home/bela/arrival-comment-1218-release.log`.
Before build:approved five-file delta, current plus two verified images,18GiB
free, no pending migrations and captured environment/mount fingerprints.
Final result:`RELEASE_VERIFIED_AND_REGISTERED`, `RELEASE_EXIT=0`.

- Server commit equals the runtime hash above; public metadata and authenticated
  ADMIN footer confirm1.21.8 and the build time above. Health returns ok and the
  running container is healthy.
- Actual Zukhra November3 card displays the original comment immediately under
  Plan/Start/State, with start10:56 and116minutes retained. Existing Start and
  changes still opens with `Другое` and the same original comment. It was closed
  again and the card left at the top for the owner. Original cash fact25750,
  captured32750 and difference-7000 remain available; an initial unavailable
  source presentation cleared on the next fresh snapshot without a mutation.
- All runtime environment values, server.env fingerprint and all mount
  identities/paths/modes match the pre-release baseline. No database migration,
  manual financial write or original-comment rewrite was performed.
- Screenshot:`/tmp/mobo-workday-start-comment-production-1218.png`.
- Current and both preceding verified images exist and are registered:
  - Current1.21.8:`sha256:7f68764b93e9dbf822f3977a115ced033abce20df3473009e50fdf03d88f74db`.
  - Previous1.21.7:`sha256:b500b9226497ce91492ee0fa5701a906f44efa420a04511854f180759d9096fe`.
  - Second reserve1.21.6:`sha256:fb0203a9c83e0220f9396efded46134816e33b1ecc913d6e0c7baa869a8318d0`.
- Free space after build:14.68GiB. Before any next build, reapply the15GiB gate
  and existing approved storage-maintenance policy; this release did not prune
  images, caches, uploads or volumes. Physical iPhone remains unverified.

## Exact runtime files

- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `app/(dashboard)/admin/workday/WorkdayStartComment.tsx`
- `app/globals.css`
- `package.json`
- `package-lock.json`

Unrelated dirty files in the owner's main checkout and the comparison worktree
were not changed or staged. Existing server `.rollback/` was preserved.
