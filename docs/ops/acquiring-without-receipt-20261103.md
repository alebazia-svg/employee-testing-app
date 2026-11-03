# Acquiring payment without fiscal receipt — local candidate, 2026-11-03

Bela approved routing an acquiring payment without a cash receipt to the employee,
using the existing receipt notification pipeline and native mobile sheet, with
distinct acquiring-specific wording.
The owner's review stays visible. No separate message, new form, duplicate payment
or fiscal write. A real KKM receipt with delayed OFD confirmation remains ADMIN-only.
Production installation/notification for25,500 has not been performed by this candidate.

## Real trigger

3 November13:05:37 Moscow,25,500 RUB, terminal2332022071/aQsi11085322,
printed terminal receipt000507. Posted acquiring operation00OF-00008714:09:28 exists;
the direct complete /kkm-checks read found no25,500 receipt. The live daily report
at19:11 shows bank45,150 /1C financial documents45,150 /OFD19,650, with the entire
25,500 difference on this acquiring operation. The live owner review ID is
cmw0jymmc000sgpg18d08z2bk. No production data was changed, no employee message sent.

## Cause and exact scope

The employee policy treated any oneCCheckKey as a found receipt and retired the
employee task. That key can point to an acquiring_operation, which is payment
accounting evidence rather than a fiscal receipt. Matching retains its original
acquiring document and reason in financial audit; a derived employee-policy view
may treat that specific case as a missing sale receipt.

Requires a uniquely linked sale acquiring document, no fiscal identifiers,
unconfirmed fiscal state, exact electronic amount, complete bank/1C/OFD and peer
reads, needs_review/OFD_RECEIPT_NOT_FOUND, and NO possible sale OFD receipt with
matching electronic amount on any known KKT. Unknown/ambiguous/failing sources,
possible existing OFD receipts and actual KKM receipts retain existing behavior.
The existing complete global/native receipt coverage,30-minute safe read, active
employee and workstation responsibility policies still apply. Peer data failure
preserves an already addressed task instead of cancelling it. Historical/completed
shifts do not get a surprise new push under this change.

Reuses the same review ID, participant, notification kind/fingerprint, body,
mobile sheet, actions and closure lifecycle. Retains an existing owner event;
creates the ordinary owner event for a new acquiring case. Repeat polls do not
send duplicates. No matching IDs, totals, assignments or financial audit records
are rewritten; this is employee routing only. No schema/migration, environment,
version or production service change in the candidate.

## Checks

- Fiscal suite:286 passed,1 optional live-fixture skip (285 primary +2 chain UI).
- ADMIN view/data checks:11 passed, including the separate acquiring problem.
- Isolated local PostgreSQL lifecycle:13 passed. Existing ADMIN acquiring case
  transitions in-place to employee-open, one notice, owner event retained,
  repeat polls no duplicate, source/peer failure preserves it, later confirmed
  fiscal chain resolves it and cancels pending delivery.
- Focused cases: actual KKM with OFD delay, possible peer OFD receipt, source
  failure, grace pending, confirmed match and native amount coverage retain rules.
- TypeScript and production build checked; final result retained in.wip logs.
- The full DB test initially found missing partial assignment indexes in the old
  db-push-created LOCAL database. Installed the three existing migration indexes
  only into workday_extension_test, then all13 tests passed. No production SQL.
- The first broad test exposed needless peer reads for ordinary read-only runs;
  narrowed extra reads to employee-sync runs. The original dependency test passes.

## Real application preview

Isolated localhost3242, workday_extension_test database, synthetic employee
login demo-fiscal-25500, dedicated local reviewcmw0wrd8q00022mce6v4a795k.
Created through the actual stageFiscalAdminReview and syncTerminalFiscalEmployeeReviews
functions, independently asserted employee ownership and exactly one notification
plus one owner event. Local push delivery is cancelled; no production integrations
or fake live incident used.

Mobile390x844 final screenshot:.wip/acquiring25500-basis-preview.png.
The initial generic missing-1C copy was rejected and is superseded.
Same EmployeeAttentionPanel/material and actions as before. Only the new problem
uses its own title, body and preserved line break:
«Не найден кассовый чек по эквайрингу»;
«Сегодня в13:05 на вашем терминале оплатили картой25500 ₽. Чек терминала №000507.
Эквайринговая операция №00OF-000087. Кассовый чек по ней не найден. Проверьте,
пробит ли он из этой операции.»
Existing «Нужна помощь» / «Продажа не моя». Physical phone push untested.

Before production, reconcile the latest deployment branch and public runtime;
parallel1.21.15 was queued while public runtime was1.21.14. No future version
reserved. Assign a new patch only immediately before an authorized publication,
then verify the actual case afresh before activating any delivery.


## Owner clarification retained — distinct fiscal obligation

Bela explicitly corrected the original candidate: the acquiring document IS found
in1C. The employee should check the CASH receipt from that acquiring operation,
not be told that the1C payment/sale document itself is missing. Do not merge these
business problems back into the generic missing-1C wording. Keep the same native
mobile component, actions, terminal payment facts and visual style.

The review stores ACQUIRING_RECEIPT_NOT_FOUND as its employee business reason;
financial MatchingAuditRecord retains its original document/key/OFD reason and
financial totals. ADMIN card/inbox use the corresponding acquiring-specific
explanation; employee list, sheet and push share one copy builder. Exact acquiring
number is extracted from the linked1C document, not guessed from the amount.

Use one stable acquiring-specific notification fingerprint per payment/recipient.
A formerly sent/cancelled generic missing-document notification must not suppress
this distinct question. Cancel only pending generic notices for this same review;
retain their original text and sent history. Repeat polls do not create more
acquiring questions. Tests exercise the real transition from prior generic notice,
owner review retention, incomplete source/peer preservation and confirmed closure.

No extension to PKO/credit-realization policies was implemented; this candidate
covers the specific acquiring-operation case the owner described. Existing native
cash receipts with delayed OFD confirmation keep their prior ADMIN policy.


## Final owner wording — supersedes the longer copy above

Bela requested simple «эквайринг», then explicitly chose the employee instruction
«Пробейте чек» rather than another request to check. Employee title is «Пробейте чек»;
body retains the existing payment amount/time/method/printed terminal number and
one short line «Эквайринг №00OF-000087.» No repeated explanation or instruction.
The owner inbox remains descriptive «Нет чека по эквайрингу». Existing missing-
1C-document notices are unchanged. Receipt metadata accepts both earlier long
and current short acquiring labels so historical messages remain readable.
31 focused policy/copy tests and the PostgreSQL transition scenario pass after
this text change. Current UI preview is local only; no production install or send.
