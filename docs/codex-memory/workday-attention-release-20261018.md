# Workday control and employee attention — 1.7.0

Status: released and independently verified on 2026-10-18.
Target: team.mobo-opt.ru; source origin/design-local-updates.
Runtime source: 949447ddebf383e9cd1308787f4ce9753829f67d.
Previous runtime: 7c2a03ca78f236ce681c5b87c0d8720565846a78 (1.6.1).

## Scope

- ADMIN action queue and focused issue dialog; grouped shift review, cash result
  table, timing and photo evidence. Preserve factual entries and unfinished work.
- PWA current-action line and one replacing bottom sheet, direct opening for one
  item, distinct employee-action/waiting groups, shared-task responsibility and
  admin replies. Read notifications do not remove unfinished work.
- Bell retains the general notification inbox, including checklist reminders.
- Standard technical reasons need no comment; `other` still requires one.
- Approval without encashment is final for that shift, displayed neutrally.
  Later cash operations never rewrite those approvals. New shifts evaluate only
  their current physical balance: above 50,000 RUB requires encashment.
- Keep server-side automatic closure after ADMIN approval, independent of phone.
- Preserve unresolved credit issues on incomplete source reads; show specific
  receipt/document causes and reuse existing employee action endpoints.

No Prisma/schema/migrations, production-data edits, uploads/env changes, 1C
writes/publication, payroll or OFD changes. Latest 1.6.1 payroll/access/ops work
was preserved by basing the release on fresh origin/design-local-updates.
Surplus/shortage linkage and cash-inventory documents remain future work; no
synthetic cash examples or local preview switches are in production code.

## Verification before deploy

- TypeScript and production build passed on the latest deployment branch.
- 41 focused workday tests plus 5 release-info tests passed.
- Actual production-mode local build (port 3191) against a separately cloned
  isolated PostgreSQL database: list/detail, shared review/help persistence,
  real-record rendering without preview parameters. Unauthenticated new API 401.
- Earlier isolated UI checks: one encashment opens directly with time; empty
  state; read-notice/unfinished-task separation; admin-reply return to action;
  closing request pending/rejected transitions without nested dialogs; ordinary
  checklist notice in bell; neutral approved-omission row in ADMIN.
- Earlier dedicated PostgreSQL closure suite: 10 scenarios passed, including
  no-phone approval, no financial documents, refusal, repeat/concurrent clicks,
  rollback and late phone draft protection.
- Physical-device push and cash inventory automation are not verified here.

## Deployment evidence

- Server HEAD verified: `949447ddebf383e9cd1308787f4ce9753829f67d`.
- Public release-info and authenticated ADMIN shared label: 1.7.0;
  builtAt `2026-10-18T19:11:45.417Z` (22:11 Moscow).
- Public health HTTP 200; container healthy; deploy and remote exit 0.
- Authenticated production action queue rendered with current real records.
- Full database/upload mount comparison unchanged; no migration.
- Previous image: `sha256:96306282dfffe137816db345f0390f9ce24690ec2ca19c2809c04893e644c291`.
- Replacement image: `sha256:dad40fca566b14555cae2f3dee34dffcb73c512f1acbe270587b09f6ee033c4f`.
- Previous image retained as `portal-app:rollback-before-1.7.0`;
  schema-compatible rollback. Verified-image registry registration succeeded
  after independent verification. Existing untracked VPS `.rollback/` preserved.
- New owner request to compact overview counters is separate local follow-up;
  it is not included in 1.7.0.
