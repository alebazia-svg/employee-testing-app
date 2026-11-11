# USDT register basis and supplier-debt matching — 11 November 2026

Status: **released and independently verified as 1.24.6** on 11 November 2026.
Runtime commit `ade055de8de596c3b5fd759a973fa4d95d5fbca7`, branch
`codex/usdt-payment-basis-20261111`; source fix `32d5da9`.
The candidate preserved the exact installed company-card 1.24.4 and KKM-copy
1.24.5 (`6501f2f`) releases before the version increment. Unfinished warehouse
work on the maintained source branch was not installed.

Owner approved fixing the reported USDT payment and applying the verified rule
to other requests. This is an extension of financial matching, not a manual
closure of one request. UI, notification policy, refresh schedules, 1C documents,
API extension, schema and production records are unchanged.

## Problem and approved behavior

The current `supplier-payment-basis-v1` endpoint can return a USDT RKO with a
contract in its native RUB settlement movements, despite an empty header. The
portal consumer previously validated this register proof only for RUB. Also,
the USDT allocator had no general supplier-debt fallback outside exact order,
manual and delivery ownership.

The existing reader now checks still-unresolved USDT debt payments after the
existing order proofs. It validates exact document identity, current posting and
deletion state, supplier/counterparty/organization, native document version,
contract references, movement identity/currency and whole movement coverage.
USDT document amounts retain eight-decimal comparison. Register totals and
movement count must match the independent per-RKO settlement totals; the two
currencies are never compared as the same money or converted with a guessed
rate. This proof does not expose the accounting rate as an exchanger rate.

Automatic debt allocation requires a sole outstanding approved USDT request
with an explicit foreign target and confirmed native basis. Competing suppliers,
legal counterparties, managers, order requests and pending revisions remain
guarded. Manual/current exact-order ownership wins. A cancelled request's
explicit order cannot be silently reassigned. Operational completion claims and
native expense-request claims retain their ownership.

Earlier RUB or USDT payments release a historical request only from fresh
chronological proof, before the new RKO. A temporary in-memory RUB coverage view
reuses the existing allocator and both approved small-RUB-remainder bounds.
Persisted paid/display flags and future or same-second documents cannot release
an older owner. RUB and USDT funding are not silently summed.

Partial USDT RKOs accumulate once. Material automatic excess stays for review;
the new fallback uses the existing foreign tolerance as its small-excess bound.
The whole document amount and the unallocated excess remain recorded once,
outside request coverage. An earlier ambiguous unassigned payment cannot block
a later independently owned full payment. A changed manual fingerprint cannot
fall through into automatic reassignment.

## Verification

- Read-only live diagnostic: 52 plan contexts, 226 payments, 260 native expense
  requests and one additional exact USDT contract read. Complete statuses and
  global historical contexts were included. AIAgentAPI 0.15.444 is synchronized
  with the published package; no extension release is needed.
- Replay against identical captured responses and a fixed clock: one previously
  unallocated USDT debt becomes paid; **all other 51 results are deep-equal**.
  Its full document money and excess are preserved. Source reads: 119 versus
  118 before. Business fixtures are private temporary files outside Git.
- Additional real-scope replay: unposting revokes payment, incomplete register
  evidence rejects the source, and removing an earlier historical RUB payment
  restores ambiguity instead of reassigning the newer payment.
- 170 targeted source/matcher/funding/history/receipt/notification tests passed,
  including the real notification lifecycle with source parsing and fresh
  matching: paid retires; partial, ambiguous, unposted and incomplete remain
  active. No notification delivery was invoked.
- TypeScript, final production build and `git diff --check` passed.
- Before installation, no production database mutation occurred. PostgreSQL
  write integration and production buyer/PWA UI were not exercised; no
  persistence or interface change is included.

## Production release verification

- Mac-built amd64 image
  `sha256:edca439efd87b7a70d5236b8eac88738566a6a08eac85d1105557479811c0755`,
  public build time `2026-11-11T14:50:23.842Z`; both public domains reported
  1.24.6 and the server commit matched `ade055d`. HTTP health returned 200.
- Deployment used the existing global storage/release lock, exact previous
  commit/image gates, archive SHA-256 verification and prebuilt-image restart.
  No schema, migration, env, notification service, mount or 1C package changed.
- Independent fresh read-only replay on the installed source: 52 plans, 226
  payments, 260 native expense requests. The target is paid, remaining zero;
  all other **51 complete matching results are identical** to 1.24.5 on the
  same responses. The source was complete, with 124 reads in 18.91 seconds.
- Authenticated ADMIN calendar: Tural moved from waiting to payment history;
  detail showed fully paid 8,000 USDT, RKO `00OF-002084`, full RKO 8,005.95 USDT
  and 5.95 USDT unallocated. Waiting/history counts changed from 3/49 to 2/50.
  The displayed application version was 1.24.6. The physical iPhone/buyer PWA
  was not separately exercised for this server-only matching change.
- Before/after comparison preserved all 52 plans, 33 receipt/requisite records,
  201 events, 3 daily rates and 30 physical files. Only the existing display
  evidence cache is excluded from business-row hashes; its normal refresh is
  expected after new matching.
- Owner explicitly approved deleting only the unused 1.24.2 image outside
  current plus two reserves. The helper rechecked no container/registry use and
  exact tags before removal. No other extra cleanup was authorized or performed.
- Installer evidence: `/home/bela/mobo-usdt-1.24.6-install.log`; safe comparison
  summary: `/home/bela/mobo-usdt-1.24.6-matching-summary.json`. Private readbacks
  remain outside Git. Installer finished with `VERIFIED_RELEASE_COMPLETE`,
  `INSTALL_EXIT=0`, healthy app and a verified registry containing 1.24.6 plus
  1.24.5/1.24.4 rollback images.

Changed files:

- `lib/procurement-register-payment-basis.ts`
- `lib/procurement-currency-payment-source.ts`
- `lib/procurement-currency-payment-evidence.ts`
- `lib/procurement-manual-payment-links.ts` (capability comment)
- `tests/procurement-usdt-register-basis.test.ts`
- `tests/procurement-usdt-debt-payment.test.ts`
- `tests/procurement-usdt-paid-notification.test.ts`
- `tests/procurement-payment-source-contract.test.ts` (legacy-API fixture after
  an order is unposted)

Before any later approved release, recheck active parallel releases, live and
deployment-branch versions, preserve the newest installed source and assign the
next free patch. No future release authority is inferred from this note.
The separate procurement-agent progress contract remains unchanged at 54.8/100;
there are no changed stage IDs or new spending/1C-write permissions.
