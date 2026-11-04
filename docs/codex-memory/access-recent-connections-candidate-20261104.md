# Recent connections — approved first stage, local candidate

Phase: launch hardening / pilot. Owner approved implementation on 4 November
2026 and requested the real screen before release. No deployment authorized.
Base: origin/design-local-updates 4590581, package version 1.21.23 retained for
local testing. Choose a new version only during a separately approved release.

## Decision and scope

This explicitly revises the no-cutoff device-card decision of 18 October:
current employee and service device cards show connections whose last contact
is within seven rolling days, including the exact boundary. Older connections
stay in the full history and reappear automatically after a new contact.
An employee with only old connections retains a compact last-contact summary
and a direct history link, preserving employee visibility. Expiry, logout,
push subscriptions, names, classifications and records are not changed.

Saved names, exact browser grouping and current-browser identification remain.
Name labels are administrator assignments, not proof of a physical user's identity.
Statuses distinguish last contact, authorization, stale data, notification state
and available updates. No new online-status inference or forced update behavior.

Search covers employee/login, device/browser, saved name and partial/full
connection codes. History applies search before pagination and offers a period
for last contact or authorization, with inclusive Moscow calendar dates and
explicit invalid-period feedback. Existing history remains complete.

ADMIN page/action audit is explicitly deferred. The initial list stage does not
change collection; the separately approved collection follow-up is described below.
No schema/migration or authentication policy changes. No production data, pushes
or update commands.

## Local verification and review

Actual production-mode Next application on 127.0.0.1:3244 with an isolated
PostgreSQL access_demo database on port 55504. Synthetic examples only; no
production DB copied. Example names carry “пример” and the account shows
“Локальный просмотр · демоданные”. Demo credentials/fixtures stay outside Git.

Boundary/return/name preservation, compact dormant summary, service grouping,
code/name search, statuses and history pagination/date behavior have automated
coverage. Actual PostgreSQL integration checks search across more than one
page, expired/inactive-account history and inclusive Moscow date boundaries.
Existing authorization/classification/current-browser checks remain in scope.
UI and server test groups require separate React conditions.

Verification: TypeScript, production build and whitespace check passed.
UI/helper group 33 passed; isolated PostgreSQL integration 1 passed; server
policy/auth group 18 passed, 1 legacy PostgreSQL test skipped (its separate
port-55451 fixture was not configured). No failures. Interactive actual-screen
review confirmed old-code and saved-name history search, contact vs login
periods, reversed-period error, reset, details/close and preserved service names.
An isolated demo contact returned Diana's same connection to the current list;
the fixture was then restored. Desktop 1366px and normal narrow 375px layout
were inspected, with no horizontal overflow in the history form. Temporary
viewport overrides were reset. No physical phone test performed.

Owner approval is still needed for the resulting local interface and any release.
Responsive browser checks do not verify physical iPhone/PWA delivery or reload.
The main checkout's unrelated dirty files are untouched; work is isolated in
the access-recent-connections managed worktree.

## Approved automatic device evidence follow-up — 4 November

Owner approved automatic maximum available useful device/browser diagnostics,
fixes to misleading provenance and a real-screen review before release. Preserve
assigned device names. No employee actions, new permission prompts, Shortcuts,
MDM, fingerprinting, deployment or production data changes authorized.

The existing bounded Client Hints collector is extended, not replaced. JSON now
optionally carries per-field sources, collection outcome and sample timestamp.
Partial hints never relabel fallback UA values as expanded evidence. Low-entropy
platform remains usable when higher-entropy values fail. Different platforms
cannot share a fallback OS version; expected browser brand wins over GREASE.

Collector shares concurrent reads, retries partial/timeout/error results after
one minute (at most three failed reads per mounted screen) and refreshes successful
results after five minutes while visible reports continue. Unsupported browsers
are not repeatedly queried. All calls retain the 700ms deadline. Server activity
throttle and browser identity/naming/classification policies stay intact.
Device sample time survives cached heartbeat retransmission; future sample times
cannot claim a fresh check. Old clients without the new fields remain accepted.

Main rows do not present UA OS versions or legacy mixed-source values as confirmed
installed OS versions. Details distinguish browser version, OS report, per-field
source and original values. Expanded values remain explicitly browser reports,
not independently verified hardware/person identity. No guessing iPhone model or
converting Safari version into iOS. Existing seven-day/history behavior retained.

No schema migration. New JSON is additive for current server validation, but an
old server parser will reject the additional keys from already-loaded new clients;
a release/rollback plan must account for that client/server compatibility.

Verification for this follow-up is recorded separately in the local review report.
Physical phone/PWA validation remains outstanding; synthetic browser cases do not
prove a particular employee's model or OS. Main checkout remains untouched.

Follow-up verification: 41 UI/helper/collector checks and 27 server/auth/journal
checks passed, including actual PostgreSQL provenance/sample-time persistence
in the isolated port-55504 DB. Production build, TypeScript (run after build),
and diff whitespace check passed. Real local browser automatically reported
macOS 26.6.2, full Chrome version and ARM architecture; readback confirmed the
new field sources and sample timestamp. Desktop and 375px narrow details were
reviewed; iOS raw 18.7 is retained only in technical evidence, Safari version
is separate, and assigned Mac Бэлы / Mac Аслана / Codex names remain unchanged.
No physical iPhone/Android test, no release or production write.
