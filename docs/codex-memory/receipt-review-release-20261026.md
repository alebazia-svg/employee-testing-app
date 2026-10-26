# Receipt review production release — 2026-10-26

Owner explicitly authorized publication after accepting the isolated live preview.

- Target: production `https://team.mobo-opt.ru`, service `portal-app` only.
- Version: **1.18.4**, source commit `a718908bb624b6b803a479b3291d309f9769a04c`.
- Previous source: `9dbe926696bd1632988d07d1bae5e8689bc8b28d`, version 1.18.3.
- Build date: `2026-10-26T15:14:50.801Z` (18:14 Moscow).
- New image: `sha256:593329090e2d3b7b5456390d5ba254895a5fd50cb1f77bb9099573e2412483cf`.
- Previous image retained: `sha256:a7245f982dc56194db10411ad090d2494f7698964bdba88e2c4b7620cf0d72b1`.
- Second retained reserve: `sha256:4cdb1c936362243e998b9afcc1a87bfb5ea9fd83e53c6a7e9740095c225a53ff`.

## Changes

Missing-receipt cards explain the accepted terminal payment, missing 1C evidence,
next step and prevention of duplicate receipts. Source details and secondary
closure actions are collapsed. Existing confirmation/cancel behavior remains.
Workplace labels append the responsible employee from actual app shift intervals
and the owner-confirmed seating rule. Explicit KKM settings retain precedence;
unknown/nonstandard staffing remains uncertain. This is responsibility for review,
not proof of personal fault or a receipt's fiscal status.

Changed application files:
`components/FiscalAdminApproval.tsx`, `components/FiscalReviewContent.tsx`,
`lib/fiscal-review-data.ts`, `lib/terminal-fiscal-admin-gate.ts`,
`lib/retail-workstation-responsibility.ts`, plus synchronized package/lock versions.
Tests: `tests/fiscal-review-content.test.ts`, `tests/fiscal-review-data.test.ts`,
`tests/terminal-fiscal-admin-gate.test.ts`.

## Verification and limits

- Rebased onto current 1.18.3; preserved concurrent schedule reminder changes.
- 18 routing, 10 card/data and 5 release-info tests passed; TypeScript and build passed.
- Isolated authenticated preview covered Zukhra and Magomed replacement; source
  disclosure and closure cancellation were exercised interactively.
- Deployment storage/image gates passed; current app stayed live during build.
- No Prisma, Dockerfile or compose changes. No migration or manual production DB,
  environment, upload or 1C writes. Existing mounts/env hashes verified unchanged.
- Independently verified exact server commit, public metadata, API health and
  authenticated card with visible 1.18.4 version. Source disclosure works live.
- Runtime image healthy; release exit 0; verified-image registry updated after
  independent checks. Public metadata reports revision null/source unknown in
  this existing Docker build; source identity was verified directly on server.
- No manual employee forwarding was performed. The forwarding POST was tested
  through the focused suite, not by sending a real employee message.
- At 18:18 Moscow the live 500 RUB case still reported no linked 1C receipt.
  Its responsible employee displayed as Zukhra; no fiscal fault was inferred.

Read-only source investigation earlier today found 12 1C checks/fiscal documents.
The only 500 RUB check was morning `00OF-003693` at 10:48; no second 500 RUB
check, including cash checks, was returned. The acquiring register independently
reported 11,900 RUB versus 12,400 RUB on terminals at that observation time.
This is evidence from the returned API documents, not a claim to inspect all
unposted drafts or prove who physically performed the transaction.
