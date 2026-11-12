# Release tooling follow-up — 2026-11-12

Status: prepared in an isolated worktree; not installed on the VPS. The live
tool revision remains f82c912. No application, database, environment, upload,
backup or production image was changed by this follow-up.

Observed on the VPS: the 1.24.11 attempt stopped before transfer because its
capacity target exceeded available space. Existing cleanup excluded the old
1.24.5 image because one tag was outside its whitelist. After the owner's
separate exact-image deletion approval in the receipt-release chat, 1.24.11
completed through the existing session workflow. Its successful installation is
not evidence that the next archive will fit. Generated release tags also fall
outside the existing legacy whitelist, so retention needs a separately approved
correction; the current patch deliberately preserves deletion rules.

Prepared changes: ordinary-user capacity precheck using root-published paths
and live statvfs; bounded maintenance output in the existing session log;
read-only storage inventory and owner-readable capacity diagnostics; advisory
storage report after verified registration. Reserve remains 15 GiB plus the
measured archive/load budget. Root locked checks remain mandatory.

Verification: 35 release/session unit tests and 10 maintenance unit tests pass.
A real local Docker fixture completed three consecutive receive/install/HTTP
review/confirmation/registry cycles and retained current plus two reserves.
Injected real-filesystem capacity shortage and expired upload preserved the
container identity, HTTP metadata and registry; retry succeeded. Git ancestry,
migration state, production business review and normal-case capacity are
adapters in that fixture, so it does not establish a production end-to-end
release or production sudo behavior. Production installation, non-root host
precheck and next actual application release remain unverified.

Changes are isolated from the owner's dirty portal checkout. Code and this
operating documentation are committed separately. No application build is
required for tooling-only changes.
