# Expense payment breakdown — prepared portal 1.4.4

Status: release candidate prepared locally, NOT deployed or pushed to the
production deployment branch. Owner approved the field correction and accepted
the demonstrated screen; exact production deployment confirmation is pending.

Runtime candidate: `12563e830c4d7f79a5f68be7025182fda5feb2cb`.
Feature commit: `76c0b95`.

## Scope

- Restore editable line-level cash-flow article, expense/assets article and
  expense department in the existing single expense modal.
- Keep partner/basis and expose the remaining native editable line fields under
  inline analytics/details; never synthesize a line absent from 1C.
- Header DDS and payment-line DDS remain independent values/scopes.
- Keep native preview/confirm, version checking, write permissions and history.
- No API/1C changes, schema/migrations, environment, notifications or real
  financial decisions. Demo routes/fixtures live only in the isolated /tmp copy.

## Evidence

- Read-only production card 00OF-001095 confirmed that the native schema already
  provides the missing line fields. Native lookups returned Доставка and Прочие
  платежи. No production document was edited or approved.
- 20 native command/breakdown/transport tests passed, including distinct header
  and line scopes and non-consecutive row numbers.
- TypeScript and isolated production build passed; five release metadata tests
  passed; final 1.4.4 build exit 0, metadata version 1.4.4.
- Local authenticated actual modal: mouse/keyboard selection, draft preview,
  discard guard, cancel/re-entry, multi-row UI and 390px viewport without
  horizontal overflow. Preview response was a local fixture, not a real 1C write.
- Visual evidence: /Users/bela/.codex/visualizations/2026/10/12/cash-issue/expense-breakdown-fixed.png.

## Production baseline / release gate

Fresh remote origin/design-local-updates and public release-info.json were 1.4.3
on 2026-10-12; no concurrent runtime changes. SSH read confirmed current runtime
commit e250bb4d03aa57e4357fa9781ecbb99cf5ab3a46 and only existing untracked .rollback/.
Public builtAt: 2026-10-12T11:25:58.297Z. Docker read via sudo -n requires a password;
current image must be re-verified/preserved at approved deploy time.
Last verified 1.4.3 image (previous release record):
sha256:446bc6de92baebc33f66702b5b65ebcf9a38c40875f1647f376c9990beea276c.
Replacement image: not built on VPS yet. Schema/compose/Dockerfile unchanged;
rollback requires only the prior image, no database restoration.

Recheck public/remote versions before push, deploy only portal-app after approval,
then verify server commit, new image, public metadata, health and authenticated
expense modal/shared version label. Do not submit a real financial decision as
part of release verification. The existing cashier-specific physical push test
remains separate and unverified; it is not changed by this release.

Changed runtime/test files: ExpenseNativeClient.tsx, expense-request-command.test.ts.
Release metadata files: package.json, package-lock.json. Primary-checkout unrelated
WIP was untouched. This handoff records release readiness, not a roadmap change.
