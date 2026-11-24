# Devices and sign-ins 1.25.25
Released and verified on 25 November 2026 (Moscow). Runtime source
`c2a22475230602d871d6e850812505b91e1c3e8f`, built at
`2026-11-24T21:50:20.371Z`, exact amd64 image
`sha256:a5bb49a3a6a4c278e8cffe6d2e346d7080542d2ca45754b8e375ca8bebd0b91c`.
Canonical integration `f698023`. Guarded session
`7dcd234903f641a3a97fb546fc71f573` reached COMPLETE.

The three ADMIN tabs share width and spacing. Notification and version badges
use a common scale. The current browser is marked in its connection row.
Renaming an already named connection is available in its details. An eligible
unnamed current browser retains a visible naming action. The page-visit journal
remains a separate toolbar action. “Ожидает перехода” describes an app update
waiting for the Workday screen. Device grouping, session history, push
subscriptions and app update rules were preserved. No employee screen or
employee preview implementation changed, including menus and drill-downs.

- Local verification covered grouping and browser identity for different
  administrators, device operations, login history, journal filters and scoped
  pagination, status transitions, and real isolated PostgreSQL cases. Both
  viewport widths were checked. The committed amd64 image passed compiled
  capability inspection and authenticated reads of all three tabs.
- In production the public origins, server checkout and visible ADMIN version
  matched. Verified the employees and service tabs, named and unconfirmed
  connections, the current-browser marker, rename control, journal filter and
  login history with pagination available. No working devices were renamed or
  regrouped during verification.
- The installed PWA on the physical iPhone opened Home and Day Control and its
  exact app connection reported 1.25.25 as current. Mirroring locked during
  attempted scroll, so prolonged touch scrolling was not verified.
- Private pre/post reconciliation matched 66 plans and 47 saved documents,
  including checksums of 43 physical files and the Luxo reconciliation. In
  production the unpaid card exposed its expected actions, and the same saved
  PDF opened in ADMIN and in the read-only employee phone preview. Isolated
  payment-edit/revision tests used synthetic data. No production payment or
  employee action was submitted during verification.

The previous image 1.25.24 (`3e8c43f997e99618b9533476c8fdc0f8334900da`) and one
earlier reserve are pinned. Both public health checks passed. No schema,
deployment configuration or receipt capability changed. The verified original
archive is in the protected local release archive store. Private evidence
is under `access-release-20261125` in Offonika application support.

Runtime changes were limited to the ADMIN access page, its component and
stylesheet, the shared status text, synchronized package metadata and two
corresponding UI test files.
