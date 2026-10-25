# Requisites correction cleanup — released 1.16.1

Runtime commit: `6c94601c53be37d2f441584f1c0e48962f473bed`.
Based on deployed 1.16.0 (`cfca478`) and deployment branch `d9e0421`;
the independently released employee audit was preserved.

Only runtime change: `components/ProcurementDocumentSections.tsx` removes
redundant QR/wallet type radios from the existing ADMIN legacy-file correction
confirmation. The existing payment-method default is used, matching the
already-released direct requisites upload. No new-upload recognition, content
warnings, schema/migration, API, payment linkage, closure or notification changes.
The new browser regression checks cancellation and confirmation for USDT/CNY/BANK.
Standalone historical OCR tooling in the development checkout was NOT included.

Verification:
- 22 document/receipt/UI tests, including isolated browser picker/cancellation/
  retry/exact expense selection and both user roles; all passed.
- 5 release metadata tests, TypeScript and local production build passed.
- VPS capacity and all three verified images checked; old image tagged
  `portal-app:rollback-before-1.16.1` before replacement.
- Production build and container replacement succeeded; no migrations run.
  Env checksum and mounts unchanged. Storage/receipts were not edited.
- Independent SSH readback matched the runtime commit; public metadata reports
  1.16.1, built `2026-10-25T08:14:46.382Z`; health endpoint returned 200.
  Public metadata has null revision, so commit confirmation came from SSH.
- Authenticated ADMIN footer shows 1.16.1 / 25 October 11:14 MSK.
  Opened existing history attachment correction, verified zero type radios,
  then cancelled. No live classification/upload mutation was made.
- Registered verified image
  `sha256:8606e503324a2d62e5469c2a368d1ef451be809539abd2d66201129341d7132f`.
  Remote script ended with `REQUISITES_DEPLOY_VERIFIED=1`, exit 0.

Local proof: `/tmp/mobo-requisites-1.16.1-production.png`.
No physical-phone test this release; real saving/upload was covered in isolated
tests, not by changing production business records. Unrelated dirty working
files were preserved in their original checkout.
