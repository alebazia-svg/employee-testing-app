# Buyer payment calendar tabs — deployed 2026-09-29

- Owner approved the exact neutral, underlined two-tab design, commit, deploy
  and opening Terminal for sudo. Production commit: `ac2bfc1571ca81be02dc4c5501eee6f1b140f509`.
- Default view: current requests grouped by existing statuses. History is a
  single searchable card list, initially ten entries; details expand inline.
  The same summary, cash balances and delivery panel stay in the right column.
- History hides the planning caption and add-payment button, as approved.
  Switching tabs is disabled while an edit/new-payment form is open, preserving
  the existing draft cancellation safeguards.
- Buyer payment details use the owner-approved label “Переплата по заявке” for
  the retained unallocated USDT difference. This is not supplier-level debt or
  overpayment. Calculations, payment attribution and administrator views did not
  change.
- Only two components and two regression test files shipped. Unrelated dirty
  files, development review routes and private snapshots were excluded.

## Verification

- 34 focused tests, TypeScript and local production build passed.
- Local actual-component browser checks: both tabs, persistent summary, inline
  details, mobile layout, 15-entry synthetic list with long supplier name,
  expansion and search beyond first ten entries, empty search, new-payment form
  and disabled tab switching, cancel and return. No payment was submitted.
- Server build passed; deploy exited zero; container healthy; expected markers
  exist in built JS; both procurement routes exist; local tabs review route is
  absent from the production manifest.
- Independent readback confirmed server HEAD and public health HTTP 200 on
  `portal.alebazia.xyz` and `team.mobo-opt.ru`.
- Authenticated production admin procurement and history opened successfully;
  the administrator split list/detail layout stayed unchanged. The available
  browser session is ADMIN and redirects the buyer route to ADMIN, so no
  production buyer-account visual check was claimed.
- No migrations, 1C writes, payment changes or notification resends.

Rollback image: `offonika-portal-rollback:before-buyer-tabs-ac2bfc1`.
Previous server commit: `3c350d3362631a808ee6c7e8de2495e3169ac8ba`.
Private deployment diagnostics: `/tmp/procurement-tabs-release.ekGxOg/` on Mac.

The owner's reminder about Employees → Devices and logins remains a separate
follow-up; this release did not implement or change that section.
