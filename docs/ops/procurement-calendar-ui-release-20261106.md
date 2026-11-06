# Approved payment-calendar interface — 2026-11-06

Owner authorized the complete locally approved scope and release after preservation checks.
Candidate version1.21.41 /61f2ecfa3a34b2336d3fcc46a15e9b99acb04867,
based on current deployment branch e179145 (runtime1.21.40 /72106d3).
Installed. Server commit, public metadata and authenticated ADMIN version/UI verified.
Verified-image registration completed; remote release status EXIT=0.

## Approved interface

- Both ADMIN and buyer: one persistent course/1C/receipt toolbar across current,
  planning and history tabs. Desktop compact row, readable mobile placement.
  Course icons reflect confirmation for today; earlier quotes retain their dates.
  No day switch; last approved quote remains available without current requests.
- Global quote display is now wired into actual calendar components, rather than
  relying on a local preview provider. An additive read-only overview mode returns
  latest revision per currency at/before today. Existing exact-day reads and all
  preview/confirm financial transactions remain unchanged.
- Dated 1C/saved paid-request references remain gray, never treated as approved
  daily quotes. Ambiguous/unknown/future references do not invent a current course.
- Each submitted/approved FX request shows its saved course and RUB equivalent.
  Shared current quotes never rewrite historical/partial payment terms on reads.
- History uses compact rows, aligned receipt states and one date heading per day
  on phone. Separate request foreign amounts and independently observed RUB/USDT
  payments; never infer paid foreign units from a RUB expense alone.
- One detail money group, visible comments, source expense number/date and files.
  Repeated narrative removed. Prior approval warning and change events remain in
  collapsed history. Completion reasons, unpaid remainder and reopen action retained.
- Current buyer request opens as a content-sized phone sheet with internal scroll,
  all facts/documents and fixed close/edit actions. Edit/cancel returns to details.
  Desktop disclosure stays inline and compact. Native focus/discard behavior retained.
- Receipt queues use the same phone sheet in both roles. Each row keeps its own
  supplier/date/payment and existing add-receipt handler. QR/requisites never count
  as a paid receipt. Multi-expense coverage and upload/retry/selection unchanged.
- Planning, source errors, Подотчёт, cash balances, transfer buttons, status/date,
  notifications, 1C matching and existing financial actions retained.

## Preservation / validation

- No schema/migration, 1C write, file reclassification, financial correction,
  notification policy, uploaded-file cleanup or unrelated module change.
- Compared with latest deployment branch: unchanged schema, 1C client,
  day-preparation calculations, receipt/document policies, share manifest,
  small-remainder rules and complete daily-course preview/confirm implementation.
-111 focused checks pass, including real isolated PostgreSQL daily-course
  persistence/races/rollback and exact two-plan document/share bindings.
  Five release-metadata checks pass; full production build passes on the merged
  current source with its own dependencies. A source-text receipt test initially
  rejected JSX prop order; original contract-compatible order restored and all85
  business checks rerun successfully. No semantic receipt-policy failure.
- Interactive actual components checked with a private read-only snapshot: both
  roles, current/history, desktop/phone; saved course, receipt queue and links;
  add-requisites editor, edit/cancel/re-entry. No real save/upload/message in preview.
- Local preview-only routes and private /tmp data are excluded from this release.
- Server gate checks rollback registry/images, >=15GiB available, clean exact source,
  1C availability and no pending migrations before build/replacement. Private backup,
  environment/mount checksums and independent before/after plan/document/event/rate
  hashes provide preservation evidence. Public/authenticated verification precedes
  verified-image registration. Existing images, volumes and uploads are retained.

## Rollback

Restore exact prior application image/source version through the standard runbook.
No financial rows, uploaded files, quote records or schema should be reverted.


## Production evidence

- Server source61f2ecfa3a34b2336d3fcc46a15e9b99acb04867, tracked checkout clean.
- Public release-info1.21.41, build2026-11-05T22:42:43.452Z (06Nov01:42MSK).
  Metadata revision remains null because Docker omits Git; exact source verified
  independently. Shared authenticated UI label shows1.21.41/01:42.
- Three verified rollback images existed before installation;19GiB free at gate.
  No cache/image/volume cleanup or migration was needed. Existing app kept serving
  until replacement. Private database backup retained in /root/mobo-calendar-ui-1.21.41.
- Independent before/after digests match for49 requests,25 documents, payment-plan
  events and daily-rate records. No migration-list change.1C returns200 and
  evidence-state counts match. server.env checksum and complete mount definition match.
- Actual authenticated ADMIN:2 pending,0 waiting,47 historical,2 receipt tasks;
  current per-request rates, global dated references and RUB equivalents visible.
  History has47 rows and2 needed-receipt marks. Source expense, retained approval
  context and exact plan's QR accessible in detail. Receipt queue has the same2
  suppliers; documents were not reclassified or sent.
- Actual deployed page checked at390x844: ADMIN receipt queue is a bottom sheet,
  historical detail has one financial group, close/re-entry work. Viewport reset.
  Buyer phone/desktop exact components checked locally; physical Astemir PWA login,
  real upload/payment/course confirmation and real messenger send were not mutated
  during production verification. Isolated persistence/binding tests cover those
  unchanged transaction paths. Anonymous overview endpoint correctly returns403.

- Final running image registered as verified:
  sha256:deffb76710cf00c0aa9e534ff1ef5af427ea939e9db2eb344141329ff91132da.
  Remote controller reports VERIFIED_AND_REGISTERED and EXIT=0. Prior rollback
  images remain under the existing retention policy. No production financial
  transaction, real file upload or employee message was used as a smoke test.
