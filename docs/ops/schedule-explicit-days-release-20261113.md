# Explicit schedule selection — approved release blocked, 13 November 2026

Production remains **1.24.11 / 6a8f57753998a1ed8974706111367b0f8036e6ac**.
No new app image or archive was transferred to the VPS by this attempt.
Public health and authenticated ADMIN access passed after the stop.

## Approved application scope

Exact runtime target **1.24.14 / 10b2ecf9983d23d380b9d21bd480d6f0fbb52f4a**,
from exact live1.24.11. Maintained integration c8715fc preserves pending work;
do not deploy that integration commit as the scoped candidate.

Only explicit working/off date changes are saved in the existing month editor;
untouched empty/saved dates are preserved. Work/off mode, draft undo, mixed-batch
confirmation/counts and compact save bar are the approved local UI. Existing
weekly sheet explanation now describes today/tomorrow; its behavior is unchanged.
Outer calendar spacing/cell dimensions, schedule APIs/transaction guards,
QR/start/finish, staffing/notification policy, payroll/OFD, schema and config
are unchanged. Five feature/test files plus the two version files differ from live.

Passed:33 focused schedule tests,6 metadata tests,TypeScript,Next build,
whitespace check. Real BEFORE/AFTER apps with independent synthetic databases
persisted16 old versus2 explicit changes; untouched dates and colleague remained
unchanged. The exact linux/amd64 release image additionally saved only13/14November
in a dedicated local database, preserved18/30 as empty and the colleague's30rows.
Actual mobile390px view inspected; no horizontal overflow,44px tool buttons.
Physical employee phone and production post-install flows remain untested.

Image:sha256:ef27530e5a0eb535ee9a30ee29144785ee4d61f7faba8ffb3d3b802f860b3599.
Bundle:/tmp/portal-schedule-explicit-1.24.14-20261113-bundle.
Archive SHA256:f04b8b6570bec913e1ef640a45950f08206192eb51add542176cfeb8a681997b.
Capacity-plan SHA256:76c29d358f680d9ae510f564012b5b02392942b26a9366d1cfa2d1422e2902e1.
Compiled receipt-enabled capability/page/API/public inventory guard passed.

## Stopped installation and verified reserve gap

Ordinary capacity precheck:required19,931,048,155bytes,available19,194,146,816,
shortfall736,901,339. No archive was uploaded. Initial native SSH prompt ceased
without starting a session; no reason for that local closure was recorded.
A diagnosed retry launched session8a0c40bea2384b7d9eee748910336f06. It failed after
3.06seconds in preflight: `Command failed: docker (exit 1)`, before capacity
maintenance/READY_FOR_TRANSFER/loading or application restart.

A separate approved read-only diagnostic established the exact failure:
verified registry still lists current56f7aa...,reserve55ea34... and reserve901b19...,
but **901b19549e686c939b4dee38b1c7950228e1adde5b7c523943dd87786104f6dc is absent**.
Current and55ea34 exist. The cause/time of reserve deletion is NOT established.
Prisma status passed:83migrations,up to date. Do not bypass or rewrite the registry.
No new release or independent-verification registration occurred.

The exact original1.24.7 reserve survives locally:
/tmp/portal-diana-1.24.7-private-bundle/image.tar.gz,
328,719,836bytes,SHA2565b6f4d3a4d43f369b7cf05f99d112c006a46064908701025003490699ada6cc3.
Original OCI index/image identity and archive checksum passed; isolated read-only,
network-disabled image probe reports1.24.7/74e6539059ca80a962ea337c201ceff7442ea8bf,
clean,built2026-11-11T15:42:03.484Z. This is reserve restoration, not an app rollback.
Measured archive/load reserve requirement19,930,797,268bytes. A local recovery
proposal retains all image/container/data protections, may prune only unused
build cache under the existing policy, then reimports this exact missing image
before normal guarded release. Separate owner approval is pending. No recovery
has been executed; never claim the three reserves are present until rechecked.

Evidence:/tmp/schedule-explicit-release-20261113/,especially diagnostic-terminal.log
(the actual filename is diagnose-terminal.log),reserve-recovery-plan.json and
review.json. Temporary code is preparation, not evidence of production repair.

## Owner-requested data repair and subsequent accounting task

Zalina(user7)18–30November are still saved off from4November08:58MSK;
entry IDs829–841 all retain their original creation/update times. Actual ADMIN
activity showed4–30 saved off together,then4 and7–11/14–17 corrected to working.
No subsequent changes of the13future rows were found. Current read-only DB
snapshot confirms their IDs/status/timestamps. Source comparison18November shows
Google empty,app off; missing app plan must retain the existing fallback policy.

Prepared local repair restores only these13reviewed future rows to missing and
adds existing-source admin audit records(off→unset),preserving prior history.
Default is a read-only dry run; apply requires exact pins,one original null→off
employee_bulk_edit history per date,no later edit,workday or vacation,and all
dates beyond today/tomorrow. Serializable transaction rejects stale/conflicting
rows atomically. Six isolated Postgres checks passed:dry run,changed row,later
history,vacation,exact13with preservation,and retry/no duplicate write.
**Production data repair has not run.** No cash/1C/QR/payroll or notification
policy changes belong to it.

After the editor release,owner also requested verification/alignment of the
existing end-of-day no-QR accounting between calendar and Day Control. Earlier
functional correction32c85ff was prepared but never installed; see
control-calendar-functional-release-20261112.md. Investigate against exact new
live source and preserve successful-start boundaries,real shifts,plans,source
fallbacks and genuine issues. It is a separate task, not part of1.24.14.
