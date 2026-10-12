# Technical health outside owner attention — 2026-10-12

Status: released with explicit owner approval as production **1.4.8** on
2026-10-12. Runtime commit `bbee494c2f372e7b529f9392a481f0614df2d095`.
Supersedes the 1.4.6 long-outage owner-summary policy. The previous production
release 1.4.7 was reconciled before preparing this patch.

## Approved decision

The bell and its badge count owner business decisions, not unresolved technical
health. Remove the synthetic prolonged-outage aggregate and its repeated pushes.
Retain actual technical events and stale expense-sync evidence in System. Reading
an event must not claim source recovery. Financial request, accountable funding,
cashier issue and scheduled payment reminder behavior stays unchanged.

Scope does not include repairing sources/disk, resolving historical production
records, adding a new one-time incident acknowledgment mechanism, or creating
new section-level warnings. Existing source data and history are preserved.

## Verification

- 68 focused unit tests and five isolated PostgreSQL integration scenarios pass.
- Regression asserts long/unread/read technical incidents contribute zero owner
  attention and no digest sends, including next day; System retains active
  incidents until recovery. Expense stale-source evidence remains inspectable.
- Existing financial request, buyer, cashier, multiple-device, retry and
  reminder lifecycle scenarios still pass.
- TypeScript and isolated production build pass; git diff check clean.
- Actual local demo checked at normal/mobile layout and 1280px desktop: three
  business tasks produce badge 3 despite a separate System incident. Bell has
  no technical aggregate; System keeps the active incident and explains scope.
- Screenshot: `/Users/bela/.codex/visualizations/2026/10/12/cash-issue/technical-bell-separated-desktop.png`.
  All shown financial records are isolated demo examples, not production tasks.
- No production data changes, test pushes, schema, 1C or unrelated edits.
  A previously delivered OS summary is cleared by the existing app-open flow
  when attention becomes empty, or replaced by the next legitimate summary;
  this correction does not remotely erase an already displayed OS notification.

## Changed runtime and test files

- `lib/admin-inbox-attention-policy.ts`
- `lib/admin-inbox-attention-push.ts`
- `lib/admin-inbox-data.ts`
- `app/(dashboard)/admin/inbox/AdminInboxListClient.tsx`
- `tests/admin-inbox-attention.test.ts`
- `tests/admin-inbox-attention.integration.test.ts`
- `tests/admin-inbox-source-health.integration.test.ts`

## Production release evidence

- Previous commit `c56786c08b500613de28089e8ead05e12710fc89`, version 1.4.7.
- Previous image `sha256:5fa62360f2c70ad9e092196f99b678b4ab98b6608c180471088100e488651513`.
- Preserved rollback tag `offonika-portal-attention-rollback:pre-1.4.8-20261012`.
- Replacement image `sha256:0307cf2c22adfd42f2a55d3cd0e46f2d05bb4b1fc3f8025badfd0cb92685b168`.
- Both public hosts report version 1.4.8, builtAt `2026-10-12T17:10:07.811Z`.
  Metadata revision remains null/source unknown; exact server commit independently
  verified via SSH. Authenticated ADMIN displays 1.4.8 / 20:10 MSK.
- Server build and deployment exit 0, container healthy, public health ok.
  Existing uploads, procurement snapshots and T-Bank runtime mounts preserved.
  Only portal-app rebuilt/restarted with server.env. Schema/compose/Dockerfile
  unchanged, so preserved-image rollback requires no database restoration.
- All three expense sync / ADMIN sender / employee notification timers active;
  observed last service executions successful with exit 0. No manual sender run.
- Real ADMIN attention shows zero business tasks and no bell badge; opening the
  bell shows the empty business state. System retains nine existing diagnostic
  items. Their presence is not proof of nine currently verified source failures;
  source-health repair and misleading diagnostic wording are outside this patch.
- Screenshot: `/Users/bela/.codex/visualizations/2026/10/12/cash-issue/production-148-bell.png`.
- Five release metadata tests also pass. No new physical-device push test after
  1.4.8; preceding owner test on 1.4.7 confirmed transport and target opening.
- Deploy transcript `/tmp/mobo-technical-bell-148.log`, exit file 0.
  Server retained pre-existing untracked `.rollback/`; unrelated primary checkout
  files were untouched. `package.json` and both package-lock version fields are 1.4.8.
