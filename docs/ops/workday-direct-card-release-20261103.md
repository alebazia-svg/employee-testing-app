# Direct employee-card navigation — release 1.21.18

Released separately at the owner's explicit request. Runtime source:
`c4abeda2e45cd1d0419af0a9f6062fb07a0f8b6d`, navigation change `2ad901d`.
Public metadata and authenticated footer: 1.21.18,
built 2026-11-03T17:34:31.493Z (20:34 Moscow).

## Approved difference

Overview previously redirected to Need Action when a person had current and
inherited questions on multiple dates. Restore a direct employee-card link:
prefer today's question within the existing priority; pending owner decisions
retain priority. Past-only questions retain their actual dated card links.
No counter, label, filter, financial state, handover acknowledgement or pilot
boundary changed. No schema, migration, environment or upload edit.

Changed runtime/test files: `components/admin/TeamDailyControl.tsx`,
`lib/team-control-summary.ts`, `tests/team-control.test.ts`; package and both
lockfile versions synchronized. Other production 1.21.17 changes preserved.

## Verification

39 navigation/control tests; 73 navigation/payroll compatibility checks before
the fiscal merge; final 81 navigation/fiscal rendering and lifecycle checks;
five metadata checks; TypeScript and production build passed. The React render
check runs without the react-server condition, unlike server-only tests.
The mixed-date case was reproduced in an isolated demo database and tested
interactively. No synthetic case was created in production.

Authenticated production Overview -> Zalina's Need Check -> today's modal
retained `view=overview`; closing restored Overview and the initiating link's
focus. Footer version18 verified. Screenshot:
`/tmp/mobo-workday-direct-card-production-12118.jpg`.
Physical-phone execution of this desktop navigation was not tested.

Server commit/public health independently verified. All runtime env values and
upload mounts matched; the stored Nov2 closed day and checklist hash matched.
Root log `/home/bela/workday-card-12118-retry-release.log` ends
`RELEASE_VERIFIED_AND_REGISTERED` / `RELEASE_EXIT=0`. Registered images:
- current18: `sha256:4ecc55d58e535fe27eb7d46988bb5551aafe07a86ad7825b52eb7db69e54af78`
- previous17: `sha256:4b16f272cf1a57463d71e69c1aa6c409f21852ee08b1d13e7b87039f9011e3c3`
- previous16: `sha256:a4353e429002604180bbe9032ae9c49bdb2074d76a0eb2fdca65a6c06e9684da`
All three exist. Final free disk15.85GiB; parent lock released before registration.
Unrelated checkouts/dirty files untouched. Documentation committed separately.

## Earlier connectivity interruption

During the preceding17 release, HTTPS and SSH timed out approximately
20:03–20:09 Moscow, including the owner's phone on mobile internet. GitHub and
Apple remained reachable. Our first18 unit only waited and timed out at20:15;
it never checked out or built18. It was safe to retry the exact runtime18.

Read-only root diagnostic `/home/bela/portal-availability-20261103.log` exited0.
No reboot (uptime17days), kernel OOM kills0, no disk exhaustion; current portal
healthy, OOMKilledfalse, restartCount0. Docker records the ordinary replacement
at17:02:30UTC; proxy briefly lacked portal-app at17:02:28. This does not establish
the cause of the longer simultaneous SSH/TLS outage. No firewall, VPN or network
configuration was changed and no VPS reboot was issued. Do not claim a proven
root cause or confuse recovery with a tested fix for that interruption.
