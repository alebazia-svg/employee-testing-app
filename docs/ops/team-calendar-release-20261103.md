# Team calendar — production 1.21.20

Owner approved two exact changes, saw the real local application and explicitly
approved a separate release after1.21.19, conditional on regression verification.
Runtime/server commit: `c93687b25757c0eab961069fc5e4b9f15db0c5ac`.
Public metadata and authenticated footer agree on1.21.20, built
2026-11-03T18:36:30.212Z (21:36 Moscow).

## Approved behavior and retained baseline

- Include active EMPLOYEE accounts in Procurement, using the existing department
  label and the same week/month calendar and day dialog as other departments.
- In the primary calendar, a selected day with neither a saved app plan nor a
  valid Google plan displays `Нет записи`, instead of implying a Google record.
- This is a view-only caption. `resolveTeamSchedule.source`, app precedence,
  genuine Google fallback, vacation, source-outage state and the original app-only
  pilot rule are unchanged. Conflicting Google evidence retains its Google
  identity and unknown plan; it is not mislabeled as an absent record.
- Preserve raw app/Google layers, date selection, grouped empty days, dialogs,
  selected-date Workday links and all existing statuses and styling.
- Do not add seller shift checks or attendance-based salary to Procurement.
  No reminder, workday fact, payroll, financial match, receipt workflow, schema,
  migration, source credential, environment or upload change.

Implementation commits8b12b51 and92db6d9; merges retain independently released
receipt lifecycle1.21.19 and its documentation. The local Google provider fixture
existed only in a temporary preview copy; production keeps the original provider.

## Exact changed application/test files

- components/admin/TeamSchedule.tsx
- components/admin/TeamScheduleServer.tsx
- lib/team-control.ts
- tests/team-schedule-source.test.ts
- tests/team-calendar-render.test.ts
- package.json and package-lock.json (three synchronized version fields)

## Verification

After merging19:271 Workday tests,296 fiscal tests,61 calendar/navigation/source
tests, one real calendar server/render test and five metadata tests passed.
One optional live OFD fixture test was skipped because no fixture was supplied.
TypeScript and both exact candidate/isolated-preview production builds passed.
No known failing test remains. No real financial write was used as a smoke test.

Local authenticated app used disposable `team_calendar_preview_20261103`, cloned
from the previous isolated navigation demo. App precedence, genuine Google
fallback, empty and contradictory Google dates, week/month/source switching,
day dialogs, Escape/close and selected-date Workday navigation were checked.
At390x844 the page width375 did not exceed the viewport390; the monthly table
kept its intentional inner scroller. Physical-phone operation/push was not tested.

Independent production readback before/after on Nov1: all five existing plans
were identical; only Zalina's caption changed Google -> Нет записи. Two active
Procurement employees appeared. On Nov3, all seven employees had app-backed
plans with `Приложение` captions. The real Nov1 empty-day dialog also showed
Нет записи and closed without an edit. Source evidence is date-specific.

Evidence:
- /tmp/mobo-calendar-before-12120.json
- /tmp/mobo-calendar-after-12120.json
- /tmp/mobo-calendar-production-comparison-12120.json
- /tmp/mobo-team-calendar-production-12120.jpg
- /tmp/mobo-team-calendar-preview-12120.jpg

## Deployment evidence

Only portal-app rebuilt/restarted. Existing env/server.env hashes and upload
mounts matched before/after; the stored closed Nov2 day/checklist hash matched.
No migration or manual production business-data edit was performed. Both public
health endpoints returned ok. Exact server commit and live footer were verified.

Registered current image and two existing verified reserves, all present:
-20: sha256:d3eb916075151404fdc1d7e682b5c6c9fcb112da428776dc55c692a25cd11936
-19: sha256:0780f65ce8b2387caff627a7d8feaa1201477749f7b803f3415dfffcbd231bbe
-18: sha256:4ecc55d58e535fe27eb7d46988bb5551aafe07a86ad7825b52eb7db69e54af78

Final free disk19.88GiB. The deployment lock was released before registration.
The previously owner-approved bounded storage retention ran before the build;
no container, volume, upload, backup or unknown image was pruned.

Main log `/home/bela/team-calendar-12120-release.log` did not persist its final
two markers. A separate native-Terminal read-only journal audit authoritatively
confirmed at18:44:20UTC `RELEASE_VERIFIED_AND_REGISTERED`, `RELEASE_EXIT=0` and
`Deactivated successfully`. Local audit command also exited0:
`/tmp/mobo-team-calendar-12120-final-audit.log`. No second installation occurred.
The owned stale read-only tail was stopped after this proof. See error-playbook.
Unrelated checkouts/dirty work were untouched; documentation committed separately.
