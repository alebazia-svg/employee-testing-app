# ADMIN page journal — interface preview, 6 November 2026

Owner requested a page journal per browser with opening times, separating service
Codex/Claude browsers, and explicitly requested seeing the interface first.
Current phase: approved local interface preview; visual approval pending.
No production collection, API, schema migration or deployment in this phase.

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
