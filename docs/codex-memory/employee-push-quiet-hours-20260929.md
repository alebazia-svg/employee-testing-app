# Employee push hardening — 2026-09-29

## Owner-approved rule

Employee push dispatch must wait from 22:00 inclusive until 08:30 Europe/Moscow
each day. This replaces the previous one-document morning deferral. Applies to
the existing WorkdayNotification dispatcher (including procurement), not ADMIN
push/Telegram. Next eligible morning dispatch rechecks business lifecycle and
current source evidence; cancelled, fully issued and resolved actions do not
produce a fresh collection invitation. Quiet deferral does not consume a retry.

Phase: launch hardening. Code committed as `7a3e8c4`; owner approved deployment
as the first of two sequential releases. Deployment readback is recorded below.
No new schema, migration, schedule change, device subscription change or 1C write
is part of this patch. The separate local access-journal migration is excluded.

## Implementation

- `lib/employee-push-policy.ts`: daily Moscow window, provider TTL capped at the
  next quiet-period start and safe neutral delivery push wording.
- `lib/procurement-delivery-notifications.ts`: all delivery document identities
  use the daily timing policy; source readiness and stable fingerprint remain.
- `lib/workday-notifications.ts`: global employee quiet gate, no attempt consumed
  by a night deferral, current-time check before each provider call, bounded TTL.
- `lib/workday-push-delivery.ts`: error/no-subscription/configuration retry times
  crossing the quiet window move to 08:30.
- `app/api/employee/workday-notifications/route.ts`: delivery bell content uses
  fresh amount/cashbox for the authenticated mapped user. On source uncertainty,
  it uses neutral wording, never an old stored monetary instruction.
- `tests/employee-push-policy.test.ts` and
  `tests/procurement-delivery-notifications.test.ts`: boundaries, rollovers,
  morning lifecycle, overlap/CAS, neutral delayed payload, auth and outage fallback.

The old delivery push TTL was 300 seconds. A neutral push may now wait for the
device until 22:00 without claiming that a cached amount is still available.
The actionable current amount/cashbox remain in the portal, revalidated from 1C.
No screenshot redesign is involved; only notification copy and timing change.

## Important limits

- The minute runner is polling, not a 1C webhook: ordinary detection is on the
  next successful run, not a promise of zero-latency delivery after document save.
- Collection requires a linked, payable request, not any newly created/unapproved
  request. The existing personal request-to-1C linkage is unchanged.
- HTTP 201 / internal `pushStatus=delivered` means the push provider accepted it,
  not that the employee saw a banner. There is no new browser display receipt.
- A phone without a subscription cannot receive push; the durable portal item
  remains. Existing bounded provider retries remain. There is no infinite replay
  of accepted pushes, no new per-device delivery ledger or alternate channel.
- The portal controls send time and provider TTL, not operating-system display
  scheduling, Focus mode, connectivity or notification permission.
- An account-level read event does not identify which person opened the message,
  especially when the owner uses an employee account on another device.

## Verification

14 focused policy/producer/dispatcher/bell-route tests passed; the existing
workday regression passed 152/152. Isolated PostgreSQL notification integration
passed (unique deferred row, atomic claim, cancellation). TypeScript and production
build passed. This notification release has no migration. On the merged production
base, 24 policy/producer/dispatcher/ADMIN tests, two ADMIN multi-device regression
tests and 152 workday tests passed; the production build passed again.

The existing checkout was fast-forwarded from 5b2543b to production base 668762c
before committing. Independent ADMIN multi-device push changes and procurement
width polish are retained. Only exact release files were staged; unrelated dirty
procurement source and local previews remain outside the release.

## Separately authorized one-time resend

Owner explicitly requested another real delivery notification, not a synthetic
test. Scoped operation: only notification 720 for the current mapped Astemir and
native request ed241171-bb79-11f1-8f11-002590803daf. Fresh collectible permission,
matching identity, already-sent/read status and CAS are required. Reopen the same
record as unread and queue its normal retry; do not create a duplicate or call a
blanket dispatcher. Save original fields to a private temporary rollback record
before CAS. A restoration is safe only before the dispatcher claims/sends and
must preserve any concurrent read/attempt. A transmitted push cannot be recalled.

Operation scripts/log: `/tmp/astemir-delivery-resend.lVVXTG/`.
Outcome must be read from that log before claiming successful requeue or send.

Confirmed operation outcome: preview passed; CAS queued the existing row at
2026-09-29T07:07:27.564Z; independent readback after the minute dispatcher showed
attemptCount 1→2, pushStatus=delivered, pushDeliveredAt=07:08:01.941Z (10:08 MSK),
readAt=null and lastError empty. Exit 0. This confirms provider acceptance and an
unread portal item, not an employee-visible system banner. Only notification 720
was requeued; no 1C document, new notification, other account or subscription changed.

The owner subsequently confirmed that the notification appeared, without sound.
This is a user-observed display confirmation for this resend, not automated
delivery telemetry or proof of delivery to Astemir's own device. No further resend
or operating-system setting change was made in response.

## Production release

On 2026-09-29 the owner approved and released code `7a3e8c4` on top of `668762c`.
The server build completed, container became healthy, public health/login/portal
smokes returned 200, the installed helper passed the exact 22:00/08:30 boundary
checks, and both notification/delivery timers remained active. An independent
service status read reported Result=success and ExecMainStatus=0. No synthetic
push, blanket resend, schema migration or subscription change was used to verify
this stage. The subsequent access-journal release retains this patch.

Operation log: `/tmp/portal-push-access-release.SqUxUV/deploy.log`.
Rollback image: `offonika-portal-rollback:before-push-access-20260929`.
