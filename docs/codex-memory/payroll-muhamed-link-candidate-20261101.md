# Muhamed recipient link — released 1.20.10, 2026-11-01

Owner approved restoring the link to the actual 1C recipient, preserving amounts,
documents and all existing behavior. Correct visible spelling: Кумыков Мухамед
(one м in the middle). The shared display helper already supplies this spelling.
Saved payroll identity Кумыков Мухаммед is retained internally to avoid rewriting
historical runs, drafts or directory rules. Released with explicit owner authorization as 1.20.10, runtime commit
6c817cca645c39eddcff1a71054387d92dbb509a. No production DB mutation,
1C publication or document edit performed.

## Confirmed read-only evidence

Authenticated production settlement API, October window through November1,
checkedAt 2026-11-01T15:46:28–29Z. Recipient e046e927-d449-11f1-95c1-002590803daf,
name Кумыков Мухамед, one recipient in complete cash/ledger data. Complete closing
balance omits this zero row; unknown recipients must still remain unknown.

- Accrual movement 6e7f552b-c949-11f1-8f13-002590803daf:2, date2026-10-16,
  organization1c2d6c5c-251f-11ec-ac9f-0025901e48ee, asset_liability_movement,
  sign-1, amount24000. Comment «Выход за окт закупки(1500*5)» plus newline is
  retained exactly; its outdated five-day wording is not executed as a formula.
- Advance cash a1969ac8-c965-11f1-8f13-002590803daf:6, 00OF-001901,
  2026-10-16, 7500, comment «аванс 10.2026». Ledger cash line is :5.
- Salary cash 1a0d2b56-d604-11f1-95c1-002590803daf:2, 00OF-002011,
  2026-11-01, 16500, empty comment. Ledger cash line is :3.

Three narrowly scoped rules: exact recipient+one-м name maps to saved identity
from October onward; exact November payment tuple maps to October; exact posted
accrual tuple/comment maps to October. No fuzzy spelling, merging multiple refs,
zero fallback for unknown identity, general new salary calendar or document rewrite.
The older СтажерЗакупка ref70dbcdd8-ce99-11f0-a343-002590803daf and its historical
rules remain intact. A new and legacy recipient appearing together fail closed.

## Changed files and checks

- lib/payroll-payment-breakdown.ts: confirmed recipient/name constants only.
- lib/payroll-one-c-advances.ts: exact new name/ref alias, existing safeguards retained.
- lib/payroll-settlement-month.ts: exact November1 document/amount/recipient tuple.
- lib/payroll-one-c-ledger.ts: exact posted October accrual evidence.
- tests/payroll-muhamed-onec-link.test.ts: complete normalized production fixture,
  actual payment-card summary and component render, export, no double advance,
  wrong refs, competing names and changed source facts.

79 payroll tests +32 targeted settlement/ledger/export/display tests and5 release
metadata tests passed. TypeScript, production build and diff check passed.
Source fixture deep comparison proves no source mutation.

## Production verification

- Public release-info:1.20.10, builtAt2026-11-01T16:28:15.868Z. Metadata revision
  remains null/source unknown under the existing Docker build; commit separately
  verified over SSH as6c817cca645c39eddcff1a71054387d92dbb509a.
- Authenticated ADMIN October saved FINAL statement№1 and Muhamed detail verified:
 16×1500=24000; accrued24000, advance7500, paid24000 including advance, remaining0.
  Both cash documents appear without unmatched/unassigned warnings.
- Public health ok; container healthy. No schema migration. Saved payroll/details,
  rules, Finbox, day-review and user payroll-settings hashes unchanged. Environment,
  connections and mounts unchanged. Before/after fresh read-only1C source hash:
  7cda65792d07613e245c391c10c5989b8a67ea55905b873e718cebc4945c1f5f.
- New image:sha256:6c8832838707905eb12a0d2be808e684a487621f976ce3e38493f96d4124ebe5.
  Previous1.20.9:sha256:a246f2a5700827a16cc0d9333e737f48871b24bf8081d88e52cd0e5f8a2f6de2.
  Verified registry contains current plus two rollback images; release registered,
  deployment exit0. Existing authorized storage retention applied after free-space
  preflight; no uploads/database/backup deletion.
- Actual screenshot: implementation worktree .wip/muhamed-production-1.20.10.png.
  Separate visible version label was unavailable in the mobile ADMIN modal;
  public metadata and actual fresh UI bundle were checked. No physical-device
  retest or full PWA walkthrough (no layout/navigation changes).
- Separate schedule-repeat candidate and all unrelated dirty work left untouched.
