# Department QR poster release — 2026-10-05

Production version: **1.1.6**. Runtime commit: `87f5447c255068ef3698b0eb86e8e677ac4cf84f`.
Previous production: 1.1.5, `89e10f42e42b4299cd83001ecb8daee74d513b82`.
Owner approved the final two-column installation layout and explicitly requested commit/deploy.

## Released scope

- `public/print/portal-workday-retail-a5.pdf` and `.png`.
- `public/print/portal-workday-wholesale-a5.pdf` and `.png`.
- `public/print/assets/mobo-app-copper-512.png` — exact installed app icon.
- `scripts/generate-approved-workday-posters.py` — reproducible approved artwork.
- `package.json`, `package-lock.json` — synchronized 1.1.6 version fields.

The graphite layout retains its approved header and QR geometry. Copper accents,
the actual app icon, the exact “Начать рабочий день” button name, explicit scanning
in step 2, and separate iPhone/Android installation columns are included.
QR payloads remain `offonika-workday-start:retail` and `offonika-workday-start:wholesale`.
No employee PWA, business logic, migration, environment, upload or database changes.
Other local worktrees and their pending changes were preserved.

## Verification

- Local `npx tsc --noEmit` and `npm run build`: passed.
- `node --test tests/release-info.test.mjs`: all 5 passed.
- A5 PDF geometry, text margins, exact approval-file match and both QR decodes: passed.
- VPS build/restart of only `portal-app`: exit 0; replacement container running.
- Independent SSH verification confirmed the exact runtime commit above.
- Both `team.mobo-opt.ru` and `portal.alebazia.xyz`: health HTTP 200, public metadata
  version 1.1.6, build `2026-10-04T23:39:55.163Z` (05.10.2026 02:39 MSK).
- All four public PDF/PNG resources on both hosts exactly matched the approved local files.
- Authenticated ADMIN QR dialog opened successfully and both updated previews were inspected.
- Authenticated ADMIN footer DOM contains `Версия 1.1.6` and `Сборка 05.10.2026, 02:39 МСК`.
  Its existing responsive CSS hides the footer at the inspected narrow viewport;
  a visible desktop-width version label was not independently verified.
- Public metadata reports revision null/source unknown in the existing Docker build;
  the deployed commit was therefore verified separately via SSH.
- Physical printing was not performed.

PDF SHA256:

- Retail: `738ff596b5d1c05c7164bea1e60ab8ef468782ba5a386fa58fe22efc9512ed36`.
- Wholesale: `5e69f83e48135fecc6097fc2e31d3e1d717c0a04c83ae38f4a04b71a02f55181`.

## Rollback preservation

Previous image: `sha256:003f61d878a0b831e987fe58da9863458a57f933879b451e03b043acafc7bd30`.
Retained tag: `offonika-portal-app:rollback-1.1.5-before-qr`.
New image: `sha256:7c9d49d7781409110ba18b2d862dca07749bb0625fa7e8a17483a5220e8e0eb3`.
No schema changes; the prior image/version remain compatible.
