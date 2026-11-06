# ADMIN page journal — approved collection and release, 7 November 2026

Owner requested a page journal per browser with opening times, separating service
Codex/Claude browsers, and explicitly requested seeing the interface first.
Current phase (7 November): owner approved the final interface and explicitly
approved real ADMIN visit collection and portal deployment. Release1.21.43 /
42f31523c656360833ebbfebf399f4d3a5ebc81e is installed, independently verified
and registered. Public build2026-11-06T22:03:40.443Z (7November01:03MSK).
No schema migration is needed. The earlier preview-only restrictions below are
historical; the approved final UI and preservation requirements remain binding.

The existing employee journal is restricted to EMPLOYEE and employee/procurement
paths. It is not an ADMIN page audit. Preserve that boundary until a reviewed
implementation is approved. The access journal's lastInteractionAt is a timestamp,
not an ordered page history. Existing saved device names/grouping remain intact.

Current owner-approved preview (7November): no separate page tab and no per-card
journal buttons. Existing Details opens Info/Visits tabs within one modal. A single
compact Visits of pages button above the cards opens the general journal. Original
Info data, names/grouping, versions, push and contact timestamps are preserved.
General journal separates working/service Codex/Claude browsers. Full7day and
background-contact interpretation is in expandable help below shortened copy.

Preview route /admin/employees/access/pages-preview is a local entry only, gated
by ADMIN_PAGE_JOURNAL_PREVIEW=1 plus PORTAL_ISOLATED_DEMO=1 and ordinary ADMIN auth.
Uses known isolated demo DB localhost55504; no production data copied. All example
events are visibly fictional, including named Mac examples. Default7days summary,
per-browser day-grouped chronology, general table, code/date/search filters and
inline record details; distinct empty/not-started/loading/error demo states.
Earlier validation/revision sections below are historical and superseded where
these entry points changed. Real historical page visits are never reconstructed.

This is navigation observation only. Recording changed fields/business operations,
full URLs/query payloads, automatic identity attribution, employee tracking changes,
retention policy and production migrations are outside this preview.

## First preview validation — before the approved revision

Build and TypeScript passed. Real authenticated local application on127.0.0.1:3244
reviewed in visible IAB. Working browser filter2rows; week adds previous-day row;
date5November shows2examples. Service switch shows Codex connections1/2 and Claude;
Codex filter retains both codes. Search empty state and reset reviewed. Details
open/close with Escape and preserve filters.375px view has no horizontal overflow;
modal fits width322px with internal scrolling. Temporary viewport reset. Physical
phones not tested. Existing production screen/data/schema left unchanged; unrelated
files untouched. No release push, migration or real collection enabled.

Preview files:
- app/(dashboard)/admin/employees/access/pages-preview/page.tsx
- app/(dashboard)/admin/employees/access/pages-preview/AdminPageJournalPreview.tsx
- app/(dashboard)/admin/employees/access/pages-preview/admin-page-journal-preview.css

## Revision on7November — implementation boundary

Approved local preview only: journal inside existing browser cards plus one general
button above the cards. Journal is a single focused modal, with inline native
expanders for record details; no nested dialogs. Per-card journal stays limited to
that device, with a connection-code filter when grouped (Codex two connections).
General journal defaults to working browsers and separates service Codex/Claude.
Demo dates updated to7November. Preserved named Mac/iPhone/Codex/Claude cards.
No production release, collection endpoint, schema migration or identity writes.
Only shared-view changes are two optional presentation slots, inactive by default.

Revised preview validation: production build, TypeScript,37existing access UI tests
passed. Live demo verified: exactly3old section tabs,5named browser cards,1journal
button per card (Codex remains one card with2connections), top general journal.
Aslan illustrative journal2today/3week/1on6November; Codex2codes→single-code filter1;
empty search and zero-event iPhone explicit state; general working4/service3.
Record details expand inline in same dialog. Escape restores focus to the original
card button.375px main has no horizontal overflow; dialog width343px with content
scrollWidth=clientWidth326px and internal vertical scroll. Temporary viewport reset.
Screenshots /tmp/admin-journal-cards-preview.jpg, /tmp/admin-journal-card-modal.jpg,
/tmp/admin-journal-general-modal.jpg. Physical phones not tested. Nothing deployed.
Additional changed shared file: components/PortalAccessDevices.tsx (only two
optional render slots). Scoped memory index: docs/codex-memory/project-index.md.
No unrelated dirty files were reverted, staged or included in commits.

## Five-point content revision — owner approval, 7 November

Owner approved only the journal window revision; cards, buttons and names must
remain unchanged, preview before any release. The source from fixtureRows through
host/card actions is retained byte-for-byte against the preceding preview.

- Compact header: device/browser/short code once; explicit fictional-data banner
  retained. Default range7days, compact period selector; search/code filters expand
  on request. General browser scope stays separate from service scope.
- Summary: latest recorded opening, number of openings and distinct sections for
  selected browser/range, independent of text search; search shows X of Y instead
  of silently redefining summary totals. Empty data yields0; errors/loading/no
  collection do not display zero-visit statistics.
- Per-device chronological list grouped by Today/Yesterday/exact date; repeat name
  and account removed from rows. General journal remains table with browser name.
  Exact seconds/full date, individual code, account/path/prior section stay inline.
- Coverage example and Only visits marker visible; additional interpretation in
  one expandable help. No mutation/duration/person inference.
- Distinct recorded-empty, not-started, loading and load-error states. Error retry
  is a simulation only. Preview-only state selector lives in a collapsed footer
  expander, separate from the proposed production controls. No backend change.

Five-point revision verified: build and TypeScript pass. Actual local authenticated
UI: per-browser default7days shows3openings/3sections, latest14:28; Today2;
6November1with summary17:12/1/1. Text search matches1of3 while totals remain3/3.
Codex grouped journal2→codefilter1; general working6/service3. Exact timestamp/code
and path expand inline; one dialog remains. Simulated error has no summary zeros,
retry returns fixtures; not-started/loading/empty distinct, empty0with latest—.
375×812: first record top454px versus636px in previous version; modal content
scrollWidth=clientWidth341px, no horizontal overflow.1280px general table and
per-browser chronology reviewed visually. Temporary viewport reset; updated
per-browser journal left open as deliverable. Screenshots:
/tmp/admin-journal-refined-browser.jpg, /tmp/admin-journal-refined-general.jpg,
/tmp/admin-journal-refined-mobile.jpg. Physical phones not tested. All events are
illustrative; real capture, backend reliability, long histories remain unimplemented.

This revision changes only preview AdminPageJournalPreview.tsx and its scoped
admin-page-journal-preview.css, plus this memory note. The shared-card file and
outer route are untouched in this revision. Main fixture/card/action source hash
matches the preceding revision exactly. No release/version change, production
DB writes, schema changes or deployment. Unrelated existing dirty files preserved.

## Consolidated entry — owner approval, 7 November

Owner explicitly approved replacing the repeated per-card Page journal buttons
with Visits inside existing Details, and a compact top Visits of pages button.
Shorten explanatory prose while preserving device names and all device data.
Preview first; no release or collection authorized in this phase.

Current preview uses ConnectionHelp's optional pages slot and Info/Visits tabs.
Original Info content is retained intact; both panels stay mounted to retain
filters when switching. Arrow/Home/End keyboard navigation follows tab semantics;
one modal only. Existing callers without pages keep the original presentation.
Per-connection Codex Details initially select that connection; the existing grouped
code filter can show both. Standalone general modal retains working/service split.
Main copy shortened with full7day/automatic-contact explanation in expandable help.
No device fixture values/names changed (source hash compared to prior preview).
Old renderGroupAction slot is unused by this preview, not removed/refactored.

Consolidated entry validated: build, TypeScript and37existing UI tests pass.
Main has0per-card journal actions,1compact Visits of pages action, all3original
section tabs/5device groups/6connection rows retained. Fixture source hash exact.
Info panel original facts retained; Visits panel opens within the SAME dialog,
Today filter survives Info→Visits switch. ArrowRight/End tab keyboard handling
verified. Codex second connection starts with1visit; All codes shows2. General
working6/service3.375px general dialog scrollWidth=clientWidth326px; embedded
Visits likewise326px and exactly1open dialog. Temporary viewport reset. Physical
phones not tested. Latest local screenshot paths /tmp/access-visits-quiet-page.jpg,
/tmp/access-visits-in-details.jpg, /tmp/access-visits-in-details-mobile.jpg.
Current local deliverable left open on Visits. No deployment/real capture enabled.

## Approved production collection — 7 November 2026

- Reuses PortalActivityEvent with kind=admin_page and independent coverage id=2.
  Employee collection/coverage id=1 stays unchanged. No schema/migration changes.
- AdminShell observes visible route transitions after350ms. Same-page reloads
  within30seconds are suppressed per session; A→B→A remains visible. Background
  refreshes/polls never emit visits. A visible return after30seconds may emit one.
- Closed catalogue of ADMIN sections and recognized access/tax query tab enums;
  detail identifiers normalize to [id]. No arbitrary URL/query/form/search data.
  Preview/dev/employee routes are excluded.
- Same-origin authenticated ADMIN API, small input, active user/session, exact
  signed-session hash and immutable UUID cookie/binding; reject observed-ID
  mismatches, expired/logged-out sessions. Bounded retries after identity setup.
  No identity cookie creation, owner rename/grouping, auth or push writes.
- Server timestamp (Moscow display), exact browser code, normalized page, optional
  prior page, cabinet. Not an action/change audit, person identification or duration
  evidence. Browser/client telemetry is best effort; no retrospective reconstruction.
- Retention90days,600events/session/day cap, idempotency and bounded cleanup.
  General journal: work/service separated, Codex/Claude labels read from existing
  saved owners, existing confirmed group IDs retained with separate exact codes.
- Summary covers the entire selected range/browser scope, independently of text
  search. Keyset pages of50, explicit load-more error, request cancellation and
  distinct loading/not-started/empty/failure states. No demo fixtures in production.

Verification before release: build, tsc,41 UI/policy tests,44 server regression
tests (3 existing DB-dependent tests skipped), new isolated PostgreSQL integration
test, real localhost HTTP authorization/binding test,5 release-info tests passed.
Live isolated UI: real transitions/readback, search1of3 with summary3, preserved
Info tab, embedded Visits, mobile375px single dialog/no horizontal overflow,
network failure shown explicitly. Full-site regression and actual employee devices
are not exhaustively tested; production preservation proof is required below.

## Verified production result

- Server/runtime commit42f31523c656360833ebbfebf399f4d3a5ebc81e, both public
  hosts(team.mobo-opt.ru and portal.alebazia.xyz) report1.21.43 and identical
  build2026-11-06T22:03:40.443Z. Authenticated footer and Info tab show1.21.43.
  Metadata revision=null/source=unknown is existing behavior; commit checked by SSH.
- Healthy image sha256:41262568aef851dddaee9dd77555110889382f411917753c589e4e3d8b0087e5
  registered, plus two verified reserves7b3c567f… /deffb767…. Every image independently
  inspected by finalization. Approved storage maintenance succeeded;18.11GiB free.
- Release and finalization scripts exited0. Root proof/logs:
  /root/admin-pages-20261107/facts.before.json, facts.after.json, facts.final.json;
  /home/bela/admin-pages-release-20261107.log and admin-pages-finish-20261107.log.
  All9 owner/label/group rows unchanged; all127 preexisting sessions retained
  with identity/classification intact;10 account authorization hashes and35
  existing subscription identities/keys unchanged. Schema/migrations, server.env,
  normalized mounts and workday notification units unchanged. No migration run.
- Real collection began7November01:10MSK. Authenticated service journal showed
 5 real openings across3 sections after our visible navigation through Employees
  and Access. Exact current Codex code534630d9-b7c5-4d4e-8960-e096c41bc51b
  selected as connection2; grouped code389754da-8a0b-4b9b-b2ff-06a4962f658e
  remained separately selectable as connection1. Claude0de10d6c… is a separate
  service filter option; saved labels unchanged. No fabricated Aslan/other-user visits.
- Production desktop and375px UI verified, including expanded real UUID selector: one
  dialog,334px content/scroll widths(no overflow), original Info data retained,
  embedded Visits, existing three main tabs, one compact top button. General work
  empty/service populated states correctly separated. New module performs only
  page telemetry; all other module business flows were not exhaustively replayed.
- Screenshot /tmp/portal-visits-1.21.43.jpg; live journal left open in visible IAB.
  Earlier page visits cannot be reconstructed. Existing clients record only after
  loading the new code; telemetry remains best effort, not proof of a human identity.

Exact runtime/test files in release42f3152:

- app/api/admin/employees/access/pages/route.ts
- app/layout.tsx
- components/AdminPageJournal.tsx
- components/AdminPageVisitTracker.tsx
- components/AdminShell.tsx
- components/PortalAccessDevices.tsx
- components/admin-page-journal.css
- lib/admin-page-journal.ts
- lib/admin-page-policy.ts
- package.json
- package-lock.json
- tests/admin-page-journal-http.test.ts
- tests/admin-page-journal.integration.test.ts
- tests/admin-page-policy.test.ts

The same branch also preserves the earlier approved preview commitd72651c:
app/(dashboard)/admin/employees/access/pages-preview/page.tsx,
AdminPageJournalPreview.tsx, admin-page-journal-preview.css and shared device
component hooks. The route requires both isolated-demo and preview flags.
Documentation-only changes are separate from runtime; unrelated Projects checkout
files were not changed. Existing upstream Procurement/tax changes were merged
from c887cef and preserved. No payroll/OFD/attendance/1C/business logic changed.
