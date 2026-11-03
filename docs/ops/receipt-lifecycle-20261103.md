# Receipt lifecycle fixes — production 1.21.19

Bela approved automatic acquiring receipt checks and required corrected cases to
stop appearing as errors for ADMIN and employees, including the already corrected
25,500 RUB acquiring sale and credit realization 00OF-013177. The earlier corrected
1 November 900 RUB case must remain closed without new employee notifications.

Released runtime: `b4fa5f63186928b59d4cc6b56ac0941e49bb5d9c`, version **1.21.19**,
built **2026-11-03T17:57:29.936Z**. Based on independently verified 1.21.18;
its direct Workday cards and other agreed behavior are preserved.
Image: `sha256:0780f65ce8b2387caff627a7d8feaa1201477749f7b803f3415dfffcbd231bbe`.

## Behavior

- The general 1C KKM export excludes receipts fiscalized from acquiring documents.
  The existing settlement-link reader now follows an explicit realization payment
  basis and reads the fiscal operation of the exact linked acquiring document.
  Full fiscal identity, KKT, amount and payment breakdown must agree with OFD;
  amount or timestamps alone cannot substitute for this evidence. A delayed receipt
  can close its original case without requesting a second fiscalization.
- Identical copies of an acquiring record from both KKM snapshots are deduplicated
  for employee routing; conflicting copies still fail closed.
- An unposted payment draft without any fiscal operations is ignored only when a
  correct full credit receipt from the realization is independently confirmed in
  OFD. Posted payments, missing/incorrect receipts, returns, incomplete sources and
  fiscal conflicts retain their safeguards. Credit algorithm: `credit-shadow-v4`.
  The closed issue retains the ignored draft number in its audit metadata.
- A snapshot older than the saved observation does not replace the newer financial,
  review or credit state. Resolving a case cancels pending notifications and sent
  notifications awaiting retry, including their next push attempt. History remains.
- Existing scheduled rechecks continue. There is no new background service, new
  screen, migration, 1C write or fiscalization by the agent.

## Independent production verification

Before installation, a complete unified OFD read confirmed the credit receipt
No. 3329 for 145,000 RUB and acquiring receipt No. 3336 for 25,500 RUB. The latter
belongs to acquiring 00OF-000087 through realization 00OF-013165.

After installation, ordinary read-only previews and the corresponding existing
application reconciliation commands completed successfully. A separate Prisma
readback, repeated after independent UI verification, established:

- acquiring financial match confirmed and its review resolved;
- credit case confirmed, issue 107617 resolved, employeeActionRequired false and
  no next reminder; this issue no longer blocks handover;
- zero active unread notifications for the two cases;
- the old 900 RUB case remained resolved and notification counts were unchanged.

Authenticated ADMIN shows “Оплата и чек сверены” for 25,500 RUB and “Закрыто” for
realization 00OF-013177. The official read-only employee preview no longer shows
“Проверьте чеки” or the credit action. Its one remaining notification is the ordinary
“Смена завершена” notice, not a receipt error. Employee activity was not impersonated.
Both public hostnames return healthy and version 1.21.19; server commit, package
version, build date and authenticated footer were independently checked.

Root installation ended `RELEASE_VERIFIED_AND_REGISTERED` / `RELEASE_EXIT=0`.
Current image plus the verified 1.21.18 and 1.21.17 rollback images were registered;
the deployment lock was released. Environment, server.env, mounts, networks and
ports were unchanged. Physical phone push display/retraction was not tested;
already delivered OS notifications are separate from current portal attention.

## Validation and changed files

Production build and TypeScript passed. Fiscal suite: 296 passed / one optional
fixture skipped; credit control: 23 passed; neighboring Workday/notification tests:
34 passed; isolated PostgreSQL: 13 passed / one optional fixture skipped; release
metadata: five passed. Real 1C payloads also passed focused read-only local evaluation.
No production schema migration was used. Unrelated node_modules symlink preserved.

Runtime source:
- lib/credit-realization-control.ts
- lib/credit-realization-shadow-runner.ts
- lib/credit-realization-workday-control.ts
- lib/terminal-fiscal-acquiring-order.ts
- lib/terminal-fiscal-admin-gate.ts
- lib/terminal-fiscal-employee-review.ts
- lib/terminal-fiscal-matching.ts
- lib/terminal-fiscal-missing-receipt.ts
- lib/terminal-fiscal-persistence.ts
- package.json and package-lock.json

Regression tests:
- tests/credit-realization-control.test.ts
- tests/credit-realization-shadow-runner.test.ts
- tests/credit-realization-workday-control.test.ts
- tests/terminal-fiscal-acquiring-order.test.ts
- tests/terminal-fiscal-admin-gate.test.ts
- tests/terminal-fiscal-employee-review.test.ts
- tests/terminal-fiscal-persistence.integration.test.ts
