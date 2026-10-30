# Compact stable PWA header — 1.19.10

Released and independently verified 2026-10-30.

- Runtime commit: `6ca39dd20fa5a6baaf54e15b21b34b63d98f06cc`.
- Public version: 1.19.10; builtAt: `2026-10-30T06:28:22.170Z` (09:28 MSK).
- Runtime change: `public/pwa-copper.css` and `components/procurement-mobile-shell.css` only, plus aligned package versions. Shared 94px employee header and stable root scrollbar gutter scoped by PWA theme marker; conflicting procurement padding removed.
- Existing parallel tax release 1.19.9 retained unchanged.
- Local TypeScript, production build and five release-info tests passed.
- Authenticated production: Astemir Day/Schedule/Procurement each 373×94, bell x267 in the phone iframe; retail Zukhra and wholesale Zalina Day/Schedule/Salary each 375×94, bell x269 at 390px viewport. Opening notifications preserves geometry.
- Desktop calendar retains its heading and desktop UI; zero PWA theme markers and scrollbar gutter `auto`.
- Server source, public metadata, authenticated version label and health verified. 1C environment fingerprint and volume mount identities unchanged. No financial submissions or production data changes performed by this release.
- Native Terminal deploy exit 0; container healthy. Current image `sha256:ae9335a0cae8f5290aaaf3d2c0bd7f7dcf3849963d3aeb1ef3882cbe14158e6d` registered with verified 1.19.9 and 1.19.8 reserves, all images present. Free disk 25.99 GiB.
- Physical installed-phone verification was not performed.

Separate subsequent local candidate: include procurement employees in ADMIN day-control server selection and department grouping. Not part of the released 1.19.10 image.
