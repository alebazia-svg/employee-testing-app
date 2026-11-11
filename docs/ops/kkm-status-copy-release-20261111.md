# Employee cash-status wording - release 1.24.5

Released and independently verified on11November2026. Owner approved the real before/after screenshots, explicitly limited the change to wording, then authorised publication and post-install visual verification.

## Exact scope

Only four phrases in EmployeeTodayClient.tsx changed:

| Previous | Approved |
| --- | --- |
| По 1С кассовая смена не открывалась · сверка ОФД продолжается | Кассу сегодня не открывали · проверка продолжается |
| Кассовая смена не открывалась · закрытие не требуется | Проверено: кассу сегодня не открывали |
| Касса подтверждена · смена сдана | Закрытие кассы подтверждено |
| Чек закрытия сохранён | Чек сохранён · проверяем закрытие кассы |

Existing completed-shift heading/time, conditions, priorities, controls, colours and all checking mechanisms retained. The existing not-printed wording remains. ADMIN source terminology unchanged. No fix to the separately identified partial-OFD-endpoint outage gap is included.

Reversing exactly these four text substitutions restores the original component byte-for-byte. The component equals the owner-approved local preview. Runtime diff from installed1.24.4 is exactly:

- app/(dashboard)/employee/EmployeeTodayClient.tsx
- package.json
- package-lock.json

No demonstration-only next.config change or preview assets are shipped.

## Source and artifact

Baseline1.24.4 /9bde3a460730f6cd94bfaaaf7b4f3be5e3a2d894 was installed and verified by the company-card chat before this release. Its cards and the previously installed payment-calendar changes are preserved. Uninstalled warehouse changes/migration in design-local-updates remain excluded through the existing isolated runtime workflow.

Runtime1.24.5 /6501f2fd2e569a8143c09c5e96fc662fc6f18bf3, origin/codex/kkm-status-copy-20261111. Feature-only wording commit a2e212b is already in the maintained source. Earlier local candidate bb08559 numbered1.24.4 was cancelled before installation when the company-card release was identified; no changed runtime was shipped under an existing version.

Image sha256:c1d9fb24d7b2ea4042164a7c0ffbacf95dc25b7b73c085242d17da7f73a9118b.
Archive SHA256 eae73686b747af66b91aad5a4297baa55bb183f5dc1223e48c7577a7e7db9b69.
Build2026-11-11T14:30:25.900Z (17:30MSK). Built on Mac for linux/amd64 with2CPU/4GiB builder and build-only heap3072MiB/Rayon2. No server compilation.

## Validation

- TypeScript, production image build,40 neighboring KKM/checking tests and5 release metadata tests passed.
- Artifact comparison with installed baseline:522 lib files,86 Prisma files,50 scripts,275 public assets excluding release metadata,14 CSS files and next.config byte-identical.
- Deployed employee client chunk /_next/static/chunks/5198-990c016afde1d449.js has SHA256 ac9e2220fe6baad117d66ef4158b301d9dccbe85868f6c79d9302e92578813fd, matching the independently downloaded public HTTP response and the exact locally tested image. All four approved phrases present; old technical phrases absent from that component.
- After installation, all four real employee UI states were inspected on the identical installed image against isolated demonstration data. Screenshots captured at390x844; headings/time/styles preserved, no overflow. Agreed strings match exactly. This does not claim synthetic states were written to production or every state occurred naturally on production today. Physical iPhone not tested.
- Public health ok, exact SSH commit and healthy running image verified. Authenticated ADMIN footer and public metadata both1.24.5/build11November17:30MSK. Existing metadata revision remains null/unknown; source commit checked separately.
- Before/after server fingerprints prove lib/scripts/Prisma/next.config,server.env,runtime environment,mounts and notification/OFD-collector units unchanged.10users,11browser owners,9templates,5cashbox mappings,333existing upload hashes and151session identity records retained.174workday/755schedule/109cash-operation/1741notification IDs retained. Zukhra saved handover cash/photo/input history and independent credit issue preserved. No new/pending migration; no manual production data/1C writes.

## Installation and retention

Initial capacity was below15GiB. Owner separately approved deletion of exactly the unused retired1.24.0 image456b4e8..., unused node:22-alpine cache0e17547..., and retired1.24.1 image2d428a7... after the company-card release rotated it out of the registry. Each action rechecked exact tags, all containers and protected registry. No other image/container/volume/upload/backup deletion. The initial capacity gate passed at15.23GiB before this import.

Shared storage flock, exact stale-base/source-file gates, rollback tag and archive checksum protect the streamed installation. Only portal-app recreated with --no-build. Installation exited0. After independent verification registered current c1d9fb2... plus verified reserves7d570f2... (1.24.4) and bac176e... (1.24.3); all three exist. Final free space approximately14GiB after import;15GiB is a retention target, not a hard quota. No security settings changed.

Worker:/home/bela/mobo-kkm-copy-1.24.5-install.sh.
Log:/home/bela/mobo-kkm-copy-1.24.5-install.log.
Preservation evidence:/root/mobo-kkm-copy-1.24.5-20261111/.
Installed-text proof:/home/bela/mobo-kkm-copy-1.24.5-installed-text-check.json.
Visual proof:/tmp/kkm-copy-installed-1.24.5.jpg; four full real screenshots and interactive gallery in the isolated preview public/kkm-copy-installed-1.24.5/.
Unrelated dirty files/worktrees left untouched. Documentation is committed separately from runtime code.
