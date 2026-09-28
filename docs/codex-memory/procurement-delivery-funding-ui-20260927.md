# Delivery funding: ADMIN read-only integration

27 September 2026. Approved change implemented locally, not committed/deployed.
Existing delivery ADMIN card extended; buyer calendar unchanged. No 1C writes,
automatic cashbox selection, spending approval or cashier notifications.

## Source and calculation boundary

Installed production/Yandex baseline verified this session:
`AIAgentAPI-v0.15.423-cash-funding-readonly-2026-09-27`.
GET `/cash-funding-context`, contract `cash-funding-context-v2`, fixed OFFONIKA
organization. Server-side ADMIN guard, private/no-store response, no credentials
or raw evidence in client errors.

Adapter rejects partial/stale/wrong-scope evidence, duplicate native grains and
unreconciled execution balances. Header and distribution totals are never added
to register balances. Cash balances and unpaid requests remain separate; there
is no computed free-to-spend balance. Exact accountable recipient is used, not
initiator/comment/name matching. Unallocated obligations are organization-wide,
not Astemir's debt, and never assigned to a header cashbox by inference.

UI shows outstanding Astemir request identities/status/remainder, followed by a
collapsed searchable list of nondeleted RUB cashboxes. All catalog cashboxes
are shown alphabetically; these are NOT owner-approved funding sources. Negative
balances remain visible. Unknown execution remains unknown, not face amount.
Refresh every minute while visible, also focus/online; failures remove old cash
data instead of displaying zeros. The parent accountable balance retains its
existing server-rendered lifecycle, separately timestamped.

## Verification and remaining gate

- 37 focused source/policy/UI/route tests passed, TypeScript passed, production
  build passed after final responsive/search change; diff whitespace check passed.
- Saved private real production evidence passed adapter validation. Authenticated
  local ADMIN page successfully fetched and displayed fresh production evidence:
  22 RUB cashboxes, no open Astemir top-up candidates, 11 organization-wide
  unallocated requests. This is not a delivery debt total.
- Actual local UI inspected at narrow viewport327px: collapsed/expanded details,
  automatic timestamp refresh and no horizontal overflow. Initial cashbox names
  were cramped; final patch uses full-width names and two labeled mobile columns,
  with a search field. **Final responsive/search interaction recheck is pending.**
- After rebuilding/restarting local dev, both funding GET and an independent
  read-only `/version` timed out at15seconds. Actual UI correctly showed unavailable
  data, not zeros. Do not declare final visual acceptance or deploy until fresh
  source access returns and the last UI patch is checked interactively.
- No production database/API mutation; isolated local DB and demo ADMIN login.
  Production portal remains92ec045. Unrelated dirty WIP preserved.

## Exact implementation files

- `lib/procurement-delivery-funding.ts` (new validator/adapter)
- `lib/one-c.ts` (new GET client only)
- `app/api/admin/procurement/delivery-funding/route.ts` (new ADMIN GET)
- `components/ProcurementDeliveryFunding.tsx` (new read-only client view)
- `components/ProcurementDeliveryAdmin.tsx` (child slot, copy/timestamp)
- `components/ProcurementDeliveryAdminSection.tsx` (composition)
- `tests/procurement-delivery-funding.test.ts`
- `tests/procurement-delivery-funding-route.test.ts`
- `tests/procurement-delivery-funding-ui.test.tsx`

Local dev3141: existing private helper
`/tmp/delivery-request-amount-20260927.9Eea9s/dev.cjs`, isolated DB55437;
credentials read privately from existing integration env. Helper runs foreground
and regenerates local session key on restart; sign in again through UI. No manual
production session creation. Browser tab1 is local ADMIN expense requests.

Next small step: restore/read-only-check source reachability, verify final mobile
cash search/clear/collapse in actual local ADMIN, show owner, then separately
approve commit/deploy. Native draft creation/approval needs its own scoped phase.
Procurement evidence progress54.8→54.8; no item IDs/stages changed, no ledger event.
Orders/contact/scheduling/spending/1C-write permissions remain disabled.

## Follow-up: source availability isolated, 27Sep approximately21:40MSK

Owner requested read-only diagnosis of possible new-endpoint impact. The earlier
description of a general web-server failure was too broad. Concurrent checks:

- Mac HTTP root/version: TCP connects, then no HTTP response within12seconds;
  earlier connections also returned curl52 (empty reply).
- Existing portal VPS → same HTTP root:200 in0.147seconds.
- VPS using its existing integration credentials → production `/version`:200 in
  0.386seconds, Teleinvest_UT11, exact package423.
- One focused VPS GET `/cash-funding-context`:200 in0.494seconds,21354bytes,
  v2, ok/complete/all five sections true, write_operations=false. No raw rows
  or credentials emitted, no remote file changes.
- Read-only Windows session: responsive desktop, W3SVC/WAS running, IIS site
  started, worker present, memory47%, CPU roughly12–36% during observations.
  IIS live-request listing unsupported; historical crash/blocking logs were not
  established. These snapshots do not exclude a previous transient event.
- Mac route to1C uses `utun12`; system HTTP/HTTPS/SOCKS/PAC proxies disabled.
  This isolates current failure to the Mac connection path (tunnel/filter/network
  or source-specific access), not a general1C outage. Exact failing component is
  unproven; no VPN/network/server restart/settings change was performed.

Remaining local visual gate therefore needs Mac connectivity restored, not an
unsubstantiated rollback of423. Working portal's source access is confirmed.

## Final local visual check via owner-approved temporary path, 27Sep21:57–21:59

Owner approved routing local checks through the existing portal VPS. No remote
files, service configuration, VPN settings or production data changed. Temporary
loopback-only SSH forwarding3149 plus a local GET-only allowlist proxy3150
permits only version/accountable-statement/cash-funding-context. POST rejection
verified405 without forwarding. Local app3141 still uses the isolated demo DB.
Helper: `/tmp/delivery-funding-preview-20260927.FubBPJ/dev.cjs`.
This temporary path is not product code and must never enter a deployment.

Authenticated actual ADMIN screen now displays fresh production1C data. Final
mobile layout checked at327px viewport (document312px, card288px): names full
width, two labeled amount columns, no horizontal overflow. Search by actual
cashbox name, empty results, clear, collapse and reopen all passed. Native
automatic refresh advanced cash timestamp21:57→21:58 without a manual reload.
Accountable balance/source timestamp is independent. No new requests submitted.

37 tests rerun PASS, TypeScript PASS, diff-check PASS; product source unchanged
since the successful production build. Previous source-outage display and tests
cover fail-closed behavior. No real money/document mutation or full device matrix
was tested. Owner visual acceptance and explicit commit/deploy approval remain.
All original unrelated WIP preserved. Progress54.8 unchanged; no permissions or
stage IDs changed. The local source-connectivity visual blocker is resolved.

## Owner correction: manager cashboxes only

Owner explicitly rejected personal/admin cashboxes, bank/card entries and safes
in the delivery funding list. API now filters the validated presentation by
active `UserOneCCashboxMapping` rows for active EMPLOYEE / WORKDAY users in
retail or wholesale. It does not infer eligibility from cashbox names, current
shift or account balance. No mapping-read failure/empty result falls back to the
full catalog. Reconciliation, Astemir requests and unallocated organization-wide
obligations are unchanged; non-manager balances are not returned to the client.

Read-only production ADMIN mapping UI confirmed five actual assigned cashboxes:
Abshaeva, Akhobekova, Kosterenko, Khurzokova and Chechenova. No production mapping
was saved/changed. Isolated local DB contains equivalent preview-only mappings
for visual verification, with non-login synthetic employees; no real accounts
were copied. Actual local browser shows exactly those five cashboxes and fresh
1C balances. Title is now «Кассы менеджеров».39 tests, TypeScript and production
build passed after this correction; diff whitespace check passed.
This supersedes the previous all-catalog presentation rule; deploy still pending.

## Owner-approved compact ADMIN card, 27Sep

The owner approved removing the empty request section, search and cashbox
disclosure, zero obligation columns, duplicate source timestamps and generic
instructions. Main card now shows balance, recommended top-up to the existing
reserve target, and a directly visible two-column manager cashbox list. Request
identities/status/remainder appear only for real candidates; positive/unknown
cashbox obligations remain visible when applicable. Labels distinguish book
balances from spendable cash and recommendation from an actual buyer request.
Actual buyer-request amount/comment/history are preserved.

Organization-wide unassigned/ambiguous requests moved to a separate collapsed
«Проверка заявок организации» after the card, sharing the same validated read and
failure/staleness guard. No data or arithmetic removed, no second fetch/persistence
or approval system. This supersedes the previous cashbox search/details design.
The single main-card timestamp explicitly refers to accountable balance, not an
assertion that independent cash/register reads are one atomic snapshot.

Actual local narrow-screen review: all five manager names/amounts visible without
an inner scroll area, no horizontal overflow (327px viewport,312px document),
organization-wide total absent from main card; separate check opens/closes.
Production build, TypeScript and diff-check passed.42 focused tests pass, including nonempty/empty requests, zero/positive/unknown
obligations, preserved manual requests and separate organization checks.
Changed product files in this refinement: ProcurementDeliveryAdmin.tsx,
ProcurementDeliveryFunding.tsx, ProcurementDeliveryAdminSection.tsx, and
procurement-delivery-funding-ui.test.tsx. No buyer-calendar or calculation changes.
No commit/deploy or production writes. Unrelated WIP preserved.

## Owner-approved automatic cashbox suggestion, 27Sep

Owner rejected the data-only table as insufficiently actionable and explicitly
approved suggesting the manager cashbox with the highest book balance for a
specified amount. This supersedes the no-ranking UI rule above, not the 1C
read-only contract or spending/approval restrictions.

- Exact manager mapping filter remains on the ADMIN server route. No safes,
  personal cashboxes, name inference or new mapping writes.
- Suggestion ranks by book balance descending (stable ref tie break), after
  excluding boxes whose balance minus known allocated unpaid requests is less
  than the proposed issue. Unapproved allocated requests are protected too.
- Unknown/invalid obligations exclude that cashbox. Unallocated organization
  requests are NOT deducted from an arbitrary cashbox; they make a suggestion
  explicitly preliminary. This is not certified free cash or an atomic snapshot.
- Existing Astemir native top-up candidates suppress another top-up suggestion.
  Failed/stale source hides recommendations, no automatic splitting between boxes.
- Amount defaults to the buyer's actual request when present, otherwise the
  existing reserve gap if fresh. An ADMIN edit is local what-if input only; it
  never changes the buyer request. No reserve-gap default from stale evidence.
- Cashbox can be changed among eligible manager boxes, with automatic selection
  restored on amount changes. Latest fetched balances determine eligibility.
- UI shows one suggested source and its before/after issue balance. Full manager
  list is no longer on the main card; alternatives are under «Сменить».
- No submit/approve/issue button, database change, 1C endpoint change or deploy.
  Future document creation MUST perform a fresh server-side scope/balance/request
  read and duplicate check; this client suggestion must never authorize a write.

Exact files in this step:
`lib/procurement-delivery-cashbox-choice.ts`,
`components/ProcurementDeliveryCashboxChoice.tsx`,
`components/ProcurementDeliveryFunding.tsx`,
`components/ProcurementDeliveryAdmin.tsx`,
`tests/procurement-delivery-cashbox-choice.test.tsx`, and this handoff.
52 focused tests and TypeScript passed. Actual narrow-screen interactions against
fresh read-only 1C: requested example10,000 selects Abshaeva20,960, after10,960;
manual alternative Akhobekova13,535 gives after3,535; return to automatic works;
30,000 refuses single-box selection,0 refuses selection. These are local what-if
inputs, not submitted requests. Source failure removes the suggestion. No
horizontal overflow at312px document width. Final production build passed;
authenticated re-entry23:00MSK confirmed fresh2259 accountable balance and
default32741 reserve gap. Local example10,000 left for owner review. No real
request was submitted, no full physical-device matrix tested.
Progress54.8→54.8, no changed stage IDs/ledger events. Source contract and safety
tests unchanged; no order/contact/schedule/spending/1C-write permission added.
Unrelated dirty WIP preserved. Commit/deploy still require separate approval.

## 28Sep: release approved, then held for missing buyer feedback

Owner approved releasing the prior screen but immediately identified that a real
15,000 buyer request had no ADMIN decision/feedback path. Owner has already
created the native1C request and subsequently approved read-only linkage/status
feedback. Do not create a second request or silently turn this into an approval
or cashier-push workflow. Existing deployment is held until the newly agreed
feedback path is implemented and visually checked.

Read-only production check confirmed exact-person request00OF-001026,15,000,
status payable, requested Chechenova cashbox, desired date29Sep. Its native
register source remains unassigned; header source must be labelled as the source
specified in the request, not a guaranteed reservation.

Source gap: cash-funding hides completely executed requests; expense-requests
retains execution/RKO history but lacks exact accountable recipient/org/currency.
An additive existing-reader candidate has been built in the1C repository, with
5 local tests; owner test installation and focused GET-only smoke subsequently
passed on6 existing test documents. Production remains423 without the added
identity contract; publication/production installation is the next owner gate.
See ai-business-os/11-procurement-agent/delivery-funding-readonly/
REQUEST-STATUS-20260928.md for package, exact changed files and next smoke.
No portal product edits/commit/deploy in this dependency step. Do not claim
automatic buyer feedback is working yet. No business document changes made.

Subsequently owner approved publication: production package
`AIAgentAPI-v0.15.424-expense-request-identity-2026-09-28.zip` uploaded to Yandex
`/AgentAPI_Project`, reverse-download SHA256 verified
`b00f21f973745df36dbe735fe7f2915939dc0ac66e4dd40a7bc1cb5ea6b42410`.
Only package identity differs from the live-tested candidate. Production manual
installation and `/version` confirmation pending; portal work remains held at
the dependency boundary, not deployed. Do not create another native15,000 request.

29Sep update: production424 installation confirmed; native request feedback is
now implemented and visually verified LOCALLY. Current implementation, tests,
exact files and release boundary: `procurement-delivery-native-status-20260929.md`.
This historical local gate is now complete: approved code commit `a2a6f0b` was
deployed29Sep00:52MSK, source/health/actual ADMIN browser checks passed. Current
release record and remaining owner link confirmation are in
`procurement-delivery-native-status-20260929.md`. No native documents were changed.
