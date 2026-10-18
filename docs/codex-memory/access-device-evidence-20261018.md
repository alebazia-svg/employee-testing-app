# Device evidence and confirmed grouping — released, 18 October 2026

Owner approved implementation after the broader device-identification review:
«Ну хорошо, сделай всё возможное». Owner subsequently approved release with
journal schema expansion: «Выпускай». Production 1.5.9 / `7e8ad90`, following
1.5.8 / `6f0300e`. Concurrent 1.5.5–1.5.7 workday releases preserved.

## Release evidence

- Exact server commit: `7e8ad902c424e5083b2eae9217c32e4bf03f36a9`.
  Public release-info and authenticated footer: 1.5.9, built
  `2026-10-18T15:33:00.285Z` (18:33 Moscow). Container healthy.
  Metadata source remains `unknown` in the Docker build; revision independently
  verified through the server Git checkout, not inferred from that metadata.
- 1.5.8 preflight checked all recorded migration checksums and found only
  `20261018180000_access_device_evidence` pending. Applied successfully;
  independent schema query confirmed all seven nullable columns and the
  completed migration record. No historical backfill, deletion or owner relabel.
- Live smoke caught Next.js req.url exposing the container origin. Corrected
  immediately in 1.5.9: browser Origin must match HTTP Host, otherwise use only
  a matching request URL or omit. Forwarded host is not trusted. This field is
  diagnostic only, never used for authentication or IP/owner proof.
- Final checks: 70 server/integration tests passed (none skipped), 29 UI tests,
  5 version tests, TypeScript and isolated production build. Both server builds
  passed. Production owner labels and separate Codex connection retained.
- Authenticated live readback at 18:37 Moscow: Codex browser reports 1.5.9,
  reported OS/browser details and `https://team.mobo-opt.ru`; explicit action,
  automatic contact and login remain distinct. Mac Бэлы/iPhone Бэлы mappings
  retained, no production grouping/renaming performed for smoke testing.
  Public health endpoint 200. Screenshot `/tmp/mobo-access-release-1.5.9.png`.
- Rollback images: `mobo-access-rollback:1.5.7` (before schema release),
  `mobo-access-rollback:1.5.8` (before origin correction). Nullable additions can
  remain during code rollback; do not drop history or diagnostic columns.

## Implemented scope

- Extend the existing activity journal; no new authentication, device agent,
  MDM, fingerprinting service or remote permissions. Optional Client Hints are
  bounded by 700 ms and collected once per mounted screen. Fallback UA parsing
  does not infer Mac hardware/CPU or Windows 10 from Windows NT 10. Full raw UA,
  screen/GPU/font fingerprints, serials and business content are not stored.
- Store reported OS/browser versions, architecture and mobile model when
  provided. Detail view marks browser-reported provenance and observation date.
  Windows Client Hint contract versions use Microsoft's documented mapping;
  unsupported/unknown ranges remain Windows, not a guessed release.
- Add identityBoundAt (no historical backfill), observedBrowserId and origin
  (scheme/host/port only). A changed cookie never rewrites original identity.
  The mismatch is recorded immediately, even inside the normal minute throttle.
  Mismatched requests cannot overwrite that session's push observations or
  receive its safe-update command; ADMIN naming/classification/update rejects
  such rows. UI distinguishes prior version/push facts from current proof.
- Optional interaction timestamp records trusted pointer/key event time only
  within the visible portal. No content/coordinates/keys collected. Clock bounds
  and monotonic persistence enforced. This is browser-reported action, not human
  identification; login, automatic contact and action remain separate.
- Extend PortalAccessBrowserOwner with explicit deviceGroupId. ADMIN can link
  one known browser to an already named connection through a confirmation step.
  The server resolves both IDs and checks ownership; serializable transaction
  prevents partial links. Equal names/IPs/OS never merge records. Existing
  browser/account push/version details and historical records remain separate.
  Naming a browser separately detaches only that browser; disable does not
  revoke login or push. Group is a user-confirmed physical-device association,
  not hardware attestation. New browser profiles/storage resets are not silently
  added to an existing group.

## Initial local verification / preview

- Additive migration `20261018180000_access_device_evidence` applied ONLY to
  isolated local PostgreSQL `access_telemetry_verified`, loopback port 55451.
  At that preparation stage no production schema/data/settings changed;
  subsequent approved production migration is documented above.
- Focused server, authorization, parser, timeout and DB integration checks;
  UI render checks; TypeScript; production build in isolated temporary source
  copy, not in the active review server's .next directory.
- Real authenticated app preview: http://localhost:3154/admin/employees/access?view=service
  runs the actual production components/routes against the isolated database.
  Named rows with «Пример» and «Тестовый» are synthetic QA fixtures, NOT observed
  owner/Aslan devices. The current browser row reports real local browser hints.
  UI confirmation/cancel, grouping, independent rows and details verified.
- Existing unrelated `app/access-clarity-review/` and dependency symlink preserved.
- Final verification: server suite 69 passed, one legacy DB-gated test skipped;
  final devices/journal UI run 29 passed; TypeScript and diff whitespace checks
  passed. Final isolated build started successfully with `next start` on 3154.
  Desktop and narrow-screen list/dialog checked, no horizontal overflow.
  Screenshot: `/tmp/mobo-device-evidence-final.png` (explicit synthetic example).
  Local preview process session 7203; temporary build `/tmp/mobo-device-build.Jge3EK`.

## Remaining operational gates and limits

- Future releases must recheck live release-info and deployment branch, choose
  a fresh version and preserve nullable fields/history during rollback.
- IP support already exists but production collection stays OFF. Before enabling
  `PORTAL_ACCESS_TRUST_REAL_IP=1`, verify actual ingress overwrites X-Real-IP and
  direct access to app is blocked. Do not accept arbitrary forwarded headers.
  This turn did not verify or change live proxy configuration.
- No canonical-domain redirect or cross-domain cookie transfer was introduced.
  Old/new portal origins are visible for diagnosis and can be manually linked
  when both connection identities are confirmed. A redirect requires separate
  auth/PWA/push migration planning, not a cosmetic URL change.
- Safari/iPhone physical-device verification and remote safe-update behavior on
  real employee devices remain to be verified after release. Never promise an
  exact iPhone/Mac model or a named owner from browser hints alone. MDM/native
  enrollment is a separate project and is not installed by this change.

## Source map

- `lib/portal-device-observation.ts`, `lib/portal-access-journal.ts`,
  `lib/portal-access-view.ts`, `lib/portal-app-update-server.ts`
- `components/PortalAccessTracker.tsx`, `components/PortalAccessDevices.tsx`,
  `components/PortalAccessJournal.tsx`, `components/portal-access-devices.css`
- `app/(dashboard)/admin/employees/access/page.tsx`
- `app/api/auth/{activity,login}/route.ts`
- `app/api/admin/employees/access/{owner,service}/route.ts`
- `prisma/schema.prisma`, additive migration above
- `tests/access-device-evidence{,.integration}.test.ts`,
  `tests/access-connection-classification.test.ts`,
  `tests/portal-access-devices.test.tsx`

Primary references checked: MDN NavigatorUAData/getHighEntropyValues,
Microsoft Edge how-to-detect-win11, WebKit tracking-prevention, Apple device
information queries. Hardware detail/ownership is not claimed from IP/UA.
