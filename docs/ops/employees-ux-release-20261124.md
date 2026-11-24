# Employees directory UI — MOBO 1.25.23

Installed and registered on 24 November 2026. Runtime commit
`5c30276e4c0c2a18c268b53e98432dd53d7920f9`, based on the exact live
1.25.22 commit `fc075d0`. The maintained branch merge `bcf88f9` preserves
pending changes outside the runtime image.

The release changes the ADMIN employee directory layout, wording and menu
entry points. Existing history, employee inspection, access and settings
handlers are reused. Demo snapshot data and demo guards are absent. The image
contains no migration, deployment configuration or employee runtime changes.

Verified locally: build, typecheck, 13 existing tests, retail and procurement
inspection entry points, empty schedule and procurement calendar comparison,
cancel flows, unchanged fixture users, password hashes, shifts and schedules.
Verified after installation: public version/build metadata, health, server
commit, authenticated ADMIN version label, eight employee rows, stable desktop
row positions, history, settings and access cancellation, cabinet entry and
return. At 390 px in Edge, checked mobile cards, payroll details, management
disclosure and horizontal fit. Physical iPhone verification is pending
mirror unlock.

Session `223f45e79a7e443e8c3deabca78d0b86` reported COMPLETE.
Image `sha256:9bdacca717efeeca88472450a5c49903bd85da8ff18d7589510cbe25e2990f2a`.
Protected reserves are 1.25.22 and 1.25.21. Exact verified archive retained in
the standard Mac archive store. No rollback was needed.
