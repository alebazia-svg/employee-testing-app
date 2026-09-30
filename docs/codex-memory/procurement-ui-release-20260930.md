# Procurement UI release — 2026-09-30

Production app commit: `661f978e8f33b5bbad699506977df0cb9c8e1385`.

Owner-approved changes:
- Four visible tabs remain; payment decisions remain one-click.
- Awaiting payment is the owner's action queue: overdue, today, tomorrow,
  later. Date groups and the selected card show the deadline; summary counts
  and the ordinary approved badge are neutral.
- Forecast retains financial coverage and dated expenditure, without the
  rejected duplicate queue of approved payment cards.
- Lists use page scrolling; selection and full buyer comments remain available.
- Existing production buyer history, USDT allocation warnings and newer
  unrelated releases were preserved when rebasing this four-file UI commit.

Verification: production build passed locally and on VPS; 42 targeted tests
passed. Local authenticated desktop and 390px mobile checks covered queue,
detail/back navigation, forecast, search and empty search. No mobile horizontal
overflow was observed. The preview uses an isolated synthetic database.

Deployment: only portal-app rebuilt via server.env; no migrations, manual
production data changes or upload changes. Terminal command exited 0; server
HEAD matches the app commit. Both team.mobo-opt.ru and portal.alebazia.xyz
health endpoints returned HTTP 200 after restart. The live browser reached
login; authenticated production visual verification remains owner-side.

Notification demos, the rejected ProcurementDueOverview experiment and its
test are untracked local artifacts, not included in this release. Do not
silently reintroduce the duplicate forecast queue.
