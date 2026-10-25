# Payment document actions cleanup — released 2026-10-25

Version: **1.17.1**. Runtime commit: `e3219b51c909c8ae62734fc2cb31a2c6bc243189`.

Owner approved removal of confusing «Это чек оплаты» and «Это реквизиты»
controls from ordinary document cards. Their confirmation panels are removed.
Requisites and receipt sections, file viewing, adding files, replacement,
QR confirmation/request and exact expense linking remain unchanged.

Runtime changes are confined to `components/ProcurementDocumentSections.tsx`.
Regression coverage: `tests/procurement-document-picker.browser.test.ts`.
Version fields updated in `package.json` and `package-lock.json`.
No migrations, API, business rules, file-purpose updates, notifications,
1C writes or dependency changes. Local historical OCR tooling was excluded.
Other dirty work in the development checkout was preserved.

## Verification

- Based on production 1.17.0 / `ef923b12579c798d52ec11b12672d3ec3c62631c`;
  the concurrently released tax-control functionality is preserved.
- 18 document, receipt and browser-upload checks plus five release checks passed.
  Browser checks cover both roles and five payment methods, upload/cancel/retry,
  exact expense associations and absence of both correction buttons.
- TypeScript, full build and whitespace checks passed.
- Server commit read independently by SSH after deploy.
- Public version and authenticated ADMIN footer: 1.17.1, built
  `2026-10-25T09:09:05.704Z` (12:09 Moscow); health returned 200.
  Metadata revision remains null; SSH supplies commit verification.
- Real ADMIN → «Нужны чеки» → Cargo Yura shows the retained QR requisites,
  separate missing-receipt state and «Добавить чек», with neither correction
  command. No production file upload or financial mutation was performed.
  Actual buyer/physical-phone production interaction was not repeated; shared
  component role/method behavior is covered locally.

## Deployment and rollback

Initial attempt stopped before checkout because the current 1.17.0 image was
not first in the verified registry. Source, running package, public metadata,
health and authenticated ADMIN were verified before normal registration.
All existing registry image IDs were checked to exist; nothing was pruned.

Base 1.17.0 image:
`sha256:b8e5c6d77e02c077787b60e7d178f5429419439688654681cfb0ff93defa5b34`.
Preserved as `portal-app:rollback-before-1.17.1`.
New verified image:
`sha256:3aaacb274cf36c4edcc3c05dffb31da95b3297ceb3ecac9359d3a2a31dfd6ba1`.

Deployment used the shared storage lock and the existing server.env/compose
configuration; only portal-app was rebuilt/restarted. Environment checksum and
mount signature were unchanged. Final verified-image registration succeeded;
remote deployment exit code 0. No database rollback is needed for this UI patch.

Procurement evidence progress remains 54.8 before/after; no item IDs or stage
permissions changed. Autonomous procurement and 1C writes remain disabled.
