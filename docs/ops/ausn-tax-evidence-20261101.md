# AUSN tax evidence — status 2026-11-01

Phase: tax reconciliation and additive portal presentation.
Classification: APPROVED CHANGE (owner requested separate FNS recognition and
internal bookkeeping issues, plus VTB/115-FZ legal sources).

Implemented on codex/ausn-tax-evidence:
- An additive panel in the existing reconciliation tab. Existing cards, month
  comparisons, counters, actions and report values remain in place.
- Document-backed cases, explicit unknown FNS bases, four conservative statuses,
  separate internal notes and documentary links.
- Recognition requires resolved payment identity AND complete FNS review;
  missing 1C documents and amount/date candidates cannot prove omitted income.
- Latest archive-only CORRECTION_EVIDENCE with name AUSN_tax_evidence_*.zip is
  read after admin authentication. DB checksum, archive bounds, schema and known
  document references are checked. No DB migration or background task.
- VTB/115-FZ explanation links to Law17-FZ arts3/6/7/12/15, FNS acquiring guidance
  and CBR restriction guidance. Individual restriction cause/date stay unknown.

Unchanged: canonical runner/calculations, FNS, Telegram, 1C, existing UI behavior.
No private bank payloads or source documents belong in this source repository.
Evidence is in the authorized portal archive (separate AI Business OS task).

Validation: 15 focused tests passed; isolated Prisma generation and TypeScript
passed; production build passed; panel rendered and visually inspected locally.

Production released 1.20.5 / 1318137fa7cae3df64697a331c03bec07e685bbb.
Owner explicitly authorized sudo for this release. Native Terminal used for
owner password entry; no password handled by agent. Fresh baseline was live
1.20.4 / 8cd33dd, preserved. Public builtAt2026-11-01T09:42:39.566Z, authenticated
reconciliation/version label and /api/health independently verified. No migration.
Current image c10538c221d9972e5648f58dbaeb77fada41be786b45daae85406037d51311de
reported running/healthy. Registration of verified reserves FAILED: previous
registry image797678d4407169f652e568b9f3d71d5fc71505dbf560beb872aabb9f23337c41
was missing after build, despite the initial three-image gate passing. No prune,
registry substitution or reserve recovery performed. Registration remains open.
Fresh FNS export and per-case findings archived as stage16, portal document
cmvxnkr3g004mb6v2bw2ny90t; downloaded bytes verified by SHA256. No source data
is committed here. All five final tax-inclusion statuses remain unresolved;
known bank lines and original receipts do not include their credit components.
Do not portray this as proof that no incorrectly-labelled alternative receipt
exists. Numeric maximum-limit scenarios are not implemented in1.20.5.

Investigation remains open: obtain missing bank registries and establish actual
FNS recognition, rather than labelling bookkeeping errors as tax omissions.

Owner-approved follow-up: manager overview with two limit scenarios.
Local candidate code225ac29, based on latest production1.20.6 branch (merged,
no existing behavior removed). Adds an overview block; no runner/Telegram/FNS
or1C changes. Uses an optional archived FNS snapshot plus the existing runner's
Jan–Mar2026 baseline. Displays FNS/VTB-hypothesis balances and the stricter of
existing runner balance and VTB scenario for planning. Unknown/partial-year
sources do not invent annual balances. Explicitly not a global maximum for all
unresolved income. The current snapshot and full calculation are in stage21
archive; no private financial sources are committed here.
Validation:8 focused tests, TypeScript and production build passed; actual new
component rendered with saved source values, desktop preview inspected.
New overview block NOT deployed. Separate sudo release approval pending;
previous authorization was explicitly for the1.20.5 release. Recheck live and
latest deployment branch immediately before choosing a version. The later
1.20.6 deployment/recovery evidence is in kkm-empty-shift-release-20261101.md;
do not repeat the older missing-image diagnosis as current without a fresh gate.
