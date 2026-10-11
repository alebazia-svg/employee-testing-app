# Заявки и единый верх ADMIN — выпуск 1.2.0, 11 октября 2026

## Текущее состояние

**Выпущено в production:** портал 1.2.0, commit
`bc9e20f278f1d4e00d326da69fb0d71905e93838`, сборка
`2026-10-11T18:39:39.223Z` (21:39 МСК). 1С 0.15.429 установлена.
Native ADMIN/WRITES и создание подотчёта включены. Проверка живого кабинета
и завершённой карточки PASS; production-финансовые записи не выполнялись.
Ниже сохранена история подготовки; актуальные результаты — в конце документа.

## Решение владельца и границы

APPROVED CHANGE: подготовить согласованный экран заявок к выпуску; унифицировать
верхнюю часть основных разделов ADMIN; оформить вкладки заявок как в закупках.
Ширина и колонки других разделов сохраняются. Заявка открывается в одном модальном
окне; постоянная боковая панель и цепочка вложенных окон отвергнуты владельцем.
Это постоянное правило добавлено в AGENTS.md основного проекта и кандидата.

Ветка: `codex/expense-requests-release`.
Исходная база: `5994d2e` из актуального `origin/design-local-updates`.
Кандидат: **1.2.0-rc.2**, пакет и обе корневые версии lockfile синхронизированы.
Номер стабильного выпуска не зарезервирован: перед push/deploy заново сверить live
release-info.json и ветку выпуска. На проверке live и ветка показывали **1.1.16**.
Изменения пока не закоммичены, не отправлены и не развёрнуты на VPS.

## Что подготовлено

- Общий AdminShell pageTitle/pageDescription для основных разделов: главная,
  контроль дня, заявки, закупки, график, сотрудники, зарплата, реквизиты,
  уведомления, результаты/аттестации, аналитика, служебная диагностика.
- Убраны дублирующие корневые хлебные крошки и вторые названия страницы.
  Внутренние карточки сохраняют полезную навигацию назад.
- Общий стиль admin-section-tabs / admin-section-tab; медный активный акцент,
  одинаковая форма, высота и оформление счётчиков у закупок и заявок.
- Рабочий список из БД, отдельная карточка, прямые ссылки на заявки ведут в неё.
  Старую аналитическую карточку можно открыть явно с `?details=1`.
- В работе остаются заявки живого цикла, ожидающие решения или выдачи.
  Старый baseline-импорт остаётся архивом; просмотр не закрывает заявку.
- Завершение выдачи требует полного ответа и непротиворечивых прямых расходников.
  Неполный ответ, частичная выдача, отменённый расходник и дубли не подтверждают закрытие.
- Поиск и отбор проходят по пакетам БД до ограничения вывода; старые оплаченные
  документы не могут заполнить первый пакет и скрыть новые активные заявки.
- Подотчёт объединён с общей очередью с точной дедупликацией по ссылке документа;
  сохранены обновление статуса, история и восстановление после отмены расходника.
- Из предыдущих TEST-наработок перенесены проверка/подтверждение/восстановление
  команд и создание подотчёта. Их ограничители сохранены.

## Что НЕ включено в рабочем контуре

TEST-создание требует одновременно `PORTAL_TEST_ACCOUNTABLE_CREATE=1`,
`PORTAL_ISOLATED_DEMO=1` и подтверждённой живым API базы `trade83_ut11_Test`.
В rc.2 подготовлен отдельный рабочий режим `PORTAL_ACCOUNTABLE_CREATE=1`:
допустим только без TEST/ISOLATED-флагов и после проверки базы Teleinvest_UT11
и опубликованного ею контракта команд. По умолчанию выключен; на VPS не включён.
Редактирование нативной карточки использует `EXPENSE_REQUEST_NATIVE_ADMIN`,
запись — отдельный `EXPENSE_REQUEST_NATIVE_WRITES`; они не включались на VPS.
При выключенной интеграции карточка честно сообщает, что исправление и утверждение
выполняются в 1С. Она не изображает успешное согласование.

**Полный производственный сценарий «исправить → к оплате / создать подотчёт»
не объявлен готовым.** Нужна отдельная проверка и согласованный выпуск 1С-интеграции
по правилам ai-business-os. Смена операции и все варианты справочников не должны
обещаться по учебному макету: доступны только поля подтверждённой схемы 1С.
Доставка реального push на iPhone здесь не проверена. Уведомления/планировщики,
PWA-экраны, миграции, рабочая БД, файлы окружения и расширение 1С не выпускались.

## Проверки

- TypeScript: PASS.
- 106 проверок предметной логики и контрактов: PASS.
- 56 проверок компонентов и общей очереди: PASS.
- 6 проверок синхронизации: PASS (Telegram-флаг только внутри процесса с fake DB;
  отправитель и реальные сообщения не запускались).
- 5 PostgreSQL integration-сценариев: PASS в пустой allowlisted локальной БД.
  Проверены создание/повторы/неопределённый ответ, история, права, связывание,
  отложенная доставка и жизненный цикл. Транспорт 1С подменён тестовым адаптером.
- 5 проверок release-info и согласованности версий: PASS.
- На реальном локальном HTTP: без сессии 401, запись выключена 503,
  создание подотчёта выключено 403, посторонний Origin 403.
- Сборка финального кандидата: PASS (отдельная копия, без вмешательства в dev-сервер).
- Очередь на реальной локальной БД: 500 завершённых + 210 ожидающих выдачи +
  2 новые заявки на решение. Завершённые исключены, новые решения показаны первыми
  перед ограничением 200 строк. Проверочные записи удалены; обычные данные сохранены.
- Переключение «В работе / История», пустая история и возврат в список: PASS.
- Видимая версия локального интерфейса: 1.2.0-rc.1, 11.10.2026 19:29 МСК.
- UI: список/карточка, фокус и Escape, закупки и сотрудники; широкий экран и
  фактическая CSS-ширина 355px без горизонтальной прокрутки. Все финансовые
  данные визуального стенда — из изолированной копии учебной БД.
- Не проверены: боевые команды 1С, реальная выдача денег, push сотрудникам,
  полные бизнес-сценарии прочих разделов (изменялись только их заголовки).

## Стенд и выпуск

Кандидат открыт на `http://[::1]:3156/admin/expense-requests`.
Для первоначальной визуальной проверки использовалась БД `expense_release_20261011`.
Для нативного TEST-сценария ниже стенд переключён на отдельную БД
`expense_native_review_20261011`, локальный PostgreSQL 55448, и TEST 1С.
Рабочая 1С, сообщения и производственные отправители не подключены. Исходный макет 3154
сохраняется отдельно; его sessionStorage и учебные карточки не попали в кандидат.

Production deploy не выполнен и этой подготовкой не авторизован.
Server commit, previous/replacement Docker image IDs не проверялись/не создавались:
это обязательные поля следующего разрешённого выпуска, перед переключением VPS.
Схема Prisma не менялась; миграции для этих изменений не нужны.

## Визуальная проверка

- [Список, компьютер](/Users/bela/.codex/visualizations/2026/10/11/expense-release/list-desktop.png)
- [Одна заявка в модальном окне](/Users/bela/.codex/visualizations/2026/10/11/expense-release/dialog-desktop.png)

## Точные изменённые файлы кандидата

- [AGENTS.md](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/AGENTS.md)
- [app/(dashboard)/admin/1c/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/1c/page.tsx)
- [app/(dashboard)/admin/analytics/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/analytics/page.tsx)
- [app/(dashboard)/admin/attendance/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/attendance/page.tsx)
- [app/(dashboard)/admin/attestations/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/attestations/page.tsx)
- [app/(dashboard)/admin/company-details/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/company-details/page.tsx)
- [app/(dashboard)/admin/employees/access/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/employees/access/page.tsx)
- [app/(dashboard)/admin/employees/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/employees/page.tsx)
- [app/(dashboard)/admin/expense-requests/[id]/native/ExpenseNativeClient.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/expense-requests/[id]/native/ExpenseNativeClient.tsx)
- [app/(dashboard)/admin/expense-requests/[id]/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/expense-requests/[id]/page.tsx)
- [app/(dashboard)/admin/expense-requests/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/expense-requests/page.tsx)
- [app/(dashboard)/admin/inbox/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/inbox/page.tsx)
- [app/(dashboard)/admin/ofd/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/ofd/page.tsx)
- [app/(dashboard)/admin/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/page.tsx)
- [app/(dashboard)/admin/payroll/PayrollClient.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/payroll/PayrollClient.tsx)
- [app/(dashboard)/admin/procurement/AdminProcurementClient.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/procurement/AdminProcurementClient.tsx)
- [app/(dashboard)/admin/procurement/loading.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/procurement/loading.tsx)
- [app/(dashboard)/admin/procurement/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/procurement/page.tsx)
- [app/(dashboard)/admin/procurement/procurement-workspace.css](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/procurement/procurement-workspace.css)
- [app/(dashboard)/admin/results/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/results/page.tsx)
- [app/(dashboard)/admin/workday/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/workday/page.tsx)
- [app/(dashboard)/admin/workday/tbank/page.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/(dashboard)/admin/workday/tbank/page.tsx)
- [app/api/admin/expense-requests/[id]/native/route.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/api/admin/expense-requests/[id]/native/route.ts)
- [app/api/admin/procurement/delivery-create/route.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/api/admin/procurement/delivery-create/route.ts)
- [app/desktop-copper.css](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/app/desktop-copper.css)
- [components/AdminShell.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/AdminShell.tsx)
- [components/ExpenseRequestDialogRow.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ExpenseRequestDialogRow.tsx)
- [components/ExpenseRequestWaitingAge.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ExpenseRequestWaitingAge.tsx)
- [components/ExpenseRequestsList.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ExpenseRequestsList.tsx)
- [components/ProcurementDataRefresh.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDataRefresh.tsx)
- [components/ProcurementDeliveryAdmin.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryAdmin.tsx)
- [components/ProcurementDeliveryAdminSection.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryAdminSection.tsx)
- [components/ProcurementDeliveryCashboxChoice.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryCashboxChoice.tsx)
- [components/ProcurementDeliveryCreate.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryCreate.tsx)
- [components/ProcurementDeliveryDialogActions.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryDialogActions.tsx)
- [components/ProcurementDeliveryFunding.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryFunding.tsx)
- [components/ProcurementDeliveryFundingNotice.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryFundingNotice.tsx)
- [components/ProcurementDeliveryHistory.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryHistory.tsx)
- [components/ProcurementDeliveryLink.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryLink.tsx)
- [components/ProcurementDeliveryNativeStatus.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/components/ProcurementDeliveryNativeStatus.tsx)
- [docs/codex-memory/project-index.md](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/docs/codex-memory/project-index.md)
- [lib/expense-request-admin-client.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-admin-client.ts)
- [lib/expense-request-admin-lifecycle.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-admin-lifecycle.ts)
- [lib/expense-request-breakdown.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-breakdown.ts)
- [lib/expense-request-command.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-command.ts)
- [lib/expense-request-list-view.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-list-view.ts)
- [lib/expense-request-queue.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-queue.ts)
- [lib/expense-request-source.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-source.ts)
- [lib/expense-request-unified-list.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/expense-request-unified-list.ts)
- [lib/procurement-delivery-create-policy.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/procurement-delivery-create-policy.ts)
- [lib/procurement-delivery-create-source.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/procurement-delivery-create-source.ts)
- [lib/procurement-delivery-create.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/procurement-delivery-create.ts)
- [lib/procurement-delivery-native-source.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/procurement-delivery-native-source.ts)
- [lib/procurement-delivery-native.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/procurement-delivery-native.ts)
- [lib/procurement-delivery-reminders.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/lib/procurement-delivery-reminders.ts)
- [package-lock.json](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/package-lock.json)
- [package.json](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/package.json)
- [tests/expense-request-breakdown.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/expense-request-breakdown.test.ts)
- [tests/expense-request-command.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/expense-request-command.test.ts)
- [tests/expense-request-list-view.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/expense-request-list-view.test.ts)
- [tests/expense-request-unified-list.test.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/expense-request-unified-list.test.tsx)
- [tests/procurement-delivery-cashbox-choice.test.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-cashbox-choice.test.tsx)
- [tests/procurement-delivery-create-source.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-create-source.test.ts)
- [tests/procurement-delivery-create.integration.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-create.integration.test.ts)
- [tests/procurement-delivery-create.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-create.test.ts)
- [tests/procurement-delivery-funding-ui.test.tsx](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-funding-ui.test.tsx)
- [tests/procurement-delivery-history.integration.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-history.integration.test.ts)
- [tests/procurement-delivery-native-route.integration.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-native-route.integration.test.ts)
- [tests/procurement-delivery-native-source.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-native-source.test.ts)
- [tests/procurement-delivery-notifications.integration.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery-notifications.integration.test.ts)
- [tests/procurement-delivery.integration.test.ts](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/procurement-delivery.integration.test.ts)


## Нативная проверка 11.10.2026 — существующая заявка → расходник → история

Классификация: APPROVED CHANGE. Владелец «Работай» продолжил предложенный
TEST-сценарий существующей заявки. Production deploy/записи не входят в этот шаг.
Перед подключением прочитан ai-business-os AGENTS/индекс; bootstrap и живой
`/version` подтвердили `environment=test`, базу `trade83_ut11_Test`, пакет
`AIAgentAPI-test-accountable-create-r5-2026-10-09`.

- Настоящая TEST-заявка **00OF-000234**, ref
  `bb32e8a0-0f03-11f1-b9b2-002590803daf`, 6000 RUB, Сейф Расходный.
- В видимой карточке портала заполнено пустое назначение платежа тестовым текстом.
  Проверка preview и независимое чтение подтвердили rollback: до confirm ни
  реквизиты, ни история в 1С не изменились.
- Confirm из портала сохранил назначение и установил именно **К оплате**.
  Независимое чтение: сумма, касса, организация, строки расшифровки сохранены;
  история содержит ровно одно новое действие.
- Через «Создать на основании» в TEST web-клиенте 1С проведён РКО
  **00OF-001549**, ref `bf62822a-c598-11f1-8f13-002590803daf`, 11.10.2026 20:25:33.
  Комментарий явно указывает тест и отсутствие реальной выдачи денег.
- Независимый `/expense-request-admin`: `fully_executed`, исполнено 6000,
  остаток 0; один прямой связанный РКО, `posted=true`, `deletion_mark=false`,
  ветка complete, без конфликтов суммы. Повторное проведение не выполнялось.
- Штатный `fetchExpenseRequestSnapshot` + `syncExpenseRequestAdminAudit`
  синхронизировал эту одну заявку в изолированную локальную БД.
  Проверено в браузере: во «В работе» её нет, в «Истории» —
  **«Выдача подтверждена»**; повторное открытие показывает исполнено 6000 / осталось 0,
  кнопок редактирования и повторного утверждения нет.
- Дополнительно исправлен Escape в FieldEditor: закрывает только редактор поля,
  не всё модальное окно. Убрана ошибочная подсказка оформить расходник в уже
  исполненной карточке; статус согласования теперь отделён текстом от исполнения.

Этот проход проверяет назначение + утверждение существующей заявки. Он не
подтверждает произвольную смену операции, все справочники/поля расшифровки,
частичную выдачу/отмену РКО в живой 1С или доставку push на iPhone.
Предыдущий отдельный TEST подотчёта 00OF-000895 / РКО 00OF-001548 уже зафиксирован
в ai-business-os `03-purchase-analytics/accountable-create-test-2026-10-08.md`;
в текущем проходе он не создавался повторно.

Проверки: TypeScript, 21 предметный тест и сборка PASS. Известный старый
`procurement-current-design-baseline.test.mjs` ожидает текст «Добавить оплаты»;
ошибка воспроизведена и на исходном HEAD, этим этапом не исправлялась.
Изолированная БД содержит одну импортированную TEST-заявку; пользователь ADMIN
и служебный Procurement fixture скопированы только из локального demo. Подписок
сотрудников нет, отправители не запускались. Файлы .env/server.env не менялись.
Флаги native ADMIN/WRITES включены только в процессе локального TEST-сервера;
создание подотчёта выключено. Производственные флаги не менялись.

Доказательства:
- [Проверка перед подтверждением](/Users/bela/.codex/visualizations/2026/10/11/expense-release/native-payable-preview.png)
- [Проведённый TEST РКО](/Users/bela/.codex/visualizations/2026/10/11/expense-release/native-rko-posted.png)
- [Текущая очередь очищена](/Users/bela/.codex/visualizations/2026/10/11/expense-release/native-current-cleared.png)
- [Подтверждённая выдача в истории](/Users/bela/.codex/visualizations/2026/10/11/expense-release/native-history-confirmed.png)

Исходные JSON до/после сохранены локально в `/tmp/expense-native-*.json` с правами
0600, без помещения в Git. Посторонние изменения в обоих репозиториях сохранены.


## Подготовка рабочего расширения и rc.2 — 11.10.2026

APPROVED CHANGE: продолжить подготовку выпуска, поскольку рабочая 1С не имеет
TEST-endpoint. Разрешение на подготовку не включает публикацию/установку 1С,
деплой портала, изменение server.env или рабочие финансовые операции.

Подготовлен кандидат 1С на точной рабочей основе 428. Сохранены 166 прежних
HTTP-операций, добавлены GET/POST expense-request-admin и регистр истории команд.
TEST-расширение целиком не переносилось: в нём отсутствуют более новые рабочие
функции перемещения товаров и пакетного чтения карточек.

[Полный handoff 1С и порядок установки](/Users/bela/Projects/ai-business-os/03-purchase-analytics/expense-production-preparation-2026-10-11.md).

В портале подготовлены:

- Явное раздельное включение TEST/production создания подотчёта. Конфликт флагов
  блокирует создание; прежний TEST-контракт поддерживается.
- Перед POST проверяются live environment/base и поддерживаемый контракт.
  При старом рабочем расширении новая команда не отправляется.
- Раздельные идентификаторы TEST/production, прежняя защита от дублей сохранена.
- Ошибка до отправки confirm не называется неопределённым результатом записи;
  потеря ответа после отправки сохраняет необходимость проверки результата.
- Рабочие служебные события создания не получают adminInboxReceipt и не
  засоряют пользовательский колокольчик. Отправители уведомлений не менялись.
- Ошибки API приведены к нейтральным формулировкам, без обещания TEST в production.

Точные файлы этого шага: `lib/expense-request-admin-client.ts`,
`lib/procurement-delivery-create-policy.ts`, `lib/procurement-delivery-create-source.ts`,
`lib/procurement-delivery-create.ts`, `app/api/admin/procurement/delivery-create/route.ts`,
`tests/expense-request-command.test.ts`, `tests/procurement-delivery-create-source.test.ts`,
[новый transport test](/Users/bela/.codex/worktrees/expense-requests-release/employee-testing-app/tests/expense-request-native-transport.test.ts),
`package.json`, `package-lock.json` и этот документ.

Проверки rc.2: 19 предметных тестов PASS, 5 release-info PASS, TypeScript PASS,
production build PASS в `/tmp/mobo-expense-release-build-20261011`.
Локальный PostgreSQL integration создания: TEST-режим PASS и production-режим
PASS с fake 1С; проверены повторы/конкурентность/изменившийся запрос/потеря ответа.
Пять проверок нового пакета 1С и validator HTTP-операций PASS.
Новый пакет ещё не установлен/скомпилирован в 1С: это обязательный следующий
этап, статические проверки не заменяют нативную проверку. Рабочий GET-only
cash-funding-context проверен; рабочие записи не выполнялись.

Версия rc.2 — локальный кандидат, не опубликованный стабильный номер.
Ранее показанный dev-интерфейс имел rc.1; видимая версия rc.2 после сборки
в браузере не проверялась. Production server commit/image/UI verification
не проводились, так как деплоя не было. Права рабочего 1С-пользователя после
установки и фактическая доставка push остаются непроверенными.

Откат: отключить новые команды портала/вернуть предыдущий его образ.
Нельзя без анализа вернуть старое расширение 428 после появления истории
в новом регистре: откат расширения должен сохранять этот регистр.
Файлы окружения, Prisma-схема, рабочие данные и посторонние изменения сохранены.


## Пакет 1С опубликован по разрешению владельца — 11.10.2026

OPERATIONS APPROVAL: после отдельного разрешения опубликован
`AIAgentAPI-v0.15.429-expense-commands-2026-10-11` в `/AgentAPI_Project`.
Upload без перезаписи и обратный SHA-256 проверены:
`4b9f7469d865a59c562122a011399add20d83d21087d173226373489ec8a11bd`.
Исходники сохранены в ai-business-os `extensions/AIAgentAPI-v0.15.429-expense-commands-2026-10-11`.

[Запись выпуска 1С](/Users/bela/Projects/ai-business-os/99-releases/AIAgentAPI-v0.15.429-expense-commands-2026-10-11.md).

Ожидается ручная установка владельцем и проверка live `/version`/GET endpoint.
Публикация расширения не означает деплой портала или включение рабочих команд.
Версия портала остаётся локальным кандидатом 1.2.0-rc.2; runtime-код в этом шаге
не менялся. Файлы окружения, БД, VPS и финансовые документы не менялись.


## Рабочая 1С установлена и проверена — 11.10.2026

Владелец установил 0.15.429. Независимый `/version` подтвердил точное имя
`AIAgentAPI-v0.15.429-expense-commands-2026-10-11`, production/Teleinvest_UT11;
Яндекс.Диск синхронизирован. GET-only: контракты и команды, creation-reader,
одна реальная карточка, расшифровка, история и выбор статьи расходов PASS.

Препятствие «в рабочей 1С отсутствует endpoint» устранено. Подтверждено чтение;
рабочие preview/confirm, утверждение и создание документов не выполнялись.
Следующий этап — выпуск портала. Его версия, исходники и целевые проверки
сверяются заново перед выпуском; предыдущие разрешения на публикацию расширения
не означают уже выполненный деплой портала. VPS/флаги не менялись.


## Выпуск портала разрешён — 11.10.2026

OPERATIONS APPROVAL: владелец «ghbcnegfq» (приступай) продолжил предложенный
выпуск портала после успешной установки и GET-проверки 1С 0.15.429.
Объём: согласованный UI заявок, общий верх/вкладки ADMIN, команды исправления,
утверждения к оплате и явного создания подотчёта. Финансовые операции агентом
автоматически не выполняются. PWA, схема БД и существующие уведомления не меняются.

Актуальная ветка продвинулась до 49382d1 (закупки 1.1.17). Кандидат перенесён
поверх неё с сохранением нового прогноза. В конфликте package/lock выбрана
единая стабильная версия **1.2.0**; иные конфликты не возникли.
Кодовый коммит: `4facaea` — 71 файл; список всех файлов доступен в diff коммита.

В docker-compose.portal.yml включены owner-approved native ADMIN/WRITES и
PORTAL_ACCOUNTABLE_CREATE (значение из server.env при наличии имеет приоритет;
по текущей проверке эти ключи отсутствуют). TEST/ISOLATED явно выключены.
Файлы .env/server.env не редактировались. Команды по-прежнему проверяют live
базу/контракт и требуют авторизованного ADMIN, same-origin, preview и confirm.

TypeScript, production build, release-info и 73 payroll-проверки PASS.
Предметные тесты заявок/подотчёта и совместимости нового прогноза PASS.
UI-тесты: 56 PASS, синхронизация: 6 PASS с fake DB и флагом Telegram только
в процессе теста, без отправки сообщений. Начальный объединённый запуск
ошибочно применил react-server к React UI-тестам и не включил тестовый флаг
синхронизации; соответствующие группы повторены с правильным окружением PASS.
Старый несвязанный procurement-current-design-baseline тест не изменялся.
В живом локальном приложении проверены итоговый header, история и завершённая
карточка без кнопок повторного утверждения; версия 1.2.0 видна.

Перед рестартом требуется завершение параллельного выпуска 1.1.17, сохранение
предыдущего Docker image, проверка Prisma status и точного server commit.
Сами финансовые команды в production не тестировались записями.


## Выпуск завершён и независимо проверен — 11.10.2026

Владелец разрешил выпуск; VPS-script завершился с exit 0. Перед выпуском
дождались завершения параллельного 1.1.17 и сохранили его изменения.

- Код: `4facaea`; развёрнутый commit:
  `bc9e20f278f1d4e00d326da69fb0d71905e93838`.
- Предыдущий commit: `49382d1be253dadbdaa96a3a4f50ddd4061b28d8` (1.1.17).
- Предыдущий image:
  `sha256:9c8b0767ddd6f5b17fe56811fb821e11956034ec40355a0ce6291b81629210ad`.
- Сохранённый rollback tag: `offonika-portal-expense-rollback:pre-1.2.0-20261011`.
- Replacement image:
  `sha256:db660fd42bb28a2862e9250ba7c0cf2b9dc6e61bf3791952b1eb366ef293b7bb`.
- Target: `/docker/employee-testing-app`, только `portal-app`, без сборки
  и перезапуска остальных сервисов. server.env и production DB вручную не менялись.
- Prisma status перед рестартом: schema up to date, pending migrations нет.
  Схема не менялась; предыдущий image совместим для отката портала.
- Volumes uploads и procurement-planning, read-only bind tbank сохранены.
- Runtime flags: EXPENSE_REQUEST_NATIVE_ADMIN=1,
  EXPENSE_REQUEST_NATIVE_WRITES=1, PORTAL_ACCOUNTABLE_CREATE=1;
  TEST/ISOLATED выключены.
- GET-only проверка нового endpoint выполнена с фактическими учётными данными
  портала с VPS, а не только с локальным интеграционным пользователем.
- Независимый SSH подтвердил exact server commit и отсутствие tracked dirty files.
  Существующий untracked `.rollback/` сохранён.
- Оба публичных release-info.json (portal.alebazia.xyz, team.mobo-opt.ru)
  подтвердили 1.2.0 / 2026-10-11T18:39:39.223Z. Health ok.
  revision=null/source=unknown — существующая особенность Docker build без .git;
  commit подтверждён отдельно на VPS, не из публичного metadata.
- Авторизованный рабочий UI показал версию 1.2.0 / 21:39 МСК, новый header,
  вкладки, поиск, модальную карточку. В «В работе» очередь пуста.
  Подотчёт Астемира 00OF-001085 на 5000 отображается в Истории «Выдано · закрыта».
  Карточка 00OF-001090 получила из 1С полное исполнение 500/0 и не даёт
  повторно утверждать исполненный документ. Закрытие модального окна PASS.
- Реальное сохранение/утверждение/создание production-документа не проверялось:
  текущих ожидающих заявок не было; тестовые финансовые записи не создавались.
  Проверки записи в TEST и fake production transport описаны выше.
  Доставка push на iPhone в этот выпуск не входила и не подтверждалась.

### Отдельная найденная старая ошибка: даты с однозначным часом

GET /expense-requests за 09–12 октября возвращает для 00OF-001090
`11.10.2026 9:25:11`; история портала показывает «10 нояб., 12:25».
Причина: expenseRequestDateOrNull требует двузначный час, затем передаёт строку
в общий new Date. Тот же код есть в предыдущем production commit 49382d1;
это не изменение релиза 1.2.0. Нужны узкое исправление парсера, регрессионные
проверки и штатная повторная синхронизация старых дат. Ручные изменения рабочей
БД не выполнялись. Ошибка зафиксирована отдельно от согласованного выпуска;
она не меняет сумму, финансовый документ или подтверждение исполнения в 1С.

Логи: /tmp/mobo-expense-120-release.log; exitfile содержит 0.
Скриншот рабочего кабинета:
`/Users/bela/.codex/visualizations/2026/09/29/01a0ec9d-4343-73e1-9adf-3052cf5f2919/expense-production-1.2.0-20261011.png`.
Посторонние dirty files основного проекта и ai-business-os не затронуты.

### Точный состав runtime-коммита 4facaea

- `app/(dashboard)/admin/1c/page.tsx`
- `app/(dashboard)/admin/analytics/page.tsx`
- `app/(dashboard)/admin/attendance/page.tsx`
- `app/(dashboard)/admin/attestations/page.tsx`
- `app/(dashboard)/admin/company-details/page.tsx`
- `app/(dashboard)/admin/employees/access/page.tsx`
- `app/(dashboard)/admin/employees/page.tsx`
- `app/(dashboard)/admin/expense-requests/[id]/native/ExpenseNativeClient.tsx`
- `app/(dashboard)/admin/expense-requests/[id]/page.tsx`
- `app/(dashboard)/admin/expense-requests/page.tsx`
- `app/(dashboard)/admin/inbox/page.tsx`
- `app/(dashboard)/admin/ofd/page.tsx`
- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`
- `app/(dashboard)/admin/procurement/loading.tsx`
- `app/(dashboard)/admin/procurement/page.tsx`
- `app/(dashboard)/admin/procurement/procurement-workspace.css`
- `app/(dashboard)/admin/results/page.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/(dashboard)/admin/workday/tbank/page.tsx`
- `app/api/admin/expense-requests/[id]/native/route.ts`
- `app/api/admin/procurement/delivery-create/route.ts`
- `app/desktop-copper.css`
- `components/AdminShell.tsx`
- `components/ExpenseRequestDialogRow.tsx`
- `components/ExpenseRequestWaitingAge.tsx`
- `components/ExpenseRequestsList.tsx`
- `components/ProcurementDataRefresh.tsx`
- `components/ProcurementDeliveryAdmin.tsx`
- `components/ProcurementDeliveryAdminSection.tsx`
- `components/ProcurementDeliveryCashboxChoice.tsx`
- `components/ProcurementDeliveryCreate.tsx`
- `components/ProcurementDeliveryDialogActions.tsx`
- `components/ProcurementDeliveryFunding.tsx`
- `components/ProcurementDeliveryFundingNotice.tsx`
- `components/ProcurementDeliveryHistory.tsx`
- `components/ProcurementDeliveryLink.tsx`
- `components/ProcurementDeliveryNativeStatus.tsx`
- `docker-compose.portal.yml`
- `lib/expense-request-admin-client.ts`
- `lib/expense-request-admin-lifecycle.ts`
- `lib/expense-request-breakdown.ts`
- `lib/expense-request-command.ts`
- `lib/expense-request-list-view.ts`
- `lib/expense-request-queue.ts`
- `lib/expense-request-source.ts`
- `lib/expense-request-unified-list.ts`
- `lib/procurement-delivery-create-policy.ts`
- `lib/procurement-delivery-create-source.ts`
- `lib/procurement-delivery-create.ts`
- `lib/procurement-delivery-native-source.ts`
- `lib/procurement-delivery-native.ts`
- `lib/procurement-delivery-reminders.ts`
- `package-lock.json`
- `package.json`
- `tests/expense-request-breakdown.test.ts`
- `tests/expense-request-command.test.ts`
- `tests/expense-request-list-view.test.ts`
- `tests/expense-request-native-transport.test.ts`
- `tests/expense-request-unified-list.test.tsx`
- `tests/procurement-delivery-cashbox-choice.test.tsx`
- `tests/procurement-delivery-create-source.test.ts`
- `tests/procurement-delivery-create.integration.test.ts`
- `tests/procurement-delivery-create.test.ts`
- `tests/procurement-delivery-funding-ui.test.tsx`
- `tests/procurement-delivery-history.integration.test.ts`
- `tests/procurement-delivery-native-route.integration.test.ts`
- `tests/procurement-delivery-native-source.test.ts`
- `tests/procurement-delivery-notifications.integration.test.ts`
- `tests/procurement-delivery.integration.test.ts`
