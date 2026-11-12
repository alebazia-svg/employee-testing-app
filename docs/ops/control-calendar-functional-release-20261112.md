# ADMIN day accounting consistency — functional release, 12 November 2026

Status: tested exact image; production installation STOPPED before transfer by storage safety gate. Owner explicitly
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

## Approved installation attempt — stopped safely

Owner explicitly approved one existing-policy storage maintenance pass. One native
Terminal sudo session started worker4c5022641014441f913501d64129a787 with plan SHA256
c7c762ff3ae7d259d77680c12535f6c926b013ba75cb929b76d8208753e474ae.
No archive was uploaded. Events reached STARTED/CAPACITY_DETAIL then FAILED at7.1s:
`Command failed: /usr/local/sbin/portal-storage-maintenance (exit 1)`.

Required before transfer:19,930,910,685 bytes. Available at check:18,673,745,920;
shortfall1,257,164,765 bytes. Available after failure remained below requirement.
No READY_FOR_TRANSFER or installation stage occurred. Child stderr is intentionally
not included by Host.run; ordinary SSH cannot read privileged journals, so exact
internal maintenance exception is unverified. Do not claim all eligible cache was
exhausted. Do not repeat cleanup or ask another password without diagnosing the
failed attempt and reviewing the next exact action. No guard bypass is permitted.

Independent public verification after failure:health ok:true, release remains
1.24.8 /81c801b46333b1dbc4f356d75923af1b91123597. Incoming directory empty.
No rollback needed, no new image registered. Original app was not replaced.
Exact tested image and bundle retained locally for a later reviewed retry:
version1.24.10,target37443e4a2f832a723a448c0ed2103159cd11127a,
image sha256:0a2fb173a3c1b1498ec8a3613c9f73552570b682bdd99ac12b8369466ee1c50f,
/tmp/portal-control-functional-1.24.10-bundle.
Exact-image API acceptance passed all3departments before installation attempt.
