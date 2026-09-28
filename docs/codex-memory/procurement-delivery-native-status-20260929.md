# Native delivery request status — 29 September 2026

APPROVED CHANGE: connect an already created native1C accountable request to the
buyer's portal request and display fresh status, amount and requested cashbox.
Native number and desired date stay ADMIN-only. Owner subsequently approved
commit/deploy after the final buyer-copy correction below. No native request
creation/approval/posting, cash issue, cashier push or migration.

## Source and identity

Production/Yandex `AIAgentAPI-v0.15.424-expense-request-identity-2026-09-28`
match confirmed. Focused read-only production GET validates actual00OF-001026:
15,000 RUB for exact Astemir person/org/currency; payable, posted; native issued0,
remaining15,000; no directRKO; requested Chechenova cashbox, desired29Sep.
Do not create a duplicate. Header cashbox is not a register reservation.

Existing expense-request reader has optional strictRequests mode: explicit
request completeness, pagination validation, duplicate guard; optional attachment
errors do not suppress complete personal execution evidence. Native projection
whitelists only personal public fields; never send organization rows/cash balances,
initiator, raw source, source version or audit actor to the buyer.

## Workflow / persistence

ADMIN sees matching exact-person RUB cash requests of the requested amount.
Date/amount filtering proposes candidates, NEVER automatically proves a link.
One explicit «Показать Астемиру» confirmation links the chosen document. Fresh
source quote is checked before save; advisory lock/CAS rejects changed cycles,
duplicate links and reuse of a native document across portal requests. Existing
AdminInboxEvent holds the versioned link and separate immutable audit events;
no schema change, no notification claiming approval. «Изменить связь» provides
explicit audited unlink. Existing native request is not modified.

Stable UUID and document creation day retained for subsequent reads, including
fully issued requests missing from cash-funding-context. Source reads have a
bounded30-second cache; failures stay unavailable. Both UIs auto-refresh60s.
Discovery includes one day before the portal request for midnight/prepared
documents;31-day cap is explicit, ADMIN can choose a specific document day.

Separate states waiting/approved/payable/partial/issued/rejected/review.
Issued requires positive direct posted nondeleted RKO evidence and exact kopeck
reconciliation with native register. Duplicates, missing links, wrong identity,
changed amount, unposted/deleted requests, source failure and reversals do not
retain a paid/approved claim. Desired date is explicitly «Желаемая дата»;
cashbox explicitly «По заявке». Payable says «Деньги ещё не выданы».

A manual request with details is no longer closed merely by reserve reaching35k.
The current linked document remains re-readable even after issue, so reversals
are observed. Once issue is confirmed and reserve below target, buyer may
explicitly start a new request/cycle; old exact link/audit remains preserved.
Legacy automatic reminders without details retain existing reserve hysteresis.

## Files

- lib/expense-request-source.ts (optional strict mode, existing callers unchanged)
- lib/procurement-delivery-native{,-source}.ts
- lib/procurement-delivery-reminders.ts
- app/api/admin/procurement/delivery-request/route.ts
- components/ProcurementDeliveryNativeStatus.tsx
- components/ProcurementDeliveryLink.tsx
- components/ProcurementDeliveryPanel.tsx
- components/ProcurementDeliveryFunding.tsx (extends earlier local funding WIP)
- tests/procurement-delivery-native*.test.* and delivery.integration.test.ts

## Verification / release boundary

TypeScript and production build passed. Focused native states, strict reader,
render/copy, existing delivery/funding and expense-admin regressions passed.
Real isolated PostgreSQL tests: buyer request auth/concurrency/next cycle;
ADMIN link auth/origin, fresh preview, duplicate concurrent link, unique native
document, superseded-cycle rejection, unlink/relink and immutable audit.

Actual authenticated local browser: buyer15000 test request → ADMIN real native
candidate → cancel/confirm → exact native status → buyer automatic refresh
without page reload. Buyer on localhost, ADMIN on127.0.0.1 for separate sessions.
312px ADMIN layout has no horizontal overflow. No production portal writes or
business-document writes. Local request/comment is explicitly a test, native
document and balance come from live1C. Neighboring supplier preview is historical
25Sep data, not refreshed by this task. No production issuance/reversal performed;
these states are verified with tests, not claimed as a live payment.

Production commit/deploy completed after final visual acceptance; see release
record below. Preserve all unrelated dirty files. No git add-all. Progress54.8→54.8;
no stage item IDs or ledger events changed. Order/contact/schedule/spending and
1C-write permissions remain disabled.

## Owner copy/role correction before release

Release paused at owner's request before any commit/deploy. Milana handles the
native request/RKO; Astemir only needs collection permission, amount and cashbox.
Owner accepted buyer copy «Можно получить15 000 ₽» + exact cashbox name, shown
only for fresh payable evidence with a known requested cashbox. Native request
number, desired date and accounting explanation stay ADMIN-only. Waiting,
approved-but-not-payable, partial, issued, missing cashbox and unavailable states
never inherit this collection permission. No Milana/name hardcoding or 1C write.
Two audience-specific presentations share unchanged validated source logic.

## Production release completed — 29Sep, 00:52 MSK

- Code commit `a2a6f0b15f8009020a649a95851d5bc7421ce56a`, pushed to
  `origin/design-local-updates`; includes the approved earlier manager-cashbox
  funding integration and native request feedback, 25 scoped source/test files.
- Local checkout first fast-forwarded to live `cdb37cc8634c79eb1f9026c6ea523aa274350ca9`,
  preserving the independent company-card and admin-push updates and local WIP.
- Owner entered sudo only in visible Terminal. Only `portal-app` rebuilt and
  restarted. No env/schema/migration/upload changes, 1C writes or manual business
  state edits. Existing delivery timer remains active with last run success.
- Exact final commit production build/typecheck passed. Container healthy;
  independent SSH confirmed target Git HEAD and external `/api/health` returned
  `{"ok":true}`. Source-only delivery smoke returned complete, persisted=false.
  Built buyer bundle contains final «Можно получить» copy. Deploy exit0.
- Tests before release:48 server/source tests,30 UI/render tests,2 isolated
  PostgreSQL integration scenarios; TypeScript and diff checks passed.
- Actual authenticated production ADMIN browser shows live balance2259, buyer's
  real15000 request, native00OF-001026, payable15000, «Касса Чеченова», desired
 29Sep and «Деньги ещё не выданы». «Показать Астемиру» is available.
- Production link is still UNCONFIRMED. The owner must select and confirm the
  intended existing request. Deploy verification did not click a business write.
  Once linked, fresh payable evidence shows buyer «Можно получить15 000 ₽» and
  «Касса Чеченова»; source refresh is automatic. No push is included.
- Buyer transition was verified in authenticated local app using isolated portal
  records and live1C. No authenticated production buyer session was available;
  do not claim the production buyer was impersonated or actual issue/reversal tested.
- Saved rollback image: `offonika-portal-rollback:before-delivery-native-a2a6f0b`.
  Prior code is the exact `cdb37cc...` above. Preserve portal link/audit records on
  rollback; do not roll back DB or1C. Restrict any recovery to this portal service.
- Local operational log: `/tmp/delivery-native-deploy-20260929.1txukn/deploy.log`.
  Actual production screenshot: `/tmp/procurement-delivery-native-production-20260929.png`.
  These temporary artifacts are not committed.

End-of-step evidence progress remains54.8 (from54.8); no stage item IDs or ledger
events changed. Autonomous order/contact/schedule/spending and1C writes remain
disabled. Next small step: owner confirms the existing15000 request in ADMIN;
Astemir verifies the collection instruction in his own session. Native approval
from the portal and cashier pushes remain separate, unimplemented future stages.

## Post-release ADMIN density correction — local, awaiting visual acceptance

Owner rejected the tall production ADMIN card and full-width action. Approved
presentation-only correction: no native/link/accounting changes. Compact request
and balance row, single native status surface, inline amount/status, auto-width
action, collapsed historical request data. Buyer copy is unchanged.
Files: ProcurementDeliveryAdmin.tsx, ProcurementDeliveryNativeStatus.tsx,
ProcurementDeliveryLink.tsx, procurement-delivery-funding-ui.test.tsx.
26 render/UI tests and TypeScript passed; actual local authenticated browser
checked candidate/linked/confirmation/cancel and narrow312px no-overflow. Desktop
card331px high, button175px wide. Source2259/15000/cashbox comes from live1C via a
temporary GET-only SSH tunnel because the direct Mac connection timed out.
The local request/comment remains a labelled demo. Production candidate remains
unlinked; no production business write. Correction is NOT deployed/committed yet.
Local screenshot `/tmp/procurement-delivery-compact-admin-20260929.png`.
Do not repeat the earlier full release's completion claim for this new correction.

Owner then rejected the distant right-aligned button and explicitly requested
columns. Local correction now has a responsive two-column ADMIN card: buyer
request/balance/history left, native status/cashbox/action right; the button is
directly below its native status, never on the far opposite edge. On narrow
screens columns stack. Verified actual open tab14, desktop card276px high,
button and status share the same left edge;312px layout has no overflow.
Confirmation/cancel,26 UI tests, TypeScript and diff checks pass. Still local,
not committed/deployed. No accounting/1C/source or production business changes.
Screenshot: `/tmp/procurement-delivery-columns-admin-20260929.png`.

## Automatic display and notification lifecycle — local, 29 Sep 2026

Supersedes the manual-button next step above. Owner approved showing the one
unambiguous eligible native request automatically, and removing issued-history
copy from the buyer card. Native approval in 1C remains mandatory for «Можно
получить». Full issue removes the invitation; partial issue shows only the
verified remaining amount. Balance remains the actual accountable-register
balance; advance reports are never subtracted again by the portal.

Automatic selection is read-only: exact employee/organization/currency/cash
operation and requested amount, document created after the portal request,
complete source and unique candidate, no reuse of another cycle's native UUID.
Multiple candidates, missing identity contract or invalid dates do not guess.
Explicit manual unlink is respected. Older than31 days or unmatched requests
remain manual review. Existing manual links still work.

Owner additionally requested one morning push and retirement of obsolete buyer
alerts. Implementation extends the existing WorkdayNotification minute dispatcher;
no new scheduler, migration or 1C write. Permission-to-collect queues a unique
native-UUID/user notification, not mere request creation. Current native request
`ed241171-bb79-11f1-8f11-002590803daf` is deferred once until
**29 Sep2026 08:30 Europe/Moscow (05:30Z)**. This is not recurring quiet hours.
Source is rechecked before delivery; issued/rejected or superseded requests cancel
the push, unknown source defers it. Push copy is current amount and cashbox;
inbox copy stays neutral. Link opens `/procurement#delivery`. TTL300 seconds.
Native unique insert plus CAS sender claim prevent overlapping dispatcher sends.
If a process crashes after a possibly delivered push, its result becomes unknown
and is not automatically replayed. Browser GET never queues a new push.

Procurement alerts now retire when the plan is cancelled, completed without top-up
or fully paid according to the same complete, version-matched evidence as the
calendar. Partial payment, changed versions and source failures do not close them.
Existing task/issue/review lifecycle remains. Retired rows are marked cancelled,
not deleted and not falsely marked read. This cleans the portal bell/badge; it
does not remotely erase already delivered phone notifications.

Verification:84 server/source/notification tests,38 render/UI tests,3 isolated
PostgreSQL integration tests, TypeScript and production build passed (build before
the final atomic insert adjustment; final typecheck/integration passed afterward).
The DB test caught a concurrent Prisma upsert race; replaced with native
`createMany(skipDuplicates)` and reran successfully. No real push was sent.
Actual local ADMIN shows two columns,2259 balance/15000 request and «К выдаче
15000 · Касса Чеченова», without «Показать Астемиру». Request is labelled local
fixture; balance and native evidence are live read-only1C. Screenshot:
`/tmp/delivery-admin-auto-20260929.png`.
Buyer screenshot `/tmp/delivery-buyer-auto-20260929.png` shows2259 and «Можно
получить15000 · Касса Чеченова», no issued history. ADMIN312px and buyer764px
checked without horizontal overflow; native status is visible on both. Source
queries coalesce while in flight and cache only after completion to avoid duplicate
reads during a slow1C response. Actual employee device delivery and production
notification archive counts remain unverified until the release gate.

Scoped changed source files for this local follow-up:
`components/ProcurementDeliveryAdmin.tsx`, `ProcurementDeliveryCash.tsx`,
`ProcurementDeliveryLink.tsx`, `ProcurementDeliveryNativeStatus.tsx`,
`ProcurementDeliveryPanel.tsx` (all five under components);
`lib/procurement-delivery-native.ts`, `lib/procurement-delivery-native-source.ts`,
`lib/procurement-delivery-notifications.ts`,
`lib/procurement-notification-lifecycle.ts`, `lib/workday-notifications.ts`.
Tests: delivery cash/funding-UI/native/native-source/native-UI/panel,
`tests/procurement-delivery-notifications.test.ts`,
`tests/procurement-delivery-notifications.integration.test.ts`,
`tests/workday-notification-lifecycle.test.ts`. Do not stage adjacent unrelated
procurement admin/advance-review changes with this work.

**Not committed or deployed. No production morning push is queued yet.**
Production stays `a2a6f0b...`; release requires owner acceptance of this exact
screen, then runtime/subscription/queue verification without an immediate send.
Do not claim08:30 delivery has been scheduled until production readback confirms.
If release occurs after that time, clarify the missed schedule before activating
the push. Delivery also depends on an active device subscription and connectivity.
Progress54.8→54.8; no progress IDs/stages/ledger events changed. No autonomous
order/contact/spending or1C-write authority added. Owner authorized only this
specific Astemir push and the approved portal behavior. Other dirty files untouched.

## Release in progress — owner approved29 Sep01:34MSK

Code commit `406057ee9fc14d59cb10cf3ba3ac395db31e46b0` created and pushed on top
of the newer live `e977c2081c80aa30ddeba09fdd7b85d98a2840c4`, preserving that
release's ADMIN procurement workspace and QR poster changes. Final local build
and typecheck passed;84 server/source tests,47 UI/render/adjacent tests and3
isolated PostgreSQL integration tests passed. Explicit owner approval for sudo
Terminal received; deploy log `/tmp/delivery-auto-deploy-20260929.iD1jVE/deploy.log`.
No final production success claim until log DONE, exact HEAD, health, browser
and delayed queue readback are checked.

Two unrelated overlapping WIP files were saved before the fast-forward in Git
stash `1c9a3bc287a933799df3dc88bcde63f3582c411c`, named
`preserve unrelated admin procurement WIP before delivery release 20260929`:
`app/(dashboard)/admin/procurement/AdminProcurementClient.tsx` and `page.tsx`.
They are NOT lost or included in the release. Do not blindly pop this stash:
the approved upstream layout changed the same files. Future continuation must
integrate only those WIP intentions with the newer layout, preserving both.
Other unrelated tracked/untracked changes stayed in place.

Planned rollback image `offonika-portal-rollback:before-delivery-auto-406057e`.
Rollback must cancel pending/retry `procurement_delivery_ready` notifications
before starting old code: its dispatcher does not know the native permission
gate. Preserve notification rows/history and all business records. No DB restore,
env change, migration or1C write is part of this release.
Operational checker `scripts/procurement-delivery-notification-check.ts` is
read-only by default; `--queue` invokes only the idempotent producer and never
dispatches a push. Existing minute timer performs the actual morning delivery.

## Release completed29 Sep2026 01:41MSK

- Live code: `406057ee9fc14d59cb10cf3ba3ac395db31e46b0`. Independent SSH
  confirmed exact HEAD; pre-existing untracked `.rollback/` preserved.
- Only portal-app rebuilt/restarted, healthy. External `/api/health` returned
  `{"ok":true}`. Deploy exit0/DONE. Actual server production build passed.
  Source-only delivery smoke complete, persisted=false. No migrations/env/uploads
  changes, other service restart or1C business write.
- Producer preview reported ready, active employee subscription1, push configured.
  Authorized queue creation and independent readback confirmed notification720:
  status/pushStatus pending, scheduledAt/nextPushAttemptAt
  `2026-09-29T05:30:00.000Z` (=08:30MSK), sentAt=null, pushDeliveredAt=null.
  No test/immediate push dispatched. Actual morning device receipt is still
  unverified and depends on retained permission and device connectivity.
- Existing minute notification timer and5-minute delivery timer active,
  notification service Result=success, ExecMainStatus=0. Automatic lifecycle
  reconciliation reduced Astemir's unread count14→3;11 procurement alerts retired
  without deleting history. No manual bulk marking-read was used.
- Authenticated production ADMIN browser shows real request15000, real comment,
  balance2259 and compact two-column «К выдаче15000 · Касса Чеченова». No manual
  “show buyer” button. Screenshot `/tmp/delivery-auto-production-20260929.png`.
  Production buyer login was not impersonated; buyer UI was verified locally
  against live1C before release. Full/partial issue transitions tested with fixtures,
  not by creating a real расходник. Native approval is still done in1C.
- Saved rollback image above confirmed by successful script. Preserve WIP stash
  `1c9a3bc...` and remaining dirty/untracked work. No new checkout was created.
- Progress54.8→54.8, no evidence-stage IDs changed. No autonomous purchasing,
  order/contact/spending or1C-write permission enabled. Specific owner-approved
  employee notification is queued; no additional morning monitoring automation
  was created.

Next step is normal operation: the morning dispatcher must recheck eligibility,
then send or suppress the push. For owner-requested delivery verification, run
the checker read-only; do not resend notification720 or rerun a blanket dispatcher.
