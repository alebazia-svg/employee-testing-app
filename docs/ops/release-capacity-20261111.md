# Release capacity correction — 11 November 2026

Owner approved correcting the release process after a cleanup result of 15.2 GiB
left only about 208 MiB above the 15 GiB reserve, less than the pending 313 MiB
archive. The disk had not immediately refilled: the old workflow lacked a
separate budget for transfer and image loading.

## Implemented and installed

Tool revision `884390fbad9c3a0d209ac96b22b5cd41f7bc76b2` installed at **18:58 Moscow**:

- `prepare` emits `capacity.json` next to the unchanged image/manifest format.
- `plan --bundle PATH --output NEW_JSON` measures an already built image without
  rebuilding/releasing it. It streams gzip/raw-tar image layers with bounded
  memory and no disk extraction; unsupported encodings or missing layers stop.
- `check-space --plan JSON --archive-directory PATH` performs the read-only,
  locked VPS check before archive transfer. The report lists required, available
  and missing bytes per filesystem. Use `--archive-present` only for the exact
  existing archive; its size and checksum are verified.
- `install` recomputes the archive budget, refuses loading without temporary
  headroom and rechecks the unchanged 15 GiB reserve after loading.
- Maintenance supports optional `--release-headroom-bytes N`: the explicit pass's
  target/check becomes reserve + N. Daily schedule/default target, cache target
  and every rule protecting images/containers/volumes/backups are unchanged.

The conservative load budget is stored layer blob bytes + twice expanded layer
TAR bytes + 1 GiB safety margin. Add archive bytes before transfer. Count a common
Docker/containerd filesystem once; separate archive storage has its own reserve.
Potential layer reuse is not subtracted. This is a planning budget, not a promise
of exact peak disk allocation. The final post-load check remains mandatory.
Promote the received archive by rename on the same filesystem, avoiding a second
copy; cross-filesystem copying needs a separate budget for both copies.

## Measured real bundle and VPS check

The existing 1.24.7 bundle was measured locally without changing its image or
checksum. Its application release was completed independently in the payroll
chat while this tooling correction was prepared.

| Item | Bytes |
| --- | ---: |
| Archive | 328719836 |
| Stored layer blobs | 330185464 |
| Expanded layer TAR contents | 1046011392 |
| Load headroom, including safety margin | 3495950072 |
| Required before transfer, including reserve | 19930797268 |
| Required before load, archive already stored | 19602077432 |
| Reserve after load | 16106127360 |

The installed command's independent entry-point test used this bundle as a
representative capacity sample, not as authorization to republish 1.24.7. It
reported available **16469901312 bytes**, required **19930797268 bytes**, shortfall
**3460895956 bytes** (about 3.2 GiB), and correctly stopped before transfer. It
performed no cleanup, image load or application operation. For every actual next
candidate, measure that candidate rather than reusing these sample numbers.

## Preservation and rollback

Installation held the existing shared release/storage lock. Before/after equality
checks preserved app/DB container IDs, start time/restart count, env and mount
hashes, complete image/volume inventories, the verified registry and storage timer.
Portal **1.24.7**, source `74e6539059ca80a962ea337c201ceff7442ea8bf`, image
`sha256:901b19549e686c939b4dee38b1c7950228e1adde5b7c523943dd87786104f6dc`
remained healthy. No app rebuild, migration, pruning, registry write, backup or
test-environment deletion, or app/database restart was performed by this task.

Installed release SHA-256:
`88158935a8ed1fb19643d056ae57274bfadc127d47d374688d54f71e334f74e3`.
Installed maintenance SHA-256:
`051a48946b6ee340fa3fc90231115e8fd3582066ae6001305ea9bfe2a353bf2f`.

Root-owned old tools and equality snapshots are retained at
`/var/lib/offonika-maintenance/tooling-backups/20261111-884390f/`.
With exact tooling rollback approval, native Terminal command:

```sh
sudo python3 /var/lib/offonika-maintenance/tooling-backups/20261111-884390f/rollback-tools.py
```

The guarded script restores only the preceding command/maintenance files after
checking that no later tooling update replaced them. App images, registry,
database, uploads and backups are untouched. Older tool revision `faa53f8` and
its original recovery evidence also remain available.

## Verification and practical limits

Passed 17 release unit tests, 9 retention tests and 2 opt-in real Docker tests.
The same 26 unit tests passed against the versioned payload on the VPS.
Independent SSH verified installed hashes, command options, public health and
1.24.7 metadata. Tests cover raw/gzip layer expansion, invalid budgets, common vs
separate filesystems, pre-mutation rejection, unchanged cleanup protection and
existing load/recreate/rollback behavior. `git diff --check` passed. No application
code changed; app/UI/payroll builds were not rerun for this host-only correction.

A budget does not create free space. If approved maintenance cannot reclaim enough
unused eligible data, stop and inspect storage rather than widening deletion,
lowering the reserve or repeatedly attempting the transfer. Additional disk
capacity or removal of specific protected/test/backup data needs its own review.
Docker `--min-free-space` is a cleanup target for the selected builder, not a
permission to remove in-use data or a guarantee of sufficient reclaimable bytes:
https://docs.docker.com/reference/cli/docker/buildx/prune/.

Repository files changed by this correction:

- `ops/release/portal_release.py`
- `ops/release/test_portal_release.py`
- `ops/release/test_docker_release.py`
- `docs/ops/maintenance/portal-storage-maintenance.py`
- `docs/ops/maintenance/test_storage_maintenance.py`
- `AGENTS.md`
- `ops/release/README.md`
- `docs/ops/vps-deploy-runbook.md`
- `docs/codex-memory/deploy-playbook.md`
- `docs/ops/release-capacity-20261111.md`
