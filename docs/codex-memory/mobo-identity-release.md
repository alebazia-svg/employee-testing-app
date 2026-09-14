# MOBO identity release — 2026-09-14

Application commit: `8f1275a5765407ad25da08d49a10299b9711e379`.

Deployment completed with exit 0. Server checkout matches the application
commit; public health, login and manifest checks pass. All eight published
logo/icon files checked match the local release hashes.

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

## PWA icon follow-up — 2026-09-14

The owner selected the full MOBO wordmark on a solid ink-blue `#263B5C`
background for the installed PWA icon. The letters are white; the approved
amber gradient inside M retains its original shape and color. A single M,
diagonal wordmark, decorative background effect and flat amber substitution
were considered but not selected. The master logo and shell identity are
unchanged.

Application commit: `e25cc15` (icon assets, metadata, manifest, Apple touch
fallback, offline/push icon references and cache version). The ordinary icon
uses a slightly larger wordmark than the first white-background export; the
maskable icon keeps the established safe-area geometry. No workflows, QR data,
database or integrations change. Physical installed-icon verification remains
necessary on the owner's device because PWA icon refresh behavior is
device-dependent.
