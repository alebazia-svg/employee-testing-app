# MOBO identity release — 2026-09-14

Application commit: `8f1275a5765407ad25da08d49a10299b9711e379`.

The owner approved the frozen MOBO letterforms, blue/amber on the warm light
login background, white on the existing dark admin and procurement headers,
and the full word on the installed PWA icon. Graphite/amber remains available.
The compact navigation uses the matching white M. Do not iterate letterforms
or replace these assets without a new approval.

Source assets are versioned in `public/brand/mobo/`. `PortalWordmark` selects
the color; `PortalIdentityBlock` handles shell identity. Metadata, manifest,
offline title and notification fallback name use MOBO. The offline cache
version is bumped to refresh its icon; notification delivery and routing are
unchanged. Active admin navigation preserves readable text while hovered.

The isolated release passed TypeScript, production build and 9 design tests.
Prior local visual checks covered login, active/hovered admin links and compact
navigation. Procurement visual review used the real components with local demo
data, not the purchaser's authenticated account. Physical iPhone/Android icon
installation still requires owner verification.

Excluded: local color comparison and procurement preview routes, employee
workday changes, payment-calendar changes, database and integrations.

This decision supersedes the temporary neutral-identity wording in the older
design-system document; operational colors and workflows remain unchanged.
