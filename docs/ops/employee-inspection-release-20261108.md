# Employee inspection / actual PWA state — release 1.21.47

## Approved scope

Owner approved release after read-only verification. Runtime commit
`525d9419625502a5bc48a89b8cad2b101a18a8c4`, based on verified1.21.46/d9d8adc.
The actual employee components now share one experience provider in ordinary
Workday, Procurement and actor-bound ADMIN inspection. Help/setup/header/cards
are reused, not a second recreation. Opening help, bell, forms or calendar in
inspection cannot acknowledge/read/save/finish/register push for the employee.
Original inspection form-access exceptions are preserved.

Selected employee connection facts do not borrow this ADMIN browser's permission
or a different employee/device subscription. Private no-store GETs require the
opening ADMIN and active30-minute visit. Exact bound browser IDs only; no IP/UA
physical-device inference. Sensitive session/subscription data is omitted.

The existing employee observation heartbeat now reports bounded actual PWA setup
state, busy/error and connectivity. Visible updated PWA normally reports about
10seconds; inspection polls every5seconds while visible. Freshness uses server
receipt time (30seconds), not the phone clock. Disconnected/background devices
are explicitly last-known, not fabricated current faults. No screen recording,
OS dialog, unsaved field or arbitrary error capture; no new employee permission.
Older clients show dated observed connection facts. Rollback400 format fallback
retains ordinary activity/update reporting; offline legacy diagnostics may remain
unknown until the next contact. Current app/device updates keep existing CAS guards.

No schema/migration, financial/check/shift policy, schedule-reminder wording,
1C/OFD, payroll, env, upload or service/timer configuration change.

## Verification before installation

Final fresh release source: production build, TypeScript, diff whitespace passed.
Focused tests42:41pass,1preexisting fixture-specific skip,0fail. Separate actual
PostgreSQL tests3pass; real authenticated HTTP/PostgreSQL tests2pass; release
metadata5pass.302 Workday regressions passed in the relevant regression runs;
groups overlap and are not summed as unique tests. The skipped existing targeted
update test expects a different disposable DB; new actual DB CAS/update tests pass.

Real local mobile390x844: same guide as ordinary employee login; Retail/Wholesale
4points, Procurement3points; question mark, bell, notice/back, selected connection,
three Procurement tabs, Phone/Computer and previous-day4-reason/no-time form.
Blocked save/finish/acknowledgement retained. Actual ordinary synthetic PWA reported
setup state; inspection followed it and became explicitly last-known on closure.
Document375px <=390px viewport. No physical employee phone/native push acceptance
or every financial form tested; no real employee business action used as smoke.

Logs: `/tmp/mobo-inspection-release-{build,tsc,focused,db,http,metadata}.log`;
local screenshots `/tmp/mobo-pwa-inspection-20261108/`.

## Installation / independent proof

Installed8November2026. Public metadata1.21.47, builtAt
`2026-11-07T21:52:49.761Z` (00:52MSK); revision/source remain null/unknown because
Docker excludes.git. Independently verified exact VPS HEAD525d941 and running image
`sha256:3cab9c9029d11ee33b2426da635677534c2ac56dda33e64a49df41c42bb180a9`, healthy;
public `/api/health` ok. Authenticated ADMIN and employee About both show1.21.47.
Production Muhamed inspection shows the actual selected iPhone's dated
«Не подключены» observation07November18:14MSK and approved notification banner,
question mark/three-point guide, bell/empty new-list/back, disabled preview logout.
No current live employee observation was invented while his PWA was offline.

Before/after checks retained1571existing notification read markers,157workdays,
713plans,558tasks,10users/9templates/5cashbox mappings and324mature upload files;
cash operation count104 unchanged. env, mounts and notification unit/timer definitions
unchanged. No pending/new migration allowed. Only portal-app built. Final post-UI
comparison passed with the same preserved counts. Independent verification marker
released the worker to register the verified image and run the existing bounded
storage policy. Current1.21.47 plus verified1.21.46 and1.21.45 images all exist;
18.95GiB free, `RELEASE_VERIFIED_AND_REGISTERED`, `RELEASE_EXIT=0`, finalhealthy.
No other chat was messaged or restarted. Original dirty worktrees left untouched.

Operational evidence: `/home/bela/mobo-inspection-1.21.47-release.log` and
`/root/mobo-inspection-1.21.47-20261108/`. Native reviewed Terminal launcher
`/tmp/mobo-inspection-1.21.47.command` ran the exact root worker and waited through
independent verification. Production screenshots:
`/tmp/mobo-inspection-release-20261108/production-muhamed.jpg` and
`/tmp/mobo-inspection-release-20261108/production-help.jpg`.
Physical employee iPhone remains the final device acceptance check.

## Separate authorized Astemir schedule repair — completed before release

Owner explicitly requested undoing all trial changes8–30November. Journal showed
8November unset→working at00:07MSK, then8–30November→off at00:20. Exact guarded
Serializable repair restored23originally empty dates, preserving historical
changes and adding23standard ADMIN unset audit entries. Isolated fixture test and
production rollback dry-run passed before applying. No other schedule, actual
workday, cash row or notice read marker changed; no extra push dispatch.
Authenticated production inspection confirmed «Сегодня и завтра не заполнены».
This data repair needed no portal restart/version change.
Evidence: `/home/bela/mobo-astemir-restore-20261108.log` and root backup
`/root/mobo-astemir-restore-20261108/`; local screenshot
`/tmp/mobo-astemir-restore-20261108/production-reminder-restored.jpg`.

## Deferred next stage

Owner asked to handle AFTER this release: identical exact missing-day qualifier on
Workday, Schedule, Procurement and Salary where applicable. Filling one day must
immediately leave only the actual remaining missing date. Investigate shared
EmployeeActionReminder versus Workday attention row; do not silently rewrite
other notice copy or calendar policy. Solo-department staffing notices stay deferred.

## Exact changed files

- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `app/api/admin/employees/preview/[visitId]/route.ts`
- `app/api/employee/work-help/route.ts`
- `components/EmployeeInspectionDevice.tsx`
- `components/EmployeePreviewProvider.tsx`
- `components/EmployeePreviewViewport.tsx`
- `components/ProcurementMobileCabinet.tsx`
- `components/workday/EmployeeAppSetupProvider.tsx`
- `components/workday/EmployeeExperienceProvider.tsx`
- `components/workday/EmployeeWorkHelp.tsx`
- `lib/employee-inspection-state-server.ts`
- `lib/employee-inspection-state.ts`
- `lib/employee-navigation.ts`
- `lib/employee-preview-request.ts`
- `lib/employee-work-help-reader.ts`
- `tests/employee-inspection-parity.integration.test.ts`
- `tests/employee-inspection-state.test.ts`
- `components/PortalAccessTracker.tsx`
- `lib/portal-app-client.ts`
- `lib/portal-app-observation.ts`
- `lib/employee-ui-client.ts`
- `lib/employee-ui-observation.ts`
- `lib/portal-observation-request.ts`
- `tests/employee-ui-observation.test.ts`
- `tests/employee-ui-update-safety.integration.test.ts`
- `package.json`
- `package-lock.json`
