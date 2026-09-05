# Cash retention local browser drill — 2026-09-04

Scope: isolated pre-pilot verification, not a production deployment or an iPhone
acceptance test. Code is in worktree `/tmp/offonika-pilot-audit-20260904`.

## Environment

- Actual Next.js application at `http://127.0.0.1:3104`, loopback-only.
- Isolated PostgreSQL database `offonika_colleague_qa_20260904`.
- QA user `qa_magomed` (5), test workday 4.
- Process started with an empty inherited environment. No production keys.
- Before recovery, explicitly pinned 1C base URL to unreachable loopback
  `http://127.0.0.1:1/qa-disabled` and used dummy integration credentials.
- No production or 1C mutations. One labelled QA operation remains in the
  isolated database as evidence; uploaded asset is the public PWA icon.

## Observed through the real browser UI

1. Opened deposit-safe form; entered 1 RUB and a `QA ONLY` comment.
2. Replaced only the local listener with a server returning HTTP 502 HTML.
3. Submitted the test image using the actual file chooser.
4. UI showed `Инкассация сохранена на телефоне` and `Повторить`.
5. Retried while 502 persisted: local retention warning remained.
6. Restored the isolated application and reloaded the page.
7. The persisted outbox automatically submitted the operation after reload.
8. UI showed one operation, 1 RUB, status `У администратора`; the local
   retention card disappeared after acknowledgement.
9. Read-only database inspection found exactly one QA CashOperation, id 1,
   status `one_c_error`, both 1C document references null.
10. Original and received photo SHA256 both equal
    `46491ca020054e285951c71f514269bd3e043e53dce8e43641745ac7e45018cd`.

The administrator status is expected because 1C was deliberately unavailable;
it is not evidence of successful posting in 1C. The browser drill verifies
actual IndexedDB retention across page reload plus the portal upload path.
The mocked lifecycle regression suite separately covers wrong/empty responses,
401/400/409/503, connection failures, deletion failure and same-key retries.

## UI review

Retention status and retry action are visible at the top; the ordinary cash
form closes after durable local save to discourage duplicate entry. Removed
the redundant `Не удалось отправить:` prefix from the existing error card.
No layout, icons, workday rules or notification settings were changed.

## iPhone acceptance — 2026-09-05

- Completed the manual iPhone drill through `https://qa.storflow.ru` using the
  synthetic `qa_magomed` employee.
- After a test photo and 1 RUB deposit-safe amount were entered, Airplane Mode
  was enabled before submission. The PWA reported that the operation was saved
  on the phone.
- The portal was reopened and connectivity restored. The retained operation was
  submitted automatically and the employee UI showed `У администратора`.
- A read-only API check found exactly one server operation for the active QA
  workday: direction `deposit_safe`, amount 1 RUB, photo present, status
  `one_c_error`. No duplicate was created.
- `one_c_error` is the expected isolated-QA result because 1C is deliberately
  disabled; it is not a production integration failure.

## Still required

- This evidence does not authorize production deployment or employee rollout.

## Delayed original-shift submission — 2026-09-05

- Deployed the candidate build only to `https://qa.storflow.ru`; the production
  container ID, start time and running status stayed unchanged.
- Submitted a new test operation after the originating workday date had passed,
  with the original workday ID and date supplied by the client outbox.
- The server returned HTTP 202 and saved operation 3 against workday 4 on
  `2026-09-04`, with amount 2 RUB, photo present and status `one_c_error`.
- Both 1C document references remained null. The stored reason states that
  automatic posting was disabled pending an administrator decision.
- Replayed the identical multipart request with the same idempotency key. The
  server returned operation 3 again with `Инкассация уже сохранена в портале`;
  no duplicate operation was created.
- The workday regression suite includes the equivalent closed-shift case and
  asserts zero 1C writer calls. The scheduled retry policy test asserts that the
  timer command is read-only and only the administrator endpoint owns the 1C
  retry writer.
- After deploying the compatibility candidate, sent a legacy-format request
  without workday ID/date but with the timestamp previously stored by the PWA.
  QA recovered `2026-09-04` and workday 4, saved operation 4 with both 1C
  references null, and returned HTTP 202 for administrator review. Replaying
  that same legacy request returned operation 4 again and created no duplicate.

## Temporary iPhone QA endpoint

- VPS directory: `/docker/offonika-iphone-qa`.
- Compose project and container names use the `offonika-iphone-qa` prefix.
- PostgreSQL database and uploads use separate QA-only Docker volumes.
- The source archive and database fixture contain synthetic QA records only.
- The QA database contains synthetic active retail checklist templates for the
  `09_18`, `09_20` and `11_20` shifts (five current pilot tasks per shift), so
  the employee can start a real workday flow during device acceptance.
- 1C, T-Bank snapshot processing and Telegram delivery are not configured and
  are explicitly disabled in the QA compose environment.
- The endpoint uses the ordinary portal login and rate limiting. Do not publish
  QA credentials in repository files.
- Production health at `https://portal.alebazia.xyz/api/health` remained OK and
  the production `portal-app` container was not restarted while the QA endpoint
  was installed.

Stop the temporary endpoint without deleting its evidence:

```sh
cd /docker/offonika-iphone-qa
sudo docker compose --env-file qa.env stop
```

Removing its containers or volumes is a separate destructive operation and
requires explicit owner approval after the iPhone acceptance test.
