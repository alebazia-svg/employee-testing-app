# MOBO identity release — 2026-09-14

## Master identity follow-up — 2026-09-15

Application commits: `cee3a46`, optical correction `6d8bd42`, lockup hierarchy
correction `137557c`, and rounded wordmark correction `ee52375`.

The owner approved a new master identity based on the four-piece graphite
symbol and Latin `MOBO` wordmark. It replaces the earlier blue/amber shell logo
and the solid-blue wordmark PWA icon described below.

The new system deliberately separates brand and interface roles:

- graphite and warm porcelain are the brand's primary material language;
- deep ink blue remains the portal's functional action color;
- muted blue is the secondary tone for employee navigation, colleague and QR
  icon details;
- warning, error and success retain their semantic colors and must not be made
  blue for visual uniformity.

The login uses the larger dimensional symbol and graphite wordmark on a warm
neutral card. ADMIN and procurement use the restrained flat white master mark
on their dark graphite shell surfaces. Installed PWA, Apple-touch and favicon
assets use the opaque stone-background 3D symbol. The service-worker cache
version was bumped so the new icon can replace the old asset, though physical
installed-icon refresh remains device-dependent.

The optical correction increases the negative space between the four symbol
elements in dimensional, flat and compact lockups without changing their
letterforms. It also increases the login wordmark, balances it against the
symbol and gives the `Портал компании` descriptor a deliberate baseline and
spacing. PWA rasters were regenerated from the same corrected dimensional
master; the maskable export keeps a smaller safe-area mark.

The final login lockup places the dimensional symbol and `MOBO` together on one
optical row and gives them the same perceived height. `Портал компании` is a
readable 13–14 px separate centered descriptor below the whole row, not a
subline belonging only to the wordmark. The final custom monoline wordmark uses
near-circular `O` forms and rounded terminals instead of the earlier elongated
oval construction. The same vector wordmark is reused by ADMIN and procurement
so the three shells cannot drift apart.

The same application commit includes the already approved employee PWA visual
corrections: profile initials, a clean two-tone blue colleagues glyph,
ink/muted-blue active bottom navigation and a muted-blue QR affordance. It does
not change roles, settings, data, APIs, Prisma schema or business workflows.

Verification passed the production build, TypeScript, 152 Workday tests, seven
identity/PWA design tests, HTTP checks for login and manifest, and exact image
dimension/opacity checks. Login, ADMIN and procurement shells were visually
inspected from the clean integration branch with the real shell components;
the ADMIN and procurement body values in that inspection were demo data. Final
authenticated production verification remains part of the eventual deployment
procedure.

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
