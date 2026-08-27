# Предпилотный аудит Offonika Portal

Дата среза: 2026-08-25.

## Дополнение: закрытие технических блокеров 2026-08-28

- Production обновлён с Next.js 14.2.15 до 15.5.24; SheetJS заменён на
  официальный пакет 0.20.3, PostCSS/nanoid/esbuild обновлены. `npm audit
  --omit=dev` возвращает 0 известных уязвимостей. TypeScript, production build
  и доменные тесты payroll, terminal, credit, expense и workday проходят.
- Загрузка фото уже ограничена 8 МБ и принимает только файлы с совпадающими
  MIME и сигнатурами JPG, PNG или WebP; focused tests проходят.
- Ежедневный локальный backup PostgreSQL/uploads работает. Ошибка с абсолютными
  `.tmp`-путями в `SHA256SUMS` исправлена. Свежая копия `20260827T222408Z`
  восстановлена в изолированном PostgreSQL: 51 public-таблица; архив uploads
  распакован и содержит 132 файла. Production DB не изменялась.
- Локальный restore доказан, но внешний backup target всё ещё не выбран. Потеря
  всего VPS остаётся незакрытым инфраструктурным риском.

## Дополнение: эксплуатационная проверка 2026-08-27

Портал на production commit
`bf8e3306698ceee995a2242b89fc1146a942b3ef` отвечает HTTP 200. Сборка и
доменные тесты проходят: terminal/acquiring 105/105, credit 19/19,
expense requests 38/38, payroll 10/10; production build успешен. Обычный
терминальный контроль теперь выполняется каждые пять минут и создаёт
сотруднику действие после безопасного пятнадцатиминутного ожидания. Кредитный
контроль ждёт минимум пятнадцать минут и две последовательные полные проверки.

При этом обнаружены новые фактические предпилотные блокеры:

| ID | Finding | Evidence and risk | Required closure |
| --- | --- | --- | --- |
| LB-8 | Ежедневный отчёт владельцу не запускается | `offonika-terminal-fiscal-owner-report.service` находится в `failed`, код `203/EXEC`. Production-файл `run-offonika-terminal-fiscal-owner-report.sh` не имеет executable bit. Финансовый контроль может выполниться, но итоговое предупреждение владельцу не уйдёт. | Установить скрипт с mode `0755`, запустить один безопасный контрольный прогон, проверить доставку и добавить оповещение о падении самого таймера. |
| LB-9 | Обновление кэша АУСН находится в `failed` | `ausn-report-cache-refresh.service` завершился с status 1. Без root-журнала точная причина не установлена. Кэшированный отчёт может продолжать выглядеть доступным после прекращения обновления. | Получить журнал от имени администратора, устранить причину и показывать пользователю время последнего полного обновления и состояние каждого источника. |
| LB-10 | Нет единого мониторинга внешних зависимостей и сроков услуг | Текущий код проверяет доступность 1С, СБИС/ОФД, Platforma OFD и Т-Банка во время бизнес-сверки, но не хранит срок договора/подписки и не предупреждает до отключения. `saby-ofd.ts` не извлекает дату окончания услуги. | Добавить Dependency Registry и ежедневный dependency watchdog с предупреждениями за 30/14/7/3/1 день, а также при первом отказе, повторном отказе и восстановлении. |
| LB-11 | Частично закрыт: локальный backup/restore доказан, внешней копии нет | Ежедневная копия, checksum и изолированное восстановление подтверждены 2026-08-28. Копия находится на том же VPS. | Выбрать защищённый внешний target, шифрование и проверить offsite readback. |
| LB-12 | Закрыт 2026-08-28 | `npm audit --omit=dev`: 0. Next.js 15.5.24, официальный SheetJS 0.20.3; полный regression/build зелёный. | Production smoke и наблюдение после обновления выполнены через healthcheck/watchdog; продолжить обычный мониторинг. |

### Обязательный реестр зависимостей

Для каждой зависимости должны храниться владелец, назначение, критичность,
способ проверки, последнее успешное чтение, допустимая задержка, срок услуги,
ссылка на продление и инструкция при отказе. Минимальный состав:

- VPS/хостинг, домен, DNS и TLS;
- PostgreSQL, volume uploads и внешний backup target;
- публикация 1С/AIAgentAPI, сервер 1С, лицензия и доступность нужных endpoints;
- СБИС/ОФД: договор/тариф, API-приложение и ключи;
- Platforma OFD: подписка, proxy и доступ к каждой ККТ;
- срок ФН и состояние каждой ККТ;
- Т-Банк API/терминалы и ВТБ mailbox/import chain;
- Telegram bot/admin recipient и Web Push VAPID;
- Google service account и таблица графика;
- срок действия локальных/банковских сертификатов, если они применяются.

Автоматически обнаруживаемые даты нужно получать из API или сертификата.
Коммерческие сроки, которые API не отдаёт, вводятся администратором вручную и
требуют периодического подтверждения. Нельзя считать успешный API-запрос
доказательством того, что подписка не закончится завтра.

### Политика отказов для пилота

- Один неполный запрос не создаёт обвинение сотруднику и не закрывает старое
  подтверждённое событие.
- Два последовательных отказа источника открывают ADMIN-инцидент; критический
  источник дополнительно дублируется владельцу.
- На экране всегда видны `последнее полное обновление`, затронутые процессы и
  понятное действие: продолжить локально, повторить позже или перейти на
  согласованный ручной режим.
- После восстановления система делает catch-up за пропущенный период,
  дедуплицирует события и отправляет отдельное сообщение о восстановлении.
- Отказ 1С или ОФД не должен порождать ложную ошибку менеджера. Он переводит
  контроль в `источник недоступен`; незавершённые финансовые записи не
  автопроводятся и не теряются.
- Полная PWA offline-работа не обещается: сейчас service worker обслуживает
  Web Push, но не кэширует интерфейс или бизнес-данные для общего offline режима.

### Обновлённый порядок до пилота

1. Восстановить owner report и AUSN cache refresh, затем проверить реальную
   доставку сообщения и отметку времени свежих данных.
2. Ввести dependency watchdog и реестр сроков хотя бы для OFD, 1C, банков,
   VPS/domain/TLS, Telegram/Web Push и backup.
3. Закрыть security dependency findings и ограничения загрузки изображений.
4. Настроить ежедневный внешний backup и выполнить восстановление в отдельную
   тестовую БД/директорию.
5. Добавить app healthcheck, контроль рестартов, диска, последнего успешного
   запуска каждого таймера и catch-up после простоя.
6. Выполнить failure drills: 1C off, OFD off, интернет телефона off,
   restart portal, задержка банка, push запрещён/протух, восстановление без
   дублей.
7. Проверить iPhone и Android, затем провести пилот на двух сотрудниках не менее
   пяти смен.

## Решение по запуску

Портал уже является полезным рабочим продуктом, а не декоративным прототипом:
основной путь рабочего дня, финансовые проверки, ADMIN, Inbox, Telegram и
защита инкассации собраны в связанную систему. Однако выдавать приложение всем
сотрудникам пока рано.

Разрешён следующий этап только после закрытия launch blockers:

```text
исправления безопасности и надёжности -> контролируемые failure/device drills
-> пилот на одном сотруднике Розницы и одном сотруднике Опта -> расширение
```

Пилот не должен использовать приложение как источник штрафов или окончательной
оценки дисциплины. До привязки плановой смены сотрудник сам выбирает смену после
QR, поэтому рассчитанное опоздание ещё не является независимым доказательством.

## Что проверено

- employee PWA: вход, QR, выбор смены, текущая задача, чек-листы, наличные,
  инкассация, сообщения, уведомления, расписание и граница offline;
- ADMIN: Главная, Inbox, Контроль дня, сотрудники, посещаемость, заявки,
  зарплата, служебные разделы, скрытые Analytics и Аттестации;
- API permissions, signed session, security headers and unauthenticated probes;
- production timers, container, recent logs, uploads volume and rollback data;
- production lifecycle/data state for workdays, tasks, issues, cash operations,
  notifications, Telegram deliveries, mappings, schedule and push subscriptions;
- 1C date formats and the consumers of sales realization dates;
- automated tests, TypeScript/build evidence and dependency audit.

Production evidence was collected read-only. No employee action, test financial
operation or 1C write was started during the audit.

## Launch blockers

| ID | Finding | Evidence and risk | Required closure |
| --- | --- | --- | --- |
| LB-1 | Inconsistent parsing of 1C dates | `sales-realizations` returns Russian dates. `/admin/1c` passes them to `new Date()`, so `12.06.2026` renders as 6 December. The core credit runner has a safe parser, but ADMIN Workday has another parser that does not accept this format. This can misstate a date or hide a matching realization. | Introduce one shared 1C datetime parser, migrate every consumer and add RU/ISO/timezone regression tests. |
| LB-2 | Push delivery can be recorded as sent when no device received it | Notification dispatch marks the portal notification `sent` when there is no subscription, Web Push is not configured or a transient send error occurs. There is no retry for a temporary push failure. The portal Inbox still keeps the event, but reminder reliability is overstated. | Separate portal creation from push delivery state, retry transient failures and expose/monitor failed delivery. Verify on real iPhone and Android. |
| LB-3 | Закрыт 2026-08-28 | `npm audit --omit=dev` reports 0 findings after isolated Next/SheetJS/PostCSS upgrade; domain regression and production build pass. | Continue dependency monitoring. |
| LB-4 | Частично закрыт 2026-08-28 | Daily DB/uploads backup, retention, checksums and isolated restore are proven. Offsite copy is not configured. | Select encrypted external target and prove offsite readback. |
| LB-5 | Закрыт | Employee uploads are capped at 8 MB and validated by allowlisted MIME plus JPG/PNG/WebP file signatures before full read; focused tests pass. | Monitor upload storage during pilot. |
| LB-6 | Production contains unresolved legacy lifecycle state | One workday remained active for more than two days; old cash operations remain in `pending_1c`/`created_1c`; an approved close request for a completed day has no consumption timestamp. Current automation can confuse this history with live exceptions. | Reconcile or explicitly archive legacy records through an audited migration/script and define the stale-day incident procedure. |
| LB-7 | QR/shift selection does not prove physical presence or the planned shift | The department QR is a static client-side payload; the start endpoint does not validate it. An authenticated client can call start directly. The employee then chooses any supported shift, which can change calculated lateness. | Decide and document whether QR is a convenient ritual or proof of presence. If it is evidence, add server validation and planned-shift binding before discipline/payroll use. |

## Fix before pilot

| ID | Finding | Practical change |
| --- | --- | --- |
| FP-1 | ADMIN Главная can show `Исправляют сотрудники: 1` and `Активных проблем нет` for the same issue because duplicate suppression happens after the total is calculated. | Build both the count and detail from one deduplicated presentation model. |
| FP-2 | A normal terminal state `Ожидаются данные` can be shown as an amber ADMIN action. | Attention status should require an actual overdue/incomplete/error condition, not every non-confirmed state. |
| FP-3 | Attendance opens all history, loads sources sequentially and mixes old short names with current full names. | Open the current month by default, explain that Google remains the temporary payroll source, normalize identities and parallelize safe reads. |
| FP-4 | Pilot readiness is scattered across several pages. | Before the first shift verify department, credentials, schedule, 1C cashbox/cashier mapping and push subscription for the exact Retail and Wholesale pilot users. |
| FP-5 | One old credit issue remains active after an ADMIN reply, while the employee previously reported that the factual correction was unavailable. | Resolve the live case and design an audited ADMIN exception/escalation outcome that never fabricates financial correction. |
| FP-6 | Employee schedule is self-marked and has no full audit trail; payroll still trusts Google Sheets. | Keep it informational during pilot and state this clearly in onboarding. Do not use it for payroll or discipline yet. |
| FP-7 | The final terminal timer is not persistent. A server outage across all three finalization windows can miss prior-day completion. | Add safe catch-up on service/timer start and monitor last successful finalization. |
| FP-8 | `portal-app` has no container healthcheck, although PostgreSQL does. | Add a non-mutating healthcheck and an operational alert for unhealthy/restart loops. |
| FP-9 | Failure/device behavior is implemented but not proven end-to-end. | Run the approved 1C loss, internet loss, retained upload, manual takeover/no-duplicate, reconnect, notification closure, iPhone and Android drills. |
| FP-10 | Employees and ADMIN do not yet have a one-page incident procedure. | Prepare short instructions for internet, 1C, camera, push and unfinished-day states before credentials are issued. |

## After launch

1. Replace Google attendance/schedule history with trustworthy portal history
   only after real employees have accumulated enough clean shifts.
2. Add direct read-only 1C payroll comparison, then an ADMIN-only shadow period,
   and only afterwards design `Мой заработок` for employees.
3. Redesign attestations around assignments, separate novice/experienced tracks,
   real pass rules and knowledge-gap analytics.
4. Add a compact pilot/readiness status to the Employees page.
5. Add retention and storage monitoring for notifications, history and uploads.
6. Add a persistent login rate limiter, review CSP and remove the long public
   cache policy from the login page.
7. Restore a non-interactive lint gate; current `npm run lint` asks to configure
   ESLint instead of validating the project.
8. Translate remaining technical English in ADMIN service screens and isolate
   implementation diagnostics from the owner-facing workflow.

## Remove or explicitly decline for launch

- Keep the current Analytics screen out of the menu and archive/remove its stale
  snapshot after launch; it duplicates payroll and does not support a current
  decision.
- Do not expose the current Attestations implementation during pilot. It has no
  true assignment model and its employee result text hardcodes an 80% threshold.
- Do not add automatic monetary penalties or new discipline rules to launch.
- Do not promise that the whole PWA works offline. Only the documented cash
  operation/photo retention path has offline protection today.

## Data quality and production state

- No empty checklist runs were found.
- Repeated task titles within a day are planned checks at different times, not
  proven duplicates. Exact duplicate creation remains protected by the current
  creation path/tests.
- ADMIN Telegram delivery showed 32 sent and no pending/failed records at the
  audit snapshot.
- Notifications showed no pending rows at the snapshot, but this does not prove
  device delivery because of LB-2.
- Employee readiness is uneven: some active users have no push subscription,
  schedule or complete 1C cashier mapping. This is acceptable before rollout
  only if the two selected pilot participants pass FP-4.
- Recent application logs contained no unexplained application errors, and all
  observed production systemd timers were running successfully.

## Verification evidence

- Non-payroll/domain test run: 233 tests passed; payroll tests were not treated
  as failures when the combined runner used an incompatible condition.
- Dedicated payroll regression run: 10/10 passed.
- Existing focused Workday, credit, expense and terminal suites are green.
- Production ADMIN and employee authorization probes rejected unauthenticated
  access with 401/403 as expected.
- Session cookie is signed, HTTP-only, Secure in production and user/role state
  is revalidated against the database.

## Recommended execution order

1. Shared 1C date parser and affected-screen/control regression tests.
2. Push delivery state/retry/monitoring.
3. Upload limits and validation.
4. Dependency security upgrade in isolated changes.
5. Backup/restore, app healthcheck and timer catch-up.
6. Production lifecycle cleanup plus ADMIN clarity fixes.
7. Decide QR evidence semantics and select fully configured pilot users.
8. Run failure and device drills; prepare onboarding/incident instructions.
9. Start the two-person, five-shift controlled pilot.

## Assumptions and open decisions

- The initial rollout is a controlled two-person pilot, not a company-wide
  launch.
- Google Sheets remains the payroll attendance source during pilot.
- Portal schedule and lateness are not yet grounds for payroll deductions.
- QR meaning (ritual versus proof of presence) requires an explicit owner
  decision before the portal becomes a discipline source of truth.
- Backup target, retention window and restore owner must be selected during the
  operational hardening task.
