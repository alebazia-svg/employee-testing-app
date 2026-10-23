# Employee QR camera modes — released 1.14.1, 2026-10-23

## Approved scope

Owner approved an individual ADMIN setting `User.qrScanMode`: `SCAN` (default)
or `PHOTO`. The reason is an iPhone 14 Pro Max on iOS 18.1 where live camera
capture works in Safari but hangs in the installed PWA. The setting replaces
the earlier name-based Milana exception. It is available in ADMIN Employees;
reload the employee Workday page after changing it. Released as 1.14.1 at commit 2f6f4c4. No production employee preference was
changed; all nine accounts remain SCAN. The owner will choose PHOTO manually.

The maintained implementation is in the qr-camera-modes checkout based on
origin/design-local-updates cc22f7a (1.14.0). The old main checkout and its
1.0.0 screens are not the visual or release baseline.

## Approved interaction

In PHOTO mode, pressing the existing start button synchronously clicks an
already-mounted image file input with capture=environment. Do not move that
click into a React effect or behind an awaited request: preserve the browser's
user activation. There is no additional instruction-screen tap before capture.
The OS owns the camera UI and the photo confirmation button. After the photo
returns, it is decoded locally with jsQR and passed to the unchanged department
validation / server start-intent / shift-selection flow. No photo upload occurs.
QR acceptance time is still server time after successful QR validation.

If capture is cancelled or QR is unreadable, the portal offers one short
instruction and Open Camera. Failed/wrong-department images never create start
intents. Closing processing invalidates its pending result. Normal SCAN mode
and other business domains remain unchanged.

## Database and release

Migration 20261023183000_add_employee_qr_scan_mode adds one non-null text column
with SCAN default and a SCAN/PHOTO CHECK. Apply before starting the new app.
The previous app can ignore this additive field during rollback. Owner approved production migration and deployment on 2026-10-23.
The owner explicitly retained manual selection of Milana's PHOTO preference;
deployment must leave every existing employee in SCAN. See
`docs/ops/qr-camera-release-20261023.md` for release evidence and final status. Version must be rechecked and incremented during
release preparation, following AGENTS.md and the deployment runbook.

The isolated Docker database qr_demo on 127.0.0.1:55463 contains only a synthetic
administrator and employee. It was bootstrapped using prisma db push, not the
production migration chain. The migration itself has not been rehearsed against
a production-shaped snapshot.

## Verification and limits

- Production build, TypeScript and five focused tests passed (mode validation, actual QR pixels,
  rotation, unrelated/wrong-department QR, unreadable photo).
- Real authenticated localhost app: start click produced a file chooser with no
  intermediate tap; wrong-department image was rejected; retry with correct QR
  automatically reached shift selection, without starting a shift.
- Native camera capture, OS confirmation/cancel behaviour and timing must still
  be tested on the owner's iPhone and Milana's iOS 18.1. Desktop file-chooser
  testing does not establish that the iOS camera failure is fixed.
- No new screen should claim guaranteed camera recovery or instantaneous capture.

## Release result

Production 1.14.1 / 2f6f4c4 was verified with the real authenticated ADMIN
selector and footer, public metadata/health and server image/commit. Existing
User data checksums matched before/after migration; all nine modes remain SCAN.
Runtime configuration and mounts match Compose, previous image is preserved,
and the new image plus two predecessors are registered as verified. See the
release report for exact image/backup identities and operational incident notes.
Native capture still awaits the owner's and Milana's physical-device checks.
