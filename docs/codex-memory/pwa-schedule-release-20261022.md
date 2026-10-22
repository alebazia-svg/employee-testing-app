# PWA schedule and scroll protection — production 1.12.1

Released to `https://portal.alebazia.xyz` on 2026-10-22 after owner visual
approval and explicit deployment authorization.

## Scope and accepted interface

- Light schedule tabs closer to the header; calendar editing and vacation
  actions inside the existing calendar, compact selected-day summary.
- Working days use stronger green (`#9ed3ae`); status text uses green
  (`#247642`). Selected dates retain their status fill, with an outline;
  today has a small copper dot. Vacation and missing-day legend entries are
  conditional. Missing colleague schedules are stated explicitly.
- Calendar cells are 52 px high, dates 18 px, cell labels 12 px, selected-day
  title 16 px and detail 14 px. Small displays scroll instead of shrinking text.
- Bulk editing has one save bar; the ordinary bottom navigation is hidden
  while editing. Existing save, confirmation, cancellation and date rules remain.
- Checklist copper side stripe removed; no new animation or workflow.
- Employee-only scroll protection: explicit non-collapsing bottom spacer
  (112 px plus safe area, 152 px with save bar), centered navigation without
  translateX, scoped vertical overscroll suppression.

No schema/migration, 1C, payroll, cash-control or shift-start/finish changes.
Runtime files: `app/(dashboard)/employee/EmployeeTodayClient.tsx`,
`public/pwa-copper.css`, `package.json`, `package-lock.json`.

## Release identity and rollback

- Runtime/server commit: `b6992383e8971c571da5ddddd5c223493c72755e`.
  Candidate 1.12.0 (`c6ee4a49c5c460096460377b2854e08ec782dbeb`) was not
  deployed; 1.12.1 includes the final sizing and scroll protection.
- Public metadata and PWA About both show 1.12.1, build
  `2026-10-22T08:26:58.788Z` (11:26 MSK). Existing metadata revision remains
  null/source unknown; server Git identity was independently read over SSH.
- Replacement image:
  `sha256:e5853f05cf2e88593058afefd6544789b49c2fa4aa3bd61e6d7b7659f6006ad7`.
- Previous 1.11.1 source: `a8d4bd67469805472dab158fae257e3154277504`;
  image `sha256:4741ac83e9df18d242f9192afffcfe87527de1e2677f89b205422ecce297d0b4`,
  preserved as `portal-app:rollback-before-1.12.1`. Schema-compatible rollback.
- Preflight confirmed all three registered images existed and 19.24 GiB free.
  Only portal-app built/restarted with server.env under maintenance flock.
  Parent lock released before verified-image registration. Registration passed
  after independent public/UI checks; launcher `DEPLOY_EXIT=0`.

## Evidence and limits

- Release-info tests 5/5; schedule, colleague shift, coverage, bulk, vacation
  and checklist viewport tests 29/29. Final TypeScript and production build
  passed locally; production Docker build/type checks also passed.
- Container healthy; public `/api/health` HTTP 200. Brief HTTP 502 during
  container replacement cleared after startup.
- Published CSS byte-identical to release file, SHA256
  `71f0c78e86b3577263034de27259f3ab1be11275ae79d868b6fad257247d8427`.
- Authenticated production employee inspection of Abshaeva Zukhra verified
  About version, October calendar and six-row November. At viewport 390×760,
  scrolling to the end leaves selected-day summary bottom 639 px and navigation
  top 676 px, for both months. Scroll ranges 141/201 px respectively;
  bottom spacer 112 px, navigation transform none, overscroll none.
- Local smaller-screen and bulk-edit/cancel checks passed before release.
  No real employee schedule, shift or financial record submitted for testing.
- The exact physical iPhone failure reported by the owner was not reproduced
  in desktop WebKit. This is a protective correction, not a proven root-cause
  fix; owner device verification remains pending. Do not claim it is confirmed
  fixed on iPhone based only on responsive browser tests.
- Screenshot:
  `/Users/bela/.codex/visualizations/2026/10/06/01a1102c-dd8a-7d23-b958-f682a7781949/pwa-production-1.12.1-scroll.jpg`.
- Unrelated dirty main checkout, earlier gallery work and server `.rollback/`
  left untouched. Release documentation committed separately from runtime.
