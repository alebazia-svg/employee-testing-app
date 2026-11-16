# QR transfer time parsing — verified release 1.24.18

Released 17 November 2026. Runtime commit `182679e42f42e33bc381608960c23057b4543537`;
public build timestamp `2026-11-16T22:19:06.864Z` (17 November 01:19 MSK).
Canonical integration `5eed15f` retains the separate pending modules; it is not
an instruction to deploy that merge tree.

## Approved difference

Native 1C movement timestamps may use `17.11.2026 0:41:16`. The QR funding reader
previously required two hour digits, falling through to an invalid/ambiguous
native Date.parse. Accept one or two hour digits and pad the hour before parsing
explicit Moscow time. No change to identity, supplier/code matching, reciprocal
cashbox/document checks, amount checks, ambiguity protections or financial completion.
A transfer remains funding only; the receipt and final supplier expense are separate.

Changed runtime/source files:
- `lib/procurement-qr-funding.ts` — two-line normalization correction;
- `tests/procurement-qr-funding.test.ts` — unpadded hour and retained guard regression;
- `package.json`, `package-lock.json` — consistent version 1.24.18.

The local header/immediate ADMIN approval proposal `93ca153` is excluded.
No schema, migration, Compose, startup, env, API or 1C extension change.

## Verification

- 65 focused QR funding, preparation, evidence continuity, payment matching and
  small-remainder tests passed; six release metadata tests passed; tsc passed.
- Exact committed linux/amd64 image completed its production Next build.
  Trusted compiled-capability checks retained receipts/requisites enabled,
  188 routes and 275 public assets.
- Read-only 1C check found the linked expense/receipt pair for 122700 RUB with
  the exact QR supplier comment. The original timestamp fails in the old helper
  and parses to the correct Moscow instant in the corrected helper. A private
  source replay used a representative isolated plan; it was not a production DB export.
- After deployment and fresh source refresh, actual ADMIN and the actor-bound
  employee Phone inspection both show V12 / В12 as `Ожидает чека`, 122700 RUB.
  No manual completion, approval, receipt upload or 1C write was performed.
- Independent before/after normalized UI row comparison: all five pending rows,
  all 54 history rows and the other approved row match exactly; counts remain
  5 / 2 / 54. The only intended current-row difference is V12 funding/status.
- Original saved JPEG (738 x 1600) opened successfully in ADMIN and employee Phone
  inspection, retaining its link to expense 00OF-002049. This is a representative
  file/link readback, not a claim of a full production DB checksum audit.
- Server revision, public version/build, visible ADMIN version and public health
  independently confirmed. Existing installer guards checked preserved environment,
  mounts and database container identity. Read-side source annotations may refresh
  normally; no production business fields were manually rewritten.
- Physical iPhone/standalone PWA was not independently operated in this release;
  employee verification used its real shared providers in read-only Phone inspection.

Private proofs: `/tmp/mobo-v12-before-ui-20261117.json`,
`/tmp/mobo-v12-after-ui-20261117.json` and screenshots under
`/Users/bela/.codex/visualizations/2026/11/17/v12-transfer/`.
Raw 1C diagnostic payload stays private and is not committed.

## Delivery

Image `sha256:afaf8ba11695584b3f97387a0c54c29d1d9558e20b5b8ef3b434d860190a42b2`.
Archive SHA256 `3015ea1540f12b8dd5daa04f509e004363057b36e243b18636d650c49e29e32c`.
Plan SHA256 `b85d5a522d8d9b533fc517cb17ea2300b430c1cb6d404c5a8a3c01800963ea57`.
Guarded session `32cb38c252844d3e9b6a67ba5d1cc3ae` reached COMPLETE after 467.27s,
following the independent checks and exact-image confirmation. One native Terminal
sudo entry; no password was handled by the agent.

Fresh reserve status confirms healthy current 1.24.18 plus verified/pinned
1.24.17 and 1.24.16. Existing verified retention removed only unused 1.24.15;
free space reported 19.24 GiB. No volume, upload, backup or test-environment cleanup.
Exact verified bundle retained under the image ID at
`/Users/bela/Library/Application Support/Offonika/portal-release-archives/`.
Unrelated dirty files and worktrees were left untouched.
