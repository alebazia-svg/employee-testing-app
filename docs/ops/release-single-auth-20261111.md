# One password per approved release — 11 November 2026

Owner approved eliminating repeated sudo prompts while preserving the working
portal, security settings and rollback. Tool revision
`f82c912a4c969082664c93567c113240171ef406` was installed on the VPS at **20:06 Moscow**.
This did not deploy or restart an application version.

## What changes

Previously separate native-Terminal/SSH sessions requested sudo for capacity
checks, maintenance, installation and final registration. The normal path now
uses one reviewed `sudo portal-release session-start`, followed by ordinary SSH
monitoring/upload and an unprivileged `session-confirm` after actual independent
verification. The same bounded root worker performs the privileged steps.

The worker pins the capacity plan/manifest SHA-256, exact base/target/image and
origin. It holds the existing lock around checks/installation and reuses the
existing capacity, source/version/schema guards and error rollback. Maintenance
is not implicit: the reviewed launch must include its exact existing-policy
permission, and only one pass is attempted when capacity is short. The archive
is transferred only after READY_FOR_TRANSFER, validated and promoted without a
second copy. Only this session's archive may be removed after verified completion
when the launch explicitly includes `--remove-archive`.

The transient systemd service survives an SSH/Terminal disconnect and has a
finite runtime. It has no general command API: confirmation is bounded data
matching that session's nonce, exact image and commit. Registration still uses
`--expected-current` and checks all three protected images. A bad/expired/rejected
review never registers an image; an unverified worker result is nonzero. Separate
manual recovery remains available. Runtime bounds and the asynchronous service
mode are documented by systemd:
https://www.freedesktop.org/software/systemd/man/252/systemd-run.html.

No sudoers/NOPASSWD, password handling/storage, sudo timestamp or SSH security
setting was changed. This changes command grouping, not authentication policy.
Normal preparation happens before authentication; do not keep prompting after a
failed/stale attempt without diagnosing the concrete reason.

## Installed files and recovery

- `/usr/local/sbin/portal-release`: entry point now targets root-owned version
  directory `/usr/local/lib/offonika-release/releases/f82c912/`.
- `portal_release.py` in that directory routes session commands to the new
  `portal_release_session.py`; the original install/capacity behavior is retained.
- Tests and `installation.json` are retained with the root-owned version.
- Maintenance is byte-identical to the already installed capacity correction:
  SHA-256 `051a48946b6ee340fa3fc90231115e8fd3582066ae6001305ea9bfe2a353bf2f`.
- Release entry module SHA-256:
  `0ddca5370d791c9b2583f256a294846767576666eb7ae3399b422bc2f7f92592`.
- Session module SHA-256:
  `a684c56bbe315342fa027175990164549c818c30014602a6c4b3b8a45ac6e514`.

Root-owned backups and before/after snapshots are retained in
`/var/lib/offonika-maintenance/tooling-backups/20261111-f82c912/`.
With exact tooling rollback approval, run in native Terminal:

```sh
sudo python3 /var/lib/offonika-maintenance/tooling-backups/20261111-f82c912/rollback-tools.py
```

The script checks installed tool hashes before restoring the prior entry point.
It does not change app images, database, registry, uploads or reserves. Old
versioned tools are retained. Reverting the default entry point does not delete
an already running session's immutable code/evidence.

## Preservation verification

Before/after equality checks passed for:

- Portal 1.24.8, source `81c801b46333b1dbc4f356d75923af1b91123597`.
- Image `sha256:55ea34ee056f5faf8060a190aaf6dc5b91b137eacabb7d4657b10a03d3dc5fa7`.
- App container `39c05160556b93616501ef4182d9f0b54ead9591a842e4f4f6c129545a9fc7de`,
  start time `2026-11-11T16:44:02.932304438Z`, restart count 0.
- Database container, sorted env/mount hash, image/volume inventories, storage
  timer state and the existing current-plus-two verified registry.
- Sudo policy aggregate hash
  `d506a068ff7af789a2744f9ea62a74c83c79e083afd2dac7daffb54eb5ef682e`.

Independent ordinary SSH verified installed hashes, command options, public
metadata and `/api/health` (`ok:true`). There were no production registry writes,
cache/image cleanup, application/DB restarts or application migrations in this
installation. No unrelated dirty working files were reverted or committed.

## Tests and limits

Local checks: 13 session tests, 17 existing release tests, 9 retention tests and
2 real local Docker integration tests passed (41 total), plus CLI validation-only
smoke check and `git diff --check`. The installed version's 12 session tests ran
successfully inside a real transient systemd unit on the VPS; its 17 release and
9 retention tests also passed there. The extra nonzero-exit regression assertion
was subsequently run locally against the same unchanged session implementation.

An isolated Bela-owned confirmation fixture with a nonexistent all-f image and
no matching root worker proved the installed confirmation command can write its
bounded data through ordinary SSH without sudo. It did not certify any actual
release or touch the production registry; the fixture was removed afterwards.

App/Docker operations in the session tests were fake operations against temporary
state; root systemd orchestration was real. The existing real Docker integration
continues to cover load/recreate/error rollback. No unnecessary live application
release was performed to test password count, and UI/payroll builds were not
rerun for this host-only change. Actual independent UI/business checks remain
mandatory on the next authorised release; a single launch or a confirmation
command's exit is never reported as completion.

## Source files changed

- `ops/release/portal_release.py`
- `ops/release/portal_release_session.py`
- `ops/release/test_portal_release_session.py`
- `ops/release/README.md`
- `AGENTS.md`
- `docs/ops/vps-deploy-runbook.md`
- `docs/codex-memory/deploy-playbook.md`
- `docs/ops/release-single-auth-20261111.md`
