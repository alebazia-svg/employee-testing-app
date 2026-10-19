# Cashier cash-issue notifications — production release 1.4.0

Released with explicit owner approval on 12 October 2026 (Moscow).

## Behavior

- The assigned, uniquely mapped cashier sees a compact persistent PWA notice and
  opens details in the existing workday screen's bottom sheet.
- Cashbox selection shows actual shift status. The recommendation favors a
  funded on-shift cashier. Explicit off-shift selection remains possible with
  a warning. A changed mapping/shift invalidates the reviewed creation command.
- Selecting a cashbox does not create a financial document. The owner's explicit
  “Создать заявку к оплате” uses the existing protected 1C creation flow and
  requires independent readback of “К оплате”. The cashier creates the RKO.
- The notice persists after reading, reflects partial issue and disappears after
  verified full issue, cancellation or reassignment. No separate “issued” button.
- The cashier task waits for an actually started current-day shift. Unknown
  source data suppresses stale amounts and defers push. Existing minute sender,
  retries and stable notification identity prevent duplicate rows on polling.
- Scope is the existing Astemir accountable top-up flow. It does not import every
  arbitrary accountable request in 1C.

## Source and target

- Runtime/source commit: `68e374b1a6b47b8102867b4b1ed0fbc9bb846085`.
- Feature commit: `55b5ba7`; candidate documentation: `4907c1c`.
- Branch: `origin/design-local-updates`.
- VPS: `/docker/employee-testing-app`, only service `portal-app` rebuilt/restarted.
- Public: https://team.mobo-opt.ru and https://portal.alebazia.xyz.
- Shared application version: **1.4.0**; package/lock/root-lock versions agree.
- Public build date: `2026-10-11T21:13:16.860Z`, displayed **12.10.2026 00:13 MSK**.
- Docker metadata revision remains null/source unknown by the existing build
  mechanism; exact source identity separately verified through SSH HEAD and
  hashes of both new server modules in the running container.

## Checks

- Before release: TypeScript and isolated production build passed. Existing
  candidate evidence includes 24 UI/policy tests, 18 source/route tests and one
  isolated PostgreSQL creation integration; cashier/notification behavior and
  regression evidence is recorded in decision-log.md. No real 1C writes.
- Version bump: all five release-info tests passed; isolated 1.4.0 build passed.
- Production build/deploy finished exit 0; container healthy; public health
  endpoint returned `{"ok":true}`. Both public hosts return version 1.4.0.
- Authenticated ADMIN expense screen displays version/build date correctly.
- Authenticated funding GET returns five distinct manager cashboxes with mapped
  employees and current-day shift states. At 00:17 MSK all correctly report
  not_started. Creation-state GET returns enabled:true. No confirm POST sent.
- After replacement, workday notification timer active and the 00:17 MSK run
  completed successfully (exit 0). No manual dispatch or test push sent.
- Screenshot: `/Users/bela/.codex/visualizations/2026/10/12/cash-issue/release-1.4.0-admin.png`.
- Local deploy transcript: `/tmp/mobo-cashier-release-140.log`, exit file 0.

## Rollback and boundaries

- Previous runtime commit: `14f75171765d3285ff7b9b539f788f156296a574` (1.3.0).
- Previous image: `sha256:7f871f92654d7a48187bf2c0e3fa91a80c60ce0f2e2cef385cf2cdf239b3c80a`.
- Preserved rollback tag: `offonika-portal-cashier-rollback:pre-1.4.0-20261012`.
- Replacement image: `sha256:f7347b9bd0b18ebaf1d7dfecdb14701ce13167bd0c9fbc256d1d8aa33b1af2d4`.
- No Prisma/schema/migration, compose, Dockerfile, server.env or 1C publication
  changes. Existing generic notification rows do not require schema changes.
  Existing uploads/planning volumes and cabinet bind mount preserved.
- If rollback becomes necessary, use the preserved original image and version;
  no DB restoration or data deletion is part of rollback. Do not rebuild altered
  runtime content under version 1.3.0.
- Existing server untracked `.rollback/` was left untouched. Primary local
  checkout's unrelated dirty files were not edited or staged.
- Preview-only routes, demo DB, clock override and fixture are outside the release.

## Remaining verification

Physical-device delivery/opening of this new cashier push has **not** been
confirmed. The previous ADMIN summary push test does not cover this cashier
flow. Arrange one explicitly authorized device check for the assigned cashier
with an active shift and a valid payable request; do not create a real financial
request solely as a notification test without explicit authorization.

## Actionable push-copy follow-up — version 1.9.1

On 19 October 2026 the owner approved replacing the generic cashier lock-screen
message with an action-first message that names the currently verified
recipient, remaining amount and source cashbox. For the live request reviewed
that day the intended copy is “Выдать Астемиру 20 000 ₽” and “Из кассы «Касса
Хурзокова». После выдачи оформите расходник в 1С.”

The dispatcher derives this copy only after its existing live revalidation.
Opening the notification still performs the authenticated recheck, and unknown,
completed, rejected or reassigned state continues to defer or cancel delivery.
The generic text remains only as an unavailable-state fallback. No 1C write,
schema change, migration or cashier-routing change is part of this follow-up.

### 1.9.1 production evidence — 19 October 2026

- Released runtime commit `ab2282df5fe4478f208d7c0e5702ec945a2174a2` as
  application version 1.9.1. Both `team.mobo-opt.ru` and the retained
  `portal.alebazia.xyz` origin returned healthy responses and the same public
  build timestamp, 19 October 2026 at 14:02 MSK. The authenticated ADMIN footer
  independently displayed version 1.9.1 and that build time.
- The deploy guard stopped after the container replacement because a raw Docker
  mount JSON comparison changed. Before continuing, the running container was
  inspected independently: the upload and procurement-planning volumes still
  use `offonika-portal_portal-uploads` and
  `offonika-portal_portal-planning-snapshots`, and the read-only T-Bank cabinet
  bind still uses `/home/bela/offonika-tbank-cabinet`. All three destinations,
  source paths, mount types and read/write modes match the production compose
  contract. The main site was not changed.
- The verified runtime image is
  `sha256:4f843eabbdbbcdbbe72233344c2c98b2f7560ec9896de115cf1ba65d2a250b14`.
  It was registered with the storage-maintenance registry. The preceding image
  `sha256:66457f77455681fc12de3b01545addbfac7261bd9395fca138dbc4edd25fd20e`
  remains tagged `portal-app:rollback-before-1.9.1`.
- After revalidating the live payable request and its cashier assignment, the
  existing unread notification 6490 was resent with the new copy. The push
  provider accepted all six active subscriptions for portal user 8; zero stale
  and zero failed endpoints were reported. The authenticated access journal
  independently recorded “Принято сервисом доставки” at 14:14 MSK. Provider
  acceptance does not prove physical display, sound or reading on every device.
- No migration, schema change, 1C write, financial-state change or notification
  routing change was performed. Focused cashier and release-info tests,
  TypeScript and a production build passed before deployment. The unrelated
  dirty primary checkout was not edited.

## Exact release files

- `app/(dashboard)/employee/CashIssueClient.module.css`
- `app/(dashboard)/employee/CashIssueClient.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/cash-issue/page.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `app/api/admin/procurement/delivery-create/route.ts`
- `app/api/admin/procurement/delivery-funding/route.ts`
- `app/api/employee/cash-issue/route.ts`
- `app/api/employee/workday-notifications/route.ts`
- `components/ProcurementDeliveryCashboxChoice.tsx`
- `components/ProcurementDeliveryCreate.tsx`
- `docs/codex-memory/decision-log.md`
- `lib/procurement-cash-issue-notifications.ts`
- `lib/procurement-cash-issue-policy.ts`
- `lib/procurement-cashbox-shift-policy.ts`
- `lib/procurement-cashbox-shifts.ts`
- `lib/procurement-delivery-cashbox-choice.ts`
- `lib/procurement-delivery-create.ts`
- `lib/procurement-delivery-funding.ts`
- `lib/procurement-delivery-native-source.ts`
- `lib/procurement-delivery-native.ts`
- `lib/procurement-delivery-reminders.ts`
- `lib/procurement-notification-lifecycle.ts`
- `lib/workday-notifications.ts`
- `package-lock.json`
- `package.json`
- `tests/procurement-cash-issue.integration.test.ts`
- `tests/procurement-cash-issue.test.ts`
- `tests/procurement-collection-notifications.test.ts`
- `tests/procurement-delivery-cashbox-choice.test.tsx`
- `tests/procurement-delivery-create.integration.test.ts`
- `tests/procurement-delivery-funding-route.test.ts`
- `tests/procurement-delivery-notifications.test.ts`
- `tests/procurement-morning-notifications.test.ts`
