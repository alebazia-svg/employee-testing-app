# Manual reserve top-up and shared cashier task

Owner approved release on 2026-10-13, including on-shift retail manager
notifications. Released as **1.4.10**, runtime
`93d9dd7d38d6d0253de059e6fcb21d24e3e6c6f4`.

- Exact reserve identity: `7e102389-3ccb-11ed-8f49-0025901e48ee`.
- ADMIN manual selection only, with existing balance/pending/freshness and
  native-request guards. Other safes/general forecast unchanged.
- Shared recipients require active retail EMPLOYEE/WORKDAY user, active cashbox
  mapping, and actual current-day active retail shift. Selection alone does not
  notify; an existing linked payable request does. One employee issues money.
- Persistent task and authenticated details include cashbox, amount and payee.
  Push retains neutral lock-screen copy and existing overnight restrictions.
- Partial issue updates remaining amount; full issue closes for all. Ending a
  shift removes the task for that recipient. 1C outage defers delivery and
  suppresses unverified amounts; reopening uses the same notification identity.
- No claim/lock for physical cash issuance is introduced. Staff coordinate and
  check the native request before issuing; closure follows verified 1C reads.
- No schema, migration, financial-matching, 1C extension, environment, upload,
  infrastructure or existing-request mutation is included.

## Verification

71 focused unit/component/route/notification tests passed. Isolated PostgreSQL
integration passed for personal and shared routing, deduplication, department
and mapping exclusion, shift ending, partial/full issue and reassignment.
TypeScript, isolated versioned production build and five release-info tests passed.
No real native request or employee test push was sent.

Production deploy exited 0. Independently verified SSH HEAD, public health
`ok:true`, `/release-info.json` version 1.4.10/build time
`2026-10-13T07:57:11.441Z`, and authenticated ADMIN footer displaying 1.4.10 /
13.10.2026 10:57 MSK. Generated metadata has null revision as before; SSH confirms
exact runtime commit separately. Upload mount remained
`offonika-portal_portal-uploads:/app/uploads`.

Authenticated read-only funding GET at 11:02 MSK returns the exact reserve once,
with real numeric balance, manualOnly:true and shared shift state. Current
expense queue had no top-up to demonstrate the picker; no synthetic production
request was created. Existing minute notification timer is active; 11:01 run
failed during app restart, next 11:02:10 run completed with exit 0 / success.
Deploy transcript: `/tmp/mobo-deploy-reserve-1.4.10.log`.

## Rollback

Previous production runtime `f4ee008a01632434cc93924ecf663533dbaccdbd`, version
1.4.9. Rollback restores that runtime/version; no database restoration needed.
Financial requests created by the owner remain valid in 1C independently.
Saved original image tag:
`offonika-portal-reserve-rollback:pre-1.4.10-20261013`.

## Verification limits

Physical-device push delivery and real reserve issuance are not test-executed.
Push requires an active device subscription and browser/OS permission. The
existing minute sender discovers payable requests and eligible new shifts;
this is automatic, not a promise of instantaneous delivery.

## Runtime source files

- `app/(dashboard)/employee/CashIssueClient.tsx`
- `app/api/admin/procurement/delivery-funding/route.ts`
- `app/api/employee/cash-issue/route.ts`
- `app/api/employee/workday-notifications/route.ts`
- `components/ProcurementDeliveryCreate.tsx`
- `lib/procurement-cash-issue-notifications.ts`
- `lib/procurement-cash-issue-policy.ts`
- `lib/procurement-cashbox-shift-policy.ts`
- `lib/procurement-delivery-cashbox-choice.ts`
- `lib/procurement-delivery-create.ts`
- `lib/procurement-delivery-funding.ts`
- `lib/procurement-delivery-reserve.ts`
- `lib/procurement-notification-lifecycle.ts`
- `package.json`, `package-lock.json`

Only scoped source/tests and version files were committed. Existing untracked
deploy scripts, probe, node_modules/uploads links and unrelated 1C workspace
changes were preserved. No schema migration, 1C publication or external
financial operation was performed.
