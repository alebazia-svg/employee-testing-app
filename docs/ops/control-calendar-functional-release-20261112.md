# ADMIN day accounting consistency — functional release, 12 November 2026

Status: tested local candidate; production installation pending. Owner explicitly
stopped redesign and approved the important earlier functional correction only.
Release candidate 1.24.10 is derived from exact live 1.24.8 / 81c801b, retains the
separate approved preview fix 993ca11 (1.24.9), and current guarded release tools.
Queued unrelated maintained-branch runtime/schema/Compose changes are excluded.

Scope: Calendar, Day Control and Home share committed WorkDayEntry QR evidence
and audited working-day corrections. Unconsumed/expired QR intents are excluded.
Department close remains Retail20:00, Wholesale19:00, Procurement18:00 Moscow.
Saved plans, real active/completed/unclosed shifts, genuine issues, money, payroll,
notifications and source policy are preserved. Only no-workday settled accounting
clears the obsolete expected-start state/timing. Manual working accounting never
fabricates active presence. No schema, startup, Compose or feature-flag change.

No redesign, CSS, new navigation, comparison wrapper, fixtures, demo clock or
Google source adapter enters this release. Existing layout and operational labels
are retained; factual source and short settled state are wired to existing UI.

Verification:121 targeted tests and TypeScript/build passed. Actual authenticated
HTTP/Postgres transitions passed in all3departments:wrong department, scan/abandon,
retry/reuse, expiry409, successful start, duplicate/idempotent start, finish.
Calendar, Control and Home checked after transitions. Initial original fixture
plans/workdays/vacations/cash/notifications/checklists/correction rows unchanged.
Evidence:/tmp/control-release-workflow.log and /tmp/control-functional-tests.log.
Tests run in isolated control_release_review, not production. Original interface
and employee detail inspected: automatic off retains the original saved working
plan; real unclosed shift remains visible. Physical iPhone not tested.

Additional boundary tests verify source-read errors propagate rather than invent
days off, QR-only intent cannot alter calendar, cutoff±1ms for all departments,
late accepted start, vacation, future dates and genuine independent issues.

Installation, immutable image identity, storage capacity, actual public metadata,
authenticated production UI and rollback reserves still require release checks.
No readiness/zero-risk guarantee is made before those checks.
