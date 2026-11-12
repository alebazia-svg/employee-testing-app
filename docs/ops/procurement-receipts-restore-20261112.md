# Receipt/requisite UI restored — 12 November 2026

Released and verified **1.24.11**, runtime commit
`6a8f57753998a1ed8974706111367b0f8036e6ac`, based on the exact live 1.24.8
`81c801b46333b1dbc4f356d75923af1b91123597`. Owner explicitly requested urgent
restoration before further monitoring improvements. Pending 1.24.9/1.24.10
workday changes were preserved in maintained history but were not installed.

## Cause established from running UI, source and exact images

- Production 1.24.8 showed perpetual receipt checks in payment history, no receipt
  queue entry and no document section in a paid request.
- The receipt component returns null when its build-time flag is not `1`.
  Its ready/count callbacks therefore never run; the parent's initial loading
  state is not a running receipt verification.
- Exact local production artifacts 1.24.7 and 1.24.8 contained no compiled
  `/api/procurement/receipts?` loader or its load-error message. Both existed in
  1.24.6. The relevant component/API/schema source was unchanged between these
  releases. Compose still explicitly set the approved receipt build argument `1`.
- The new preparer accepts an explicit receipt flag; supplying `0` is syntactically
  valid but does not preserve the approved production behavior. Absence from
  runner environment inspection is not evidence for `0`: the argument is applied
  in the Docker builder stage and compiled into the client.

## Exact restoration and verification

Only `package.json` and `package-lock.json` differ from installed 1.24.8, with all
three version fields set to 1.24.11. Build used the existing preparer with
`--receipts-enabled 1`. No financial/UI source, schema, migrations, Compose,
startup, 1C package, notification policy or environment was changed.

- Six release metadata checks passed; complete amd64 production image build
  passed. An isolated network-none run against that image asserted receipt loader
  presence and exact version/revision/package-lock consistency.
- Image: `sha256:56f7aa1439a6faf271903a1a56cd4ec2b552a727072165e63c9d1ba1d00457e1`.
  Build: `2026-11-12T06:15:24.929Z`. Archive SHA-256:
  `2fd6d3d3d1f6d9eaecde0dea924b9902ef30b7e384224a7e6494a94b79ebe5dc`.
- Installed through the existing root-owned `portal-release` session. Exact
  source/manifest/archive/platform, schema, env/mount and DB-container guards
  passed. Both public origins, server commit and visible ADMIN version matched.
  Public health returned `ok:true`.
- Real authenticated ADMIN history showed loaded receipt indicators, preserved
  waiting/history counts 2/50 and a receipt queue count of 1. A previously saved
  payment receipt and its QR requisite both opened and rendered as actual images.
  The paid request and its RKO/excess remained correctly associated.
- Actor-bound employee preview in Phone mode showed the receipt queue, loaded
  history indicators, document sections and the same successfully rendered
  receipt. This was the real read-only preview, not a physical iPhone or a fresh
  employee login. No fake receipt or payment was created in production; upload
  persistence was not retested because its implementation was unchanged.
- Session `dd0805764d114902a692b6bb73222bf9` emitted `COMPLETE` after independent
  UI checks and exact-image confirmation. Its normal finalizer verified the
  current plus two rollback images and removed only this session's image archive.
  Final free space was approximately 19 GiB.

Initial session `bf080939cecb45aaaaa16ecb7e13b5e7` stopped before image transfer:
17.39 GiB free versus 18.56 GiB measured requirement; one authorized normal
retention attempt could not reach that budget. A bounded read-only check found
no large old installation archives and no reclaimable build cache. Owner then
explicitly approved removal of only unused 1.24.5 image
`sha256:c1d9fb24d7b2ea4042164a7c0ffbacf95dc25b7b73c085242d17da7f73a9118b`.
Under the shared lock, its exact two tags, absence from every container and the
three protected registry images were rechecked before removal. No protected
image, test environment, volume, business file or backup was deleted.

## Follow-up diagnosis; not delivered as part of this hotfix

`/api/health` checks only `SELECT 1`. It cannot establish that a feature was
compiled in or that a receipt renders. Employee request observation primarily
covers mutations; a component that never mounts emits no request failure.
System-category events are deliberately excluded from the ADMIN attention/push
policy. No new synthetic monitor, incident notifications, delivery channel or
notification-policy exception was enabled by this hotfix.

Recommended next scope: enforce approved build flags against the production
contract before preparing/installing; verify document reads using the exact
release artifact and representative ADMIN/employee contexts; design deduplicated
critical-incident detection and owner delivery with recovery evidence. Any new
technical push behavior needs an explicitly agreed policy, rather than silently
changing existing System/attention rules.
