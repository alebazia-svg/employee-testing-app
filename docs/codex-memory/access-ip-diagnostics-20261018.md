# Access IP diagnostics — production 1.5.10

Released 18 October 2026, runtime commit
`bf3250b78213f2cb5df63921531b8eb40a601116`. Public build time
`2026-10-18T15:51:26.127Z` (18:51 Moscow). Server commit, healthy container,
HTTP 200 health, public metadata and live ADMIN version 1.5.10 verified.
Runtime `PORTAL_ACCESS_TRUST_REAL_IP=1` independently read back from container.
Live details at 18:55 showed an IP and observation time on the current Codex
connection. The inactive Windows connection from 16 October still showed
“Ещё не записан”; no historical backfill. Main employee list no longer shows
the redundant setup instruction. Owner labels remained unchanged.

Verification: 30 focused tests, 5 release tests, TypeScript, isolated local
production build and final server build passed. Ingress guard rechecked image,
forwarding configuration, mounts, middleware and unpublished app port before
deploy. No schema migrations, env-file edits, 1C changes or manual DB writes.
Rollback image: `mobo-access-rollback:1.5.9`. Screenshot:
`/tmp/mobo-access-ip-1.5.10.png`. Metadata revision is still unknown in Docker;
commit was verified separately from the server checkout.

Owner approved collecting IP as an auxiliary connection diagnostic. Never use
it to infer a person, merge devices, grant access or retrospectively relabel
sessions. Same IP may represent different devices; different IPs may represent
the same browser. No geolocation or extra external service is added.

## Existing implementation reused

- `lib/portal-access-network.ts` accepts only a valid single `X-Real-IP` with
  explicit runtime opt-in. It ignores `X-Forwarded-For` and is disabled outside
  the verified production compose by default.
- Login/activity already persist `lastIp` and `ipCheckedAt` in the session.
  This is the **latest observed address**, not an immutable login-time IP and
  not a complete address-change history. Existing activity throttling remains.
- Existing ADMIN details (including details opened from history) show the IP
  and its observation time. No IP clutter is added to the employee list.
- Historical missing addresses are not reconstructed or filled retroactively.
  No schema migration or manual database change is required.

## Read-only VPS ingress audit, 18 October 2026

- Running proxy: Traefik 3.7.0,
  `traefik@sha256:eb328e2c806c53aafbbace6c451fa54d268961261a85452fcf0fb752a30c17be`.
- Host network, web/websecure entry points 80/443. Running arguments contain
  no forwarded-header trust/insecure option or PROXY protocol override; no
  relevant environment override. Only mounted configuration is dynamic.yml.
- Dynamic configuration has no custom request headers, forward-auth or plugin
  changing the incoming IP. The websecure security-headers middleware and
  portal router were inspected. Portal has no additional HTTPS middleware.
- `portal-app` has empty host port bindings and `3000/tcp: null`; no direct
  published application port. Both portal domains resolve to the same VPS.
- Exact-version upstream implementation removes untrusted forwarded headers,
  including X-Real-IP, and writes the peer address:
  https://github.com/traefik/traefik/blob/v3.7.0/pkg/middlewares/forwardedheaders/forwarded_header.go
- No proxy changes, production application changes or diagnostic endpoint were
  installed during audit. This is configuration/source verification, not an
  end-to-end production spoofing test.

## Release gate

`docker-compose.portal.yml` enables `PORTAL_ACCESS_TRUST_REAL_IP=1`
for this verified ingress. Before subsequent releases recheck ingress has not
changed; preserve no published app
port and no arbitrary forwarded-header trust. If either condition changes,
disable collection until the new path is verified. Never enable the flag in
an exposed standalone dev server.

After an approved versioned release, independently verify the runtime flag,
real current connection IP/time through ADMIN details and that older unknown
records remain unknown. Do not claim collection is active before readback.

Also remove the redundant notification setup instruction under disconnected
badges in the main list. Detailed help remains in the modal; actual recent
delivery failures remain visible in the list.
