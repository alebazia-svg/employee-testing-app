# Employee sign-in renewal 1.25.26

Released 25 November 2026 (Moscow). The live source is
`b081ac5533a8e4e1d78abbbd125131a51ea41ea1`, built at
`2026-11-24T23:05:25.648Z`. The exact amd64 image is
`sha256:b3e2bbf036d44f6ad48e2a58a10b67433cad022e7b58af79097eee82d57c8d21`.
Canonical integration is `c72e465`. Guarded session
`0c8b11f1cc1b403e9d464f15a986ded0` reached COMPLETE.

A foreground opening or recent interaction can extend a valid employee
session to 30 days when at most seven days remain. ADMIN, background traffic
and expired sessions do not renew. The signed primary cookie remains readable
by the preceding release. The journal retains the original sign-in during
renewal. No Prisma schema, Compose, startup, UI pages or receipt flags changed.

- On isolated data, verified the 5-to-30-day transition in an ordinary tab,
  installed Mac app and physical iPhone 17 PWA over HTTPS, without a password
  or new authorization. The preceding 1.25.25 runtime accepted the renewed
  primary cookie. Candidate HTTP tests covered background and ADMIN exclusion,
  expired sessions, manual logout and the original journal identity.
- Candidate isolated ADMIN preview tests covered retail, wholesale, procurement
  helper and buyer roles, nested device/setup/help/notification reads, retry
  states and zero employee-record mutations. Five pre-existing fixture failures
  in push and handover tests matched the 1.25.25 baseline.
- After installation, checked both public origins, health, VPS revision,
  visible ADMIN 1.25.26, existing ADMIN login, devices and sign-ins, the
  employee Workday and calendar preview, and the same saved Luxo receipt in
  ADMIN and the buyer preview. Workday notifications and procurement planning
  services reported successful executions after installation.
- Production PWA login on the physical iPhone was not repeated after
  installation because iPhone Mirroring was locked. The changed renewal
  transition was independently exercised on the physical device over HTTPS
  on isolated data before release.

The prior 1.25.25 image
`sha256:a5bb49a3a6a4c278e8cffe6d2e346d7080542d2ca45754b8e375ca8bebd0b91c`
and 1.25.24 remain pinned. The verified original archive is retained in the
protected local archive store.
