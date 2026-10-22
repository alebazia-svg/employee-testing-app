# Portal author identity and wording — owner decision, 2026-10-22

Status: released to production as 1.13.5; simplified real-component comparison reviewed; owner accepted the remaining wording and requested removing the redundant «Понятно» from waiting closing/encashment sheets. The owner subsequently explicitly approved deployment with «выпускай». Arbitrary task assignment is an explicitly labeled illustration, not an approved new workflow.

## Verified owner identity

Production ADMIN → Employees → Administrators was read on 2026-10-22. The single administrator row has login `admin`, display name `Администратор`, marker `Ваш аккаунт`, payroll name `Кештова Бэла` and salary type label `Операционное управление`. Thus the owner already has a user/payroll association. Do not ask her surname again or create a duplicate user, payroll row or a parallel identity mapping. Human-facing signature is **Кештова Бэла** (surname first, owner clarification). Payroll's canonical name/order and calculation rules remain unchanged. Do not infer an official job title from a salary type; the owner explicitly rejected «Руководитель» and the ambiguous «Управление» label.

## Agreed presentation

- Profile: real full name, subordinate functional role «Администратор» (owner shortened the profile label on 2026-10-22); initials from the actual name. Do not hardcode a separate identity into each page. Implementation must use authenticated user/verified existing association and actual message/decision author, including other administrators.
- Personal messages/replies: author name and time. Role is not repeated on each message.
- Decisions: result and practical consequence in the short notification; author and time in details/history. Do not repeat the author's name throughout the list.
- Automatic messages: factual event/action; omit repeated MOBO/automatic/reminder prefixes in the list. Explain automatic verification in details when useful.
- Requests: buttons name the requested action. Pending agreement is «Ожидает согласования»; saved/sent does not mean read, received by a person, financially posted or resolved.
- Preserve safety-relevant facts: shift remains open, cash must not be deposited again, encashment is not confirmed, and 1C posting/receipt status.
- «Понятно» removed only from waiting closing/encashment panels. Existing cross and list Back remain.

## Implementation boundary

Approved wording and identity propagation are deployed in production 1.13.5. The authenticated ADMIN layout passes only the public display name into a client context; generic accounts use their existing payroll association as the fallback identity. Owner display order is surname then first name: Кештова Бэла. Payroll identifiers, formulas, roles and permissions remain unchanged. Conversation and attention replies use the saved message author; historic inbox replies bind to the exact referenced message and entity. Decision details bind to the owned close request or exact payment event and keep the original access checks. No production user/profile/payroll or notification history writes were performed.

Verification: TypeScript and serial production build passed. Payroll tests: 78; workday tests: 153; focused identity/access/notification tests: 25; fiscal message tests: 27. Full fiscal rerun: 198 passed, 1 environment-dependent scenario skipped. Actual authenticated app tested against the isolated local employee_preview_salary database: ADMIN profile, employee reply name/time, pending close without acknowledgement button, decision details and history re-entry. Decision sheet checked at a 390px viewport, then viewport reset. Physical devices are not verified for this change; authenticated production ADMIN identity and visible version were checked after deployment. Local build metadata is not a released version.

Local comparison `/wording-review` and ignored `.wip/` fixtures must not be shipped. Future releases require owner authorization, current release/version checks and the VPS runbook. Arbitrary task assignment remains illustrative only.

## Production release record

- Owner authorization: «выпускай», 2026-10-22, OPERATIONS APPROVAL for the reviewed wording/identity changes and two waiting-panel acknowledgements. No new task workflow, payroll formulas, permission changes, migrations or production profile writes.
- Production target: `https://team.mobo-opt.ru`, VPS `/docker/employee-testing-app`, service `portal-app`.
- Version **1.13.5**; runtime commit **1c0d22e16701b2dbbc44a55d5aab9536fdbdef53**. Runtime implementation `f5da69c`; merged the already released procurement calendar 1.13.4, retaining its scheduling/deferral notification branches and applying only the approved needs-changes wording there.
- Public build `2026-10-22T17:53:59.211Z` (20:53 Moscow). Metadata revision remains null/source unknown; commit was verified independently from server Git HEAD and the pinned build script, not inferred from metadata.
- Previous release 1.13.4 runtime `803a0f7799e1a05c3b79dce921521aff38238790`; image `sha256:e72975b706c981a7df73b78e2aa1c1d8a44bdc60b00cb6a06d8bad35e7094320`, preserved as `portal-app:rollback-before-1.13.5`. No schema delta; rollback is schema-compatible.
- New image `sha256:1347a05b913c2325633a8b5728b8295f0c63a7198701fe673bdf591719545688`; container healthy. Registered verified image only after independent public/server/authenticated UI checks. Terminal deploy exit 0; env hash, existing uploads/runtime mounts and payroll activation flags unchanged. Initial free space 19.93 GiB; all three existing registry images checked before building. No cleanup/migrations performed.
- Final clean source archive excluded untracked comparison/ignored fixtures. Serial build, TypeScript, 47 merged notification/access/procurement checks, 5 release-info checks and diff-check passed. Prior implementation checks: 78 payroll, 153 workday, 198 fiscal passed (one environment-dependent fixture skipped). ADMIN production profile shows «Кештова Бэла» / «Администратор»; footer 1.13.5, 22.10.2026 20:53 MSK. Public health ok; main page route checks no 500; `/wording-review` 404.
- Employee interactions were verified against isolated demo data before deployment; production employee mutations, physical devices and external delivery were not exercised. Unrelated original-checkout WIP and server `.rollback/` left untouched.
- Local evidence: `/tmp/mobo-wording-1.13.5.log`; server safe image/mount records `/tmp/mobo-wording-1.13.5-before.json`, `/tmp/mobo-wording-1.13.5-after.json`; screenshot `portal-wording-production-1.13.5.png` in the owner visualization directory. Exact runtime file list: `git diff --name-only a4dee53..1c0d22e`.
