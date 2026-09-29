# USDT settlement-link correction — deployed 2026-09-29

- Owner approved the scoped fix, commit, deployment and interactive sudo.
- Fix commit: `13094c4`; production release: `3c350d3362631a808ee6c7e8de2495e3169ac8ba`.
- Server was already at `b7dce307` (AQSI reporting correction). That commit was
  fetched from the server and merged intact, not overwritten by this release.
- Only portal application was rebuilt/restarted. No migration, 1C write,
  extension release, payment reassignment, approval or notification resend.

## Behavior

Missing header basis on a USDT RKO can now be supplemented by an exact order
link in complete, recent document-evidence. The independent RKO settlement
total/currency and single movement must agree with the original advance
movement. Document USDT and settlement RUB are never compared as equal units.
Split, repeated, mixed-currency or conflicting evidence remains unlinked.

Register-derived ownership requires one eligible request, an exact order
reference, matching supplier and request creation before the payment. Earlier
fully covered requests cannot consume a later payment. Duplicate/conflicting
document copies do not increase coverage. Existing explicit links remain
authoritative. No fuzzy supplier/date/amount matching was introduced.

USDT request coverage stays capped at its requested amount. A remaining
unallocated document amount is retained separately and shown in payment
history; it is not classified as supplier debt or supplier overpayment.

## Verification and rollback

- Before release: 99 focused regression/render tests, TypeScript, local build;
  fresh read-only 1C check and actual history components in local browser.
- After merging server history: focused matching/render/AQSI tests and
  TypeScript passed again. Server production build passed.
- Release script exited zero; container healthy; route bundles and new
  matching/UI markers found. Both public host health checks returned 200.
- Authenticated production admin screen: the target request moved from waiting
  for payment into history; original RKO amount and unallocated difference
  visible. The unlinked-payment question no longer appeared for that payment.
- Buyer component checked locally; no separate production buyer sign-in or
  mobile device matrix was performed in this release.
- Rollback image retained:
  `offonika-portal-rollback:before-luxo-usdt-3c350d3`.
- Private deployment diagnostics: `/tmp/luxo-usdt-release.2w1feE/` on owner Mac.
  Do not commit logs, raw snapshots or local review routes.
- Other dirty files and development previews were excluded and preserved.
