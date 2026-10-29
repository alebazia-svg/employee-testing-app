# ADMIN taxes workspace release — 2026-10-29

Owner request (Бэла, 29.10.2026): a professional but simple «Налоги» section in
the portal style; Aslan sees the limit at a glance, Бэла uploads documents and
sees reconciliation; figures refresh daily; any failure is visible at once and
reported only to Бэла. Nothing new is sent to Aslan or to Telegram.

Base: production 1.18.27 (`dcee4abb`). Portal-only presentation over the
canonical runner report; no tax total is recalculated in the portal.

## Scope

- `/admin/taxes`: tabs Обзор / Доходы / Сверка с налоговой / Документы, house
  styles (`components/taxes/taxes.css`), explanations behind (i) hints.
- Limit outlook: usual pace (3 full months) and cautious pace (strongest full
  month); decision date = cautious limit date − 45 days.
- Reads runner `Помесячная структура` and `Помесячная сверка с ФНС`; accepts the
  full-report channel labels (`Эквайринг`, `Наличные`).
- «Что не работает»: stale (>26 h) or unavailable figures, failed/stuck
  processing, missing permanent documents.
- Fix: a global runner label no longer closes a month's document requirement
  (production showed September ENS as present while the archive ends in August).
  Visible effect: one new «Нужны документы ФНС за 2026-09» reminder.
- Upload: period is not asked for income XLSX / ENS ZIP; result shows what changed.
- «Обновить цифры сейчас» (`POST /api/admin/taxes/refresh`) and
  `ops/systemd/offonika-ausn-refresh.{service,timer}`: hourly 08:10–21:10 MSK,
  refreshes only when the newest report is older than 20 h. Reason: the existing
  `ausn-report-cache-refresh` (07:30/12:30) failed every run since 26.10 with OFD
  HTTP 503 — Platforma OFD is read through the owner's Mac tunnel, which is
  intermittently down; hourly retries recover as soon as it is back.
- Bridge waits for its own result when the runner is busy (retry loop).
- New inbox events `tax.figures_stale`, `tax.limit_decision`: receipts only for
  logins in `TAX_CONTROL_ALERT_LOGINS`; web push 09:00–22:00; never Telegram.
  Without the variable nothing is sent.

## Requires a matching runner release

`ai-business-os` `tools/ausn-monthly-control/ausn_portal_process.py` must accept
`{"request_id","document_type":"REFRESH"}` (no file) and re-run full + current
reports. Prepared on branch `codex/ausn-portal-refresh` from `c9e9637`; release it
first, then the portal. Report builder, Telegram sender and timers are unchanged.

## Deploy checklist

1. Disk gate and rollback image per `vps-deploy-runbook.md`.
2. Runner: install `codex/ausn-portal-refresh`; run its unit tests on the VPS.
3. Portal: no migrations. Add `TAX_CONTROL_ALERT_LOGINS=<Бэла's login>` to `server.env`.
4. Rebuild `portal-app` only; verify public metadata and authenticated ADMIN `/admin/taxes`.
5. Verify the full report is readable by the container
   (`/app/runtime/ausn-reports/ausn-executive-full-*.md`); otherwise «Доходы» and
   «Сверка» stay empty and «Что не работает» shows «Нет годового расчёта».
6. Press «Обновить цифры сейчас» once; confirm new run time on the page.
7. Install and enable `offonika-ausn-refresh.timer`; `systemctl list-timers`.
8. Register the verified image.

## Rollback

Restore the preceding verified image and source commit; disable
`offonika-ausn-refresh.timer`. No data migrations; inbox events may remain.

## Validation (local)

- Full suite on Mac: 1998 tests, 62 failures — identical set to unmodified 1.18.27
  (pre-existing, outside taxes); 36 new tax tests pass. `next build` passes.
- Runner: `ausn_portal_process_test.py` 5/5.

## Production (29.10.2026)

- 1.19.0 `ddc555b`: deployed; refresh script failed (top-level await in CJS tsx).
- Runner: first installed `9e49f5b` (based on c9e9637) by mistake — production was
  already `e6d4241`. Replaced before any report run by `0913c10` = e6d4241 + REFRESH
  (branch `codex/ausn-portal-refresh-on-e6d4241`). Previous: `e6d4241`.
- 1.19.1 `7f4a3a7`: refresh script fixed; forced refresh completed 21:51 MSK.
- 1.19.2: no false alarms on real data — open month is never an FNS discrepancy,
  the full report does not search ENP payments (shown as «не сверялись», not
  «не оплачено»), one item per missing FNS source.
- Two stale intake requests (ENS uploads of 25.10, already superseded) parked in
  `/var/lib/ausn-report/portal-intake/parked-20261029/`.
- `TAX_CONTROL_ALERT_LOGINS=admin` (the only ADMIN account, used by Бэла).
- Known dependency: Platforma OFD is read through the Mac tunnel; when the Mac
  sleeps, refresh fails and the hourly timer retries.
