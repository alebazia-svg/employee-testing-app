# Independent cash intent and original photo — production1.21.24

Released2026-11-04 under explicit owner approval for the portal update and the
four nullable CashOperation fields. Runtime/server commit:
`f0f63e57b4fcb493730f0f9a3db84e2c9c380c17`; cash implementation `ad8f48c`.
Public build2026-11-04T19:15:30.809Z (22:15 Moscow).
Running image `sha256:fe6f54339c4591657f6e35c236d2f7693c91d77ef3e9304f754d20b6900014ab`.

## Behavior and preservation

Durable small monetary intent starts the existing protected1C preview/confirm
pair independently of original-photo transport. UUID remains the financial key;
new actual transfers at the same amount are permitted. A last-seen operation
baseline serializes stale/concurrent drafts; ambiguous drafts need clarification.
Original JPG/PNG/WebP bytes resume in512KiB parts; exact size/hash/photo receipt
is required before discarding the retained local file. Existing8MiB cap remains.

The employee continues other work after server acknowledgement. ADMIN separately
sees missing photo and monetary state; existing thumbnail/enlargement remains.
Legacy multipart and v2 photo-first storage-failure fallback are supported.
Closed-origin late monetary intents stay ADMIN-controlled; late photo attachment
never creates/retries financial documents. Scheduled financial retry stays OFF.

No new manager field, task or additional required click was introduced. Calendar,
payroll, receipt matching, handover templates, navigation and1C extension were
not changed. The installed1.21.23 OFD collector and notification units were kept.

## Verification

- Server commit, public metadata/API health and authenticated ADMIN version agree.
  Public revision is still null/source unknown under the existing Docker build;
  actual commit was independently read through SSH.
- Exactly79 earlier migrations were complete; only
  20261104210000_cash_intent_photo was pending. Applied successfully as migration80.
  Four fields exist and are nullable; all existing rows remained null immediately
  after the ALTER. No manual amount/document/history rewrite.
- Private custom-format DB backup was created on the VPS before migration.
  Protected snapshots of95 pre-existing CashOperation rows (all original20 fields)
  and past-workday facts compared identical after restart.
- Every original runtime environment value, server.env hash, volume mount and
  existing OFD/employee-notification unit hash compared unchanged. The only added
  runtime configuration is CASH_OPERATION_METADATA_FIRST_ENABLED=1.
- ADMIN employee card and original RKO/PKO/photo remained available after upgrade.
  Actual original image loaded at3024×4032. Existing manual review/history remains.
- OFD collector remained enabled/active; installed service successfully ran
  at19:23:02–19:23:07UTC after the new container became healthy.
- Repeated local Workday267+10 pass; Fiscal294+2 pass/1 optional live fixture
  skipped; targeted DB/photo4 and durable KKM7 pass (KKM7 overlap Workday);
  release-info5 pass; actual HTTP1 integration/14 checks pass; typecheck/build pass.
  Cases cover identical sums, different UUIDs, retries, lost/chunk responses,
  corrupt/foreign attachments, closed shifts, legacy/full-photo fallback and
  local storage failure. New monetary tests used isolated PostgreSQL/fake1C only.
- Physical iPhone/background-camera/weak-mobile-network checks remain unverified.
  No artificial financial operation was sent to production during release checks.

Release workflow exited0 and registered the independently verified current image.
Current plus two verified reserves exist; final free space18.53GiB. No image,
volume, upload or financial-history cleanup was performed by this release.
Reserves: `sha256:242a2ad2dc9a810fa28f521d41752a79f6643deab468dc635a152dfb64347d53`
and `sha256:29f92435db1574c30fd5571e508d64acb4dd8a8637a98d597430295b3bf0f8cf`.

## Recovery boundary

Never restore the old photo-first API/client while v2 photos are waiting: an old
receipt can incorrectly acknowledge metadata alone. A compatible current runtime
can set CASH_OPERATION_METADATA_FIRST_ENABLED=0 for NEW submissions; already
retained v2 queues keep their attachment protocol and original UUID. This was
checked locally; production uses the approved normal value1. Changing recovery
configuration/performing rollback remains an explicit operations action.

The migration is additive and stays in place during recovery. Never delete or
rewrite old documents/photos, clear employee IndexedDB or enable financial retry
as a shortcut. The old runtime reserves are retained but are conditional recovery
artifacts; follow the compatibility boundary before using either image.

Evidence: /tmp/mobo-cash-photo-12124-{production-release,production-result}.log,
/tmp/mobo-cash-photo-12124-release-info.json, /tmp/mobo-cash-photo-12124-production.jpg;
VPS /home/bela/cash-photo-12124-{release.log,result}, private protected snapshots
and /home/bela/portal-backups/cash-photo-12124-before.dump. No private exports
were added to Git. Implementation file list:
../codex-memory/cash-intent-photo-candidate-20261104.md.
