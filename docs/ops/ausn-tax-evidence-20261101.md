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

Production publication is NOT yet performed. Live source readback was
928daa2b4529bf598f5801b302e0f39224c781f1, public version1.20.3. Deployment branch
also contains a later payroll caption change/version1.20.4. Recheck both before
release; do not silently ship, discard or overwrite concurrent work. No release
number is reserved here. Production Git refused the diagnostic due ownership;
no safe.directory exception was added. Read-only .git/HEAD was used instead.
VPS changes requiring sudo need exact owner authorization and owner-entered
passwords in native Terminal under persistent instructions.

Investigation remains open: obtain missing bank registries and establish actual
FNS recognition, rather than labelling bookkeeping errors as tax omissions.
