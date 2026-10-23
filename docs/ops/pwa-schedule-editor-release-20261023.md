# PWA schedule editor 1.14.2 — 2026-10-23

Owner approved release of the reviewed local editor and explicitly required
preserving other settings and appearance.

## Source and scope

- Target: https://portal.alebazia.xyz, `/docker/employee-testing-app`, portal-app.
- Runtime commit: `2d25f8be63d07579a1e726b6bc043154ea3679f5`.
- UI commit: `0c75c71c89d540e50cff29a71048c83f7468def9`.
- Previous runtime: `2f6f4c44e037422d7c74272fe8e630c6980bb78f`, 1.14.1.
- Rebased onto deployment branch `f8de3ab`, retaining the separate QR camera
  fallback release. No new migration, integration, employee setting or DB write.
- Centered editor heading and short helper; month shown inside the editor header.
- Accessible upper close icon and lower «Выйти без сохранения» use the existing
  discard confirmation. Saving, concurrency guards and staffing checks unchanged.
- Actions follow the calendar with a 12px gap; sticky placement retains access
  on short screens. Normal calendar and workday styles unchanged.
- Exact runtime files: `app/(dashboard)/employee/EmployeeTodayClient.tsx`,
  `public/pwa-copper.css`, `package.json`, `package-lock.json`.

## Pre-release checks

- 169 workday tests, 5 QR tests and 5 release metadata tests passed.
- Production build, TypeScript and git diff checks passed after integration
  with the latest deployment branch.
- Isolated local live UI: both exits, discard confirmation, continue editing,
  discard/re-entry; no test save to production.
- 375×812 and 390×844 CSS viewports; five/six-week months; last dates and exit
  accessible, no horizontal overflow, 12px settled gap, editor cells retain 56px.
- Authenticated production baseline at 390×844 before deployment:
  normal card 595px, cells 52px, edit button 36px, navigation 72px, no overflow.
- Physical iPhone Safari/PWA not tested; browser viewport checks do not replace
  physical-device validation. QR camera permission/capture not exercised here.
- Unrelated primary-checkout changes untouched; ignored demo helpers excluded.

## Production verification

- Independently read server HEAD: `2d25f8be63d07579a1e726b6bc043154ea3679f5`.
- Public release metadata and authenticated About panel: 1.14.2, builtAt
  `2026-10-23T19:01:55.722Z` (22:01 Moscow). Metadata revision remains null;
  Git identity was verified separately. Public health returned `{ "ok": true }`.
- Container running/healthy. All runtime environment values were hashed in
  normalized order and compared before/after; mounted paths/permissions and
  server.env hash unchanged. Only portal-app rebuilt/restarted.
- Authenticated production employee preview: normal calendar dimensions at
  390×844 exactly match baseline (card 595px, cell 52px, button 36px, dock 72px).
  Editor retains 56px cells; settled gap 12px, no horizontal overflow. The ADMIN
  preview banner adds vertical height; sticky actions remain reachable.
- Upper close without edits, lower exit with edits, continue selection,
  upper exit with edits, discard, vacation open/close, nearby/month switching
  passed. Original 24 October day-off remained after discard. No production
  schedule or workday was saved. Existing PHOTO start mode remains visible.
- Stylesheet URL is `/pwa-copper.css?v=1.14.2`.
- Screenshot: `/Users/bela/.codex/visualizations/2026/10/06/01a1102c-dd8a-7d23-b958-f682a7781949/schedule-editor-production-1.14.2.png`.
- Previous image: `sha256:94b0e34cca98d6d74512a916a2b5147ac77cd04959236e73736c55327a9f691b`.
- Replacement: `sha256:38c9d5636f6da71061d0a8638d49dce2f2a92e77a2e92a6c779f06a7cede0c8e`.
- Rollback tag: `portal-app:rollback-before-1.14.2`; no schema rollback required.
- All three registry images existed before build. Maintenance service last result
  success/exit 0 and timer active. Disk 16 GiB before, 13 GiB after; no cleanup run
  in this task. Future builds must satisfy the 15 GiB free-space gate.
- After independent UI/public/server verification, deployment lock released and
  verified-image registration succeeded. Registry retains new image, 1.14.1 and
  1.14.0. The initial public metadata request during restart briefly returned
  no JSON; bounded retry succeeded, then independent verification passed.
