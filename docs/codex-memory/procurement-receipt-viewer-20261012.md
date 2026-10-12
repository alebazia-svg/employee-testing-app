# Receipt viewer integration — 2026-10-12

Status: **released as portal 1.4.9** on 2026-10-12.
Runtime commit: `f4ee008a01632434cc93924ecf663533dbaccdbd`.
Public build time: `2026-10-12T18:54:55.032Z` (21:54 Moscow).

Working checkout: `/tmp/mobo-portal-release.CxwIKo`, branch
`codex/procurement-responsive-release`, base `cb08bc0` (portal 1.4.8).
Do not release the older preview checkout instead.

## Scope

- The ordinary shared `ProcurementReceipts` component now opens an attached
  file in a viewer instead of downloading it immediately, for admin and buyer.
- JPG/PNG/WebP fit the window; zoom, fit, back and explicit download controls.
- PDF pages render locally with lazy-loaded, same-origin PDF.js 6.4.299 assets.
  Page navigation, cancellation, bounded loading and retry are included.
- Receipt notifications reuse their existing dialog; payment context is hidden
  only while viewing a file and restored on return. No extra nested viewer.
- Existing receipt GET route, access checks, uploads, financial matching,
  notifications generation, database schema and 1C documents are unchanged.
- No personal receipt, demo endpoint or preview-only fixture belongs in release.

## Checks

- TypeScript check passed.
- Production Next build passed in isolated `/tmp/mobo-receipt-build.rbxTa1`.
- 18 focused tests passed: viewer, receipts policy, receipt summary and
  notification opening/access. `git diff --check` passed.
- Actual local `/admin/procurement` and `/procurement` checked using existing
  test users and an existing PNG attachment: opening, back, zoom, fit and Escape.
- Earlier preview tested an actual Tural JPG copy and a repository PDF; the
  integration uses the same viewer. No production file or payment was changed.
- Local server 3143 has no live 1C configuration. Financial status verification
  is outside this UI-only check; no fixture changes were used to fake status.

## Next release

Owner authorized the commit/deploy. AGENTS/runbook were reread; both live
metadata and deployment branch were 1.4.8 before selecting 1.4.9.
Five release-info tests and all eighteen focused feature tests passed.
Server build/restart exited 0. Upload volume remained mounted at `/app/uploads`.

Independent readback confirmed the exact server commit above, public version
1.4.9 and build date, and the authenticated ADMIN footer. The existing Tural
JPG opened inside the production receipt dialog (590 × 1280); zoom and fit
worked. PDF module and worker assets returned HTTP 200. Production PDF content
and an authenticated production buyer session were not exercised; local PDF
and buyer checks are recorded above. No financial data or documents were changed.

Rollback, if explicitly authorized, restores prior runtime
`bbee494c2f372e7b529f9392a481f0614df2d095` / 1.4.8 with the same portal-only
compose build; no migration or data rollback is needed.

Only this feature's components, helper, tests, PDF assets and package versions
were committed in the runtime release. This note is a separate documentation
commit. Unrelated deployment helpers and latency probe were preserved.
`node_modules` and `uploads` are local symlinks and **must not be committed**.
