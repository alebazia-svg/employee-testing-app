# Procurement creation — released 16 November 2026

Production 1.24.17, runtime commit edda062737760438611c0e8d1e6be441d017d9a5.
Exact base: live 1.24.16 / de24fd7d1c3bfbab5bd133c831030641ae371347.
Image: sha256:4d22b84794bf3711cb6c567d53f287505f52082e6ae1b9a699b9700c6546bcf7.
Built clean 2026-11-16T19:23:01.605Z (22:23 Moscow).

## Released scope

- Separate supplier-wide payments on different known planned dates; existing
  explicit-order and same-day supplier-wide overlap checks remain.
- ADMIN creation through the existing buyer form and independently validated
  manager mapping. Creation records the actual ADMIN actor, keeps the buyer as
  managerUserId, and still creates SUBMITTED requests in this release.
- No schema/migration, Compose/startup, environment/scheduler, native matching,
  QR funding, receipt/requisite policy or existing document-link changes.

106 focused cases, TypeScript and production builds passed before installation.
Six release-metadata cases passed for the synchronized package/lock 1.24.17.
The trusted preparer verified the actual linux/amd64 image: receipts flag 1,
188 routes (one new read-only creation context), 275 public files; no old
route or public-file removal. The temporary local review harness was not shipped.

## Independent production verification

- Public version/build/revision, server Git commit, authenticated visible label
  and health agree. New ADMIN creation opens, loads fresh 1C context and offers
  Luxo for advance despite a separate future request. Form closed without save.
- At the initial post-installation comparison, all 53 existing history entries
  matched the pre-installation normalized UI exactly: amounts, rates, states
  and receipt marks. The saved Luxo detail also matched exactly, including its
  original RKO and receipt. The same protected receipt file loaded in ADMIN
  and the actor-bound employee Phone preview.
- During independent verification an actual ADMIN created another Luxo advance
  at 22:35 Moscow, then it appeared paid in employee history with an RKO dated
  22:40. This legitimate concurrent workflow explains later count changes;
  do not claim the production database was frozen or that the agent created a
  production test request. The old 20-Nov request stayed separate.
- No production financial request, approval, cancellation or upload was submitted
  by the agent. Employee-preview visits and ordinary application read-side
  refreshes used existing behavior. No notification was deliberately marked read.
- Physical iPhone/standalone PWA was not independently exercised after this
  release; mobile application verification used actor-bound Phone inspection.

## Delivery and retention

Guarded session f353b1015e4745249dcbc08fd8e1b38a reached COMPLETE after independent
checks and exact-image confirmation. One native Terminal sudo entry; no password
was handled by the agent. No pre-transfer cleanup was needed (required
19,935,647,091 bytes versus 20,685,033,472 available).

The installed tool checked compatible schema, environment/mount equality,
unchanged database container, health, source, rollback registry and actual compiled
capabilities. After registration, standing verified retention removed only the
obsolete unused 1.24.14 image. Current 1.24.17 and verified 1.24.16/1.24.15 reserves
are present and pinned. Final reported free space 19.26 GiB; temporary remote
archive was removed by the same worker. Tests, volumes, uploads and backups
were outside deletion scope.

The exact verified bundle is retained at:
/Users/bela/Library/Application Support/Offonika/portal-release-archives/4d22b84794bf3711cb6c567d53f287505f52082e6ae1b9a699b9700c6546bcf7/

Local technical proof: /tmp/payment-create-release-20261116-12417/ and scoped
private before/after UI proofs under /tmp/payment-create-*. Production UI image:
/Users/bela/.codex/visualizations/2026/11/16/payment-release/released-form.jpg.
Canonical integration 855b674 retains unrelated pending modules; it is not the
runtime source target. Unrelated worktrees/dirty files were preserved.

## Subsequent owner request — not part of 1.24.17

After installation Bela reported that Add Payment shifts between tabs and asked
for a unified header proposal across all real tabs. She also explicitly requested
one ADMIN action to create and approve, rather than submitting to herself.
Investigate/show this next candidate separately; do not change published bytes
under 1.24.17. Do not describe immediate approval as shipped in this release.
