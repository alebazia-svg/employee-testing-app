# Procurement mobile layout — released 1.21.49, 8 November 2026

Owner approved only restoring Astemir's broken Procurement composition and scroll
clearance, then explicitly approved release. Notification unification/all-task
lists and new forced prompts remain deferred; they are not in this release.

Runtime commit `d37077092087bd5f256858ac8f7edd22c97f6f27` includes the one-line
placement correction in `components/ProcurementMobileCabinet.tsx` plus version
fields in `package.json` and `package-lock.json`. The existing reminder/setup
container is inside the original `procurement-mobile-pages` element again. This
restores the approved header/content seam and the existing 112px trailing box
above the floating navigation. No reminder copy, selection, priority, routing,
deferral, API, auth, financial policy, schema or migration changed.

## Validation and installation

Fresh isolated release checkout: production build and TypeScript passed;
45 focused behavior tests and 5 release-metadata tests passed. Existing local
authenticated demo: with/without reminders, long payment list, last row above
navigation, modal close/re-entry, retained scroll, Workday/Schedule/Procurement
and bell/back verified. Physical employee iPhone remains untested.

Production public metadata: 1.21.49, builtAt `2026-11-08T12:46:29.450Z`
(15:46 MSK). Metadata revision/source remain null/unknown; exact VPS HEAD was
independently verified as d370770. Running image
`sha256:f6cca74de0af97e3e1f55108b4c5102c55c7aeeb170cd56f48892349d6221e53`, healthy.
Authenticated ADMIN footer shows 1.21.49. Real Astemir inspection confirms the
content directly follows the header, copper CSS is versioned 1.21.49, trailing
box is 112px, bottom rows are reachable, and three tabs and bell/back work.
Inspection did not save/read/complete anything for an employee.

Before/after and final comparisons preserved 1603 notification read markers,
161 workdays, 736 schedule plans, 567 tasks, 104 cash operations; no existing
tracked business row changed. Configuration hashes preserved 10 users,
9 templates and 5 cashbox mappings; 324 mature upload paths/sizes preserved.
Environment hash, mounts and notification service/timer definitions unchanged.
No pending or new migration. Only portal-app built/restarted.

Initial preflight stopped before checkout/build because the newly pushed object
had not yet been fetched at the diff gate. Moved that operational gate after
fetch and retried the identical runtime/version. Prior app stayed healthy.
The second attempt completed `RELEASE_VERIFIED_AND_REGISTERED`, `RELEASE_EXIT=0`.
Current 1.21.49 and verified 1.21.48/1.21.47 images retained; 21.8 GiB free.
No other chat was messaged or interrupted. Existing dirty worktrees untouched.

Root evidence: `/root/mobo-procurement-layout-1.21.49-20261108/`.
Owner-readable log: `/home/bela/mobo-procurement-layout-1.21.49-release-r2.log`.
Local checks and screenshots: `/tmp/mobo-procurement-release-*.log`,
`/tmp/mobo-procurement-layout-release-20261108/production-{version,top,bottom}.jpg`.
Reviewed native launcher: `/tmp/mobo-procurement-layout-1.21.49-r2.command`.

## Separate read-only notification/help investigation — no implementation approved

Astemir's night test plans were cleared at 00:37 MSK; fresh 8–30 November plans
were entered 08:22–08:27 from his established iPhone PWA connection. The existing
Activity projection groups these with the night visits under the first time,
00:06, and requires several expansions to reach the morning saves.

Only recorded `work_help_ack` on 8 November was 00:07 MSK from Bela's night test
connection, not the morning employee connection. Daily acknowledgement is scoped
to the account, so an owner test login can suppress another automatic guide that
day. Do not claim the guide caused the morning schedule completion. Additionally,
the report loads the acknowledgement as a fact, but `buildProcessView` excludes
its raw event ID; a read-only reproduction confirmed that recorded fact yields
zero projected rows. Showing the guide itself is not currently a recorded event.

Muhamed's current ADMIN inspection renders both missing-today/tomorrow reminder
and notification-setup card. His iPhone last reported version 1.21.48 and push
not connected at 09:39 MSK; workday start is 09:40. These are dated facts, not
proof of a current physical screen or deliberate ignoring. Showing, pressing
Understood and actual task completion must remain separate conclusions.

Owner raised forced popups as an IDEA. Recommendation: first make help/activity
evidence trustworthy and distinguish actual employee from owner tests, then
consider targeted reminders rather than interrupting every operation. No changes
to help, acknowledgements, notifications or activity were included here. Earlier
credit/OFD timing work remains a separate deferred task.
