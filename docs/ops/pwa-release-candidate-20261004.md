# Кандидат нового интерфейса PWA — 2026-10-04

## Production 1.1.4 — 5 октября, 02:19 МСК

По отдельному разрешению владельца выпущен согласованный desktop copper UI,
экран входа и белый знак шапки PWA. Коммит кода
`566887e204e99f2f6fc8e938286a1b314ffc7891`, предыдущий production `281b6c9`
(1.1.3). Бизнес-логика, схема, 1С-клиент и установочная иконка не менялись.

- Локально прошли build, tsc, 9 release/design тестов, 73 payroll теста;
  перед выпуском также 34 профильных procurement/design теста и diff-check.
- Тестовая админка проверена авторизованно: главная, создание/отмена сотрудника,
  закупки, уведомления, ширины 360/390 px, уменьшенная высота 600 px.
  Физическая клавиатура iPhone не проверена; владелец явно не считает это
  препятствием для данного дизайн-выпуска.
- Серверный HEAD независимо подтверждён через SSH, публичные health=ok,
  release-info=1.1.4, builtAt `2026-10-04T23:16:52.861Z`.
  Docker metadata по-прежнему revision=null/source=unknown; commit подтверждён
  отдельно, не выдаётся за встроенный в образ.
- Образ `sha256:dbfd1c3a69acb7461acbfb16c3fe4d6fac47601ddb7ae83eb836e4c8ffa756f6`.
- Откат: `/docker/employee-testing-app/.rollback/desktop-114-20261005/`:
  image-id, commit, rollback.yml и проверенный закрытый database.dump.
  Образ сохранён как `offonika-portal:before-desktop-114-20261005`.
- Неизменность DB container, uploads mount, server.env и test container
  проверена скриптом; новых миграций нет, существующие уже применены.
- В рабочем авторизованном кабинете закупщика проверены новое оформление,
  заполненные данные 1С и видимый footer 1.1.4 / 05.10.2026 02:16 МСК.
  Оплаты/заявки не отправлялись. Production ADMIN/PWA после выпуска под этими
  ролями не проверялись; визуальная приёмка была на тестовой копии.
- Лог `/tmp/mobo-114-release.log`, результат 0. Сторонние dirty-файлы не включены.
  Документация фиксируется отдельным коммитом от кода.

## Test UI 1.1.3-ui.1 — 5 октября, 01:54 МСК

По отдельному разрешению обновлена только тестовая установка. Production не
выпускался. Основа: `46239fe` плюс незакоммиченные согласованные UI-правки
desktop-copper/login/белого знака PWA и прежний acceptance overlay rc.4.
Это архивная сборка: release-info честно сообщает revision=null/source=unknown.

- Исходники сервера: `/docker/mobo-pwa-acceptance/source-ui-20261005`.
- Тестовая версия `1.1.3-ui.1`, builtAt `2026-10-04T22:54:32.085Z`.
- Архив SHA256 `eef89846a4ee395e5aae6357f0f14e79b13ad73013cf9346d5302b3ea20cc779`.
- Образ `mobo-pwa-acceptance:ui-20261005`, ID
  `sha256:2b84ecef59aafb8faf97c2574f78d1bd4dd7cd0c365d063292e9d69fc6ad9e4c`.
- Откат: `mobo-pwa-acceptance:before-ui-20261005` (образ release40 сохранён).
- Серверная сборка и 9 тестов прошли, контейнер healthy, публичный health ok.
- Fingerprints WorkDayEntry/CashOperation/ShiftControlTask, контейнер тестовой
  БД и ID/StartedAt production-контейнера до/после совпали.
- Авторизованная тестовая PWA открылась с прежней сессией; белый знак загрузился;
  видимая версия в «О приложении» совпала с публичными метаданными.
- Логи: `/tmp/mobo-ui-test-deploy.log`, завершение exit 0.
- Production продолжает публиковать 1.1.3. Проверка реальной 1С этим изолированным
  тестовым выпуском не подтверждается; изменения бизнес-логики не входят в задачу.

Перед production нужен новый номер по live/ветке на момент выпуска, отдельное
разрешение и исключение acceptance overlay. Локальные проверочные маршруты
design-quality/local-payment-review в архив не включены. Этот отчёт фиксировать
отдельно от кода.

## Production 1.1.2 — 4 октября, 23:44 МСК

По отдельному «Выпускай» развёрнут `099336aa2bca8ded7a4d4eb026a6df92059af9f5`
(оформление `b15cedd`). Подвалы ADMIN и PROCUREMENT показывают название портала,
версию и дату сборки; убраны copyright-строка и технические детали коммита.
Существующее скрытие подвала на экранах до 768 px сохранено.

- Изменённые файлы: `components/AdminShell.tsx`, `components/ProcurementShell.tsx`,
  `components/ReleaseLabel.tsx`, `tests/release-info.test.mjs`, `package.json`,
  `package-lock.json`. Версионные metadata по-прежнему сохраняют source/revision;
  изменено только их отображение.
- Локально: 7 тестов, tsc, build, diff-check. Реальные экраны обеих ролей
  проверены на изолированной БД при ширине 1440 px; закупщик также проверен
  на узком экране. Рабочие операции не выполнялись.
- Production health=healthy, публичный health=ok, release-info=1.1.2.
- Образ `sha256:fa39e883fc043420f12cd2fa9b478cf6c757185d9fee13d394124ad679017f4a`.
- Откат: `/docker/employee-testing-app/.rollback/pwa-footer-112-20261004/`;
  предыдущий код `9cb720b2533a3cd40fd5a76efe0012008a3edd31`, образ 1.1.1 сохранён.
- БД-контейнер, uploads mount, server.env и тестовая копия не изменены.
- Авторизованный production-просмотр обеих ролей после выпуска не выполнялся;
  визуальная проверка проведена локально. Посторонние dirty-файлы не включены.

## Production 1.1.1 — 4 октября, 23:24 МСК

После визуального утверждения чистого медного знака и отдельного «Выпускай»
развёрнут `9cb720b2533a3cd40fd5a76efe0012008a3edd31`. Изменены только
графика, её адреса для обновления кэша, генератор, тест и версия пакета.
Шапка и иконки используют одинаковые исходные контуры без SVG lighting/blur.
Предыдущий production 1.1.0: `252672664d6a33d5b42cd0079465fc6671d26c76`.

- Версия 1.1.1, health healthy; публичный health ok.
- Образ `sha256:1e2d40fab6d5c7fd2bbb172f2fe670374a8b63d790578f8d965a563d96022e98`.
- Откат: `/docker/employee-testing-app/.rollback/pwa-copper-111-20261004/`
  (предыдущий образ, commit, compose override, проверенный закрытый dump).
- БД-контейнер, uploads mount, server.env и тестовая копия не изменены.
- Локально: build, tsc, 9 профильных тестов, diff-check; форма SVG проверена
  против неизменённого мастер-знака. Публичные SVG/PNG/manifest сверены по SHA256.
- Физический iPhone после выпуска ещё не проверен; обновление уже установленной
  home-screen иконки зависит от iOS, не обещать мгновенную замену.
- Известное ограничение metadata: revision=null/source=unknown в Docker;
  строка ADMIN «Исходный коммит не определён» этим графическим выпуском не исправлена.
- Изменённые файлы: `package.json`, `package-lock.json`, `app/layout.tsx`,
  `app/(dashboard)/employee/EmployeePortalHeader.tsx`, `public/manifest.webmanifest`,
  `public/brand/mobo-master/mobo-symbol-copper-compact.svg`, четыре
  `public/portal-app-copper-*.png`, `scripts/render-copper-app-icons.mjs`,
  `tests/pwa-release-boundary.test.mjs`. Бизнес-правила не менялись.

## Выпущено в production — 4 октября, 22:36 МСК

После отдельного разрешения владельца коммиты опубликованы в
`origin/design-local-updates`. На рабочем сервере развёрнут
`7897abbe7c4e24de89bc4634ca9ad510fe36ed56` (код `27527f0`).
Ниже сохранён журнал предыдущих фаз; их ограничения на выпуск были сняты
только этим новым OPERATIONS APPROVAL.

- Версия `1.1.0-rc.4`; точный принятый код без дополнительной смены версии.
- Образ `sha256:5de5f2d8d94a0555af9a65aab25455e49d2f8874a1bb6ccf1fdf9743b2879245`.
- StartedAt `2026-10-04T19:36:25.284001364Z`; health=healthy, публичный health=ok.
- Старый образ сохранён как `offonika-portal:pwa-before-rc4-20261004`.
- Материалы отката на сервере:
  `/docker/employee-testing-app/.rollback/pwa-rc4-20261004/`:
  `image-id`, `commit`, `rollback.yml`, закрытый правами `database.dump`.
  Dump создан pg_dump -Fc и проверен pg_restore --list. На локальный компьютер
  не скачивался, содержимое не выводилось. Откат не потребовался.
- До запуска проверено отсутствие неприменённых миграций. Schema/migrations
  совпадают с предыдущим выпуском. Штатный startup вызывает migrate deploy,
  но новых миграций этот выпуск не содержит и не применяет.
- Пересобран/перезапущен только portal-app. DB container ID/StartedAt,
  upload mount, хеш server.env и test container ID/StartedAt не изменились.
- Test seed/runner и acceptance helper в production image отсутствуют.
- Серверный build прошёл. Лог `/tmp/pwa-production-release.log`, exit code 0.
- В браузере рабочий домен открыл штатный экран входа. Рабочей авторизованной
  сессии в этой вкладке нет: реальные смены/кассовые действия не выполнялись.
  Полную production-проверку под сотрудником не заявляем; iPhone-приёмка того же
  кода была выполнена владельцем на test до разрешения выпуска.

## Статус и полномочия

APPROVED CHANGE: подготовить отдельный кандидат на актуальной production-базе,
не выпускать его. Фаза — подготовка выпуска после тестовой приёмки.
Кандидат 1.1.0-rc.4, база 561225e4a380e7440ddf11fb35027d1e5d70b7bc.
Read-only SSH подтвердил этот HEAD рабочего checkout; это не независимая
проверка image ID запущенного production-контейнера. На сервере видна только
неотслеживаемая .rollback/. Production и test deployment в этом шаге не менялись.

Рабочая папка:
`/Users/bela/.codex/worktrees/pwa-release-candidate/employee-testing-app`.
Первоначально проверенная тестовая копия была на 1.1.0-rc.3; 4 октября по
отдельному OPERATIONS APPROVAL обновлена до тестового варианта rc.4 (см. ниже).
Соседние dirty-worktrees не изменялись. Итоговый код зафиксирован в отдельной
ветке `codex/pwa-release-rc4`, commit
`27527f0cded3184f62af99e24a60c54197996297` (49 файлов).
Публикация и production-deploy не разрешены. Отчёт коммитится отдельно от кода.

## Финальная приёмка и подготовка коммита

Владелец подтвердил «Да, всё работает» после проверки на iPhone версии rc.4,
открытия/закрытия камеры и автоматического восстановления после потери интернета.
Эти проверки приняты, повторно запрашивать их без изменений соответствующего
поведения не требуется. Это не дополнительное подтверждение нового QR-сканирования.

OPERATIONS APPROVAL: итоговый локальный коммит и подготовка отката; без push,
production-deploy, изменения env, базы или файлов загрузок.
Перед фиксацией SSH подтвердил production HEAD
`561225e4a380e7440ddf11fb35027d1e5d70b7bc`, только untracked `.rollback/`.
Origin/design-local-updates продвинулся до
`24961191ca92c18af451f3c72bd8e9f5a5fb3505`: только документация соседнего выпуска,
никаких изменений приложения. Выполнен fast-forward, обе чужие правки сохранены.
Код кандидата остался тем же, что прошёл тестовую приёмку rc.4.
Версия намеренно остаётся rc.4; номер стабильного релиза не объявляется до выпуска.

Повторно пройдены tsc, 155 workday-тестов и 66 целевых тестов.
Логи: `/tmp/pwa-final-workday.log`, `/tmp/pwa-final-focused.log`,
`/tmp/pwa-final-build.log`. Финальный build и scoped diff — passed перед коммитом.

## Тестовый выпуск rc.4 — 4 октября, 22:07 МСК

Владелец разрешил обновить только `test.team.mobo-opt.ru`. Production не выпускался.
Для теста создан отдельный архив на точной базе кандидата плюс узкий acceptance
overlay: панель/маршрут сценариев, баннер, seed и runner существующей тестовой
установки. В verifier симуляция доступна только при точном test domain, отдельной
test DB и роли EMPLOYEE с login `pwa-test`. Legacy dev/kkm_test обходы не переносились.
В production-bound candidate эти файлы и runtime-ветка не добавлялись.

- Staging: `/tmp/pwa-rc4-test-stage.2UUGY8`.
- Серверные исходники: `/docker/mobo-pwa-acceptance/source-rc4-20261004`.
- Архив SHA256: `2e3920984b49bd9368de521e2ff94340adc98e2d33aa800bd7a8da1c89dfa457`.
- Образ `mobo-pwa-acceptance:release40`:
  `sha256:a089bb307bb1c8c8b3b92169e923082509b4e152ab1d5ea6b3af2daedbd01807`.
- Откат: `mobo-pwa-acceptance:before-release40`, прежний образ
  `sha256:d1f399107a05da5abb6bf856809de539f4f6da40cae39962ca9f10134d2bf393`.
  Старый каталог `source` сохранён; он НЕ является исходниками текущего release40.
- Схема совпала с работающим тестовым образом до запуска. Миграций/сбросов нет.
- npx tsc --noEmit, 155 workday и 6 acceptance тестов — passed.
  Серверный npm run build — passed. Production boundary: 4 passed отдельно.
- Тестовый контейнер healthy; `/api/health` возвращает ok; release-info сообщает
  `1.1.0-rc.4`, builtAt `2026-10-04T19:04:19.939Z`. Архив не содержит Git metadata,
  поэтому revision=null/source=unknown, а не вымышленный clean commit.
- Fingerprints WorkDayEntry, CashOperation и ShiftControlTask до/после одинаковые.
  Test DB container ID неизменен; production container ID и StartedAt неизменны.
  Upload volume и compose/secrets не менялись. Runner стартовал: checked=0/resolved=0.
- В авторизованном браузере проверены вход тестового сотрудника, сохранённый
  чек-лист 2/3, медный знак, поповер версии rc.4, переключение на месячный график
  и обратно, доступ к панели сценариев.
  Ни сброс этапа, ни изменение ответа кассы при этом не выполнялись.
- Лог: `/tmp/pwa-rc4-release40.log`, итоговый exit code 0.

Это подтверждает тестовый деплой, но не проверку настоящих 1С/OFD через учебную
симуляцию. Последующая физическая проверка камеры/offline владельцем принята
в разделе финальной приёмки выше.

## Состав

- Дополнительно подтверждено прямым сообщением владельца в чате
  «Оценить PDF QR-кодов отделов»: использовать утверждённый медный знак.
  SVG скопирован побайтно, SHA256
  aebb312cbb4c759a712fa640a0025ccf0f3093509d4b66bbdfeffcc4f8dae929.
  В header заменён только знак, убрана CSS-подстановка белого SVG. Геометрия,
  размер, имя сотрудника и действие версии сохранены. Manifest, home-screen icons,
  login, ADMIN/procurement оболочки не менялись. Белые надписи не перекрашивались;
  в текущей компактной PWA-шапке рядом со знаком отображается имя сотрудника,
  новая дополнительная надпись MOBO не добавлялась. Мобильный визуальный прогон
  точного кандидата выполнен локально на 390×844; знак отображается корректно.
- Принятый graphite/copper интерфейс, нижняя панель, карточки, календарь,
  чек-лист, модальные окна, сканер, состояния offline и единые иконки.
- Компактная информация о смене, видимое опоздание, сохранение позиции чек-листа.
- Окно версии по логотипу, общий источник версии и даты сборки для PWA/ADMIN.
- Проверка неотрицательной суммы пересчёта и согласованный показ завершения
  без инкассации. Это функциональные поправки, а не просто CSS.
- Просмотр фото инкассации администратором.
- Устранение неактуального pending-запроса после подтверждённого закрытия всех
  связанных ошибок; сохранение истории и защита от перезаписи ADMIN-решения.

## Исключено

Нет acceptance/design-lab API, панели сценариев, seed, тестового runner,
компонента PwaVisualProposal или localhost-preview. Из настоящего сканера убраны
props и действия designLab. Фискальный verifyEmployeeKkmShiftClose не вызывает
симуляцию ни по login, ни по env-флагу. Чистые функции симуляции сохранены только
для существующих unit-тестов и не используются runtime-проверкой источника.

Три CSS-файла сохранили исторические имена proposal/studio/copper: это слои
согласованного оформления, не генераторы учебных данных. Их содержимое перенесено
  без визуального переизобретения, кроме указанной замены знака. EmployeeInterfaceStyle подключён прямо в
авторизованном employee layout без зависимости от тестового домена/логина.

Не изменены schema/migrations, lib/workday.ts, правила выбора смены, уведомления
(включая 10 секунд), lib/one-c.ts, app/globals.css, зарплата и закупки. Их более
новые production-доработки сохранены.

## Выполненные проверки

- Изолированный npm ci, prisma generate (только клиент, не db push/migrate).
- npx tsc --noEmit — passed.
- npm run test:workday — 155 passed.
- Целевые UI/release/lifecycle/boundary тесты — 66 passed, включая точный SHA256 знака.
- npm run build — passed; тестовые маршруты отсутствуют в route table.
- git diff --check — passed.
- Сверка перечисленных неизменяемых областей с HEAD — без отличий.

Логи: /tmp/pwa-release-workday-test.log, /tmp/pwa-release-focused-test.log,
 /tmp/pwa-release-build.log. Всего 221 тест, это не 221 живой пользовательский
сценарий. Живую приёмку rc.3 нельзя выдавать за новый полный проход rc.4.

## Локальная интерактивная проверка rc.4, 4 октября

Запущен точный production build кандидата на `http://127.0.0.1:3164`.
Отдельная синтетическая БД `mobo_pwa_rc4` доступна только через
`127.0.0.1:55443` (контейнер `mobo-pwa-rc4-db-20261004`). Схема создана
через db push только в этой новой локальной БД. Production и hosted test
не изменялись; интеграционные ключи и реальные данные не копировались.

Через настоящий интерфейс проверены:
- вход локального сотрудника и состояние до начала смены;
- медный знак в шапке, поповер версии `1.1.0-rc.4`;
- активная смена с опозданием 7 минут, открытие и закрытие окна причины;
- два пересчёта по 12 500: сохранение, прогресс 0/3 → 1/3 → 2/3;
  после первого сохранения заголовок чек-листа находится на y=248.75,
  то есть остаётся видимым, страница не уходит вниз;
- сдача кассы 12 500 и резерва 3 000 через два шага, завершённая смена
  с фактическим интервалом; сохранение сумм дополнительно проверено в БД;
- календарь месяц/ближайшие дни, открытие выбора дня и отмена без сохранения;
- размеры 390×844 и 320×740: на узком экране scrollWidth = clientWidth = 305.

Активная смена и три задачи подготовлены как синтетический fixture по структуре
миграций (cash/cash/handover), не начаты физическим QR. Это не проверка всех
production-шаблонов. В интеграционных результатах сохранено `unavailable`
(нет настройки 1С/сопоставления кассира), а не `confirmed`. Успешная сдача в
этой ветке не доказывает прохождение отсутствующего OFD Z-отчёта.

Read-only проверка production: минутный `offonika-workday-notifications.timer`
успешен, но запускает `scripts/dispatch-workday-notifications.ts`, где есть
только dispatchDueWorkdayNotifications. KKM recheck найден в HTTP internal route,
но его внешний плановый вызов доступными проверками не подтверждён. Чтение
доступных cron/systemd файлов не обнаружило такого вызова; это не доказательство
отсутствия недоступных root/external расписаний. Расписание не менялось.

## Не закрыто до выпуска

Дополнительная проверка rc.4 в локальной PostgreSQL: вызвана настоящая функция
`syncKkmShiftCloseIssue` с явно синтетическим подтверждённым evidence (скрипт
`/tmp/pwa-rc4-recovery-check.ts`, не входит в продукт). Pending-заявка перешла
в resolved, approved/rejected и комментарии сохранены, повторный вызов
идемпотентен, WorkDay остаётся active с endedAt=null. В реальной ADMIN-странице
после перезагрузки показаны «Решение не требуется», «Устранено» и сохранённая
история; кнопок разрешения/отказа нет. Это проверка обработки evidence и UI,
НЕ проверка получения Z-отчёта из внешнего источника или серверного таймера.

Проверены выход сотрудника, вход ADMIN, выход ADMIN и вход другого локального
сотрудника. В сдаче смены введено 23 456, сохранён первый шаг; после reload
доступно «Продолжить сдачу смены», открывается шаг 2, возврат на шаг 1 показывает
те же 23 456. Несохранённые поля этим наблюдением не покрыты.

### Подтверждение production-расписания через sudo, только чтение

После разрешения владельца выполнена проверка в видимом Terminal; код 0.
Найден второй, отдельный путь: `/etc/cron.d/offonika-workday-notifications`
каждую минуту запускает от root `/usr/local/sbin/offonika-workday-notification-runner`.
Он вызывает `https://portal.alebazia.xyz/api/internal/workday-notifications/run`,
где выполняется KKM recheck. Cron активен, за последний час в его журнале
60 запусков этого runner. Systemd notifications dispatcher отдельно занимается
уведомлениями; отсутствие recheck в нём не означает отсутствия автопроверки.
HTTP runner использует fail-флаг curl, но отдельного результата HTTP-вызовов
в просмотренных данных нет. Счётчики текстовых совпадений общего journal
не используются как доказательство успеха: туда попадают и команды аудита sudo.
Подтверждены расписание и фактические запуски, не результат конкретной 1С/OFD
проверки. Настройки, задачи и контейнеры не изменялись и вручную не запускались.

Рабочий runtime image:
`sha256:98e99d51360a3019d1f05aa2fb1d3bb0f4f0efecf9b0ce0d75c8feb5e65c1217`,
running, started `2026-10-04T08:16:55.257406512Z`.
Checkout HEAD по-прежнему `561225e4a380e7440ddf11fb35027d1e5d70b7bc`.
Отчёты: `/tmp/pwa-rc4-server-readonly.log`,
`/tmp/pwa-rc4-server-followup.log`, `/tmp/pwa-rc4-cron-proof.log`.
В первом скрипте отдельный grep runtime-файла завершился ошибкой quoting;
он повторён без ошибки во втором скрипте, runtime dispatcher подтверждён.
Четыре boundary-теста кандидата повторно прошли.

1. QR → выбор смены физически проверялся владельцем в rc.3. API старта/выбора
   смены не изменены относительно production-базы. Повторный вход и сохранённый
   черновик rc.4 проверены выше. Hosted test обновлён до rc.4; владелец отдельно
   подтвердил версию, камеру и восстановление связи на iPhone.
2. Production-расписание, доступность источников и цепочка обработки кандидата
   проверены отдельно (ниже). Это не единый production E2E запуска нового rc.4
   по таймеру: кандидат не развёрнут на production. Тестовый runner переносить
   не требуется; новый таймер не нужен.
3. Перед выпуском повторно сверить актуальный production HEAD и runtime image,
   создать чистый scoped commit и предъявить точный diff. Если база изменилась —
   сначала объединить изменения и повторить проверки.
4. Кандидат обращался только к локальным HTTP fixtures. Рабочим verifier отдельно
   выполнено чтение реальных 1С/OFD, без изменения данных или исходов смен.

## Проверка источников и HTTP-цепочки, 4 октября

`/tmp/pwa-rc4-http-chain.ts` запускает loopback HTTP-сервер и вызывает настоящие
verifyEmployeeKkmShiftClose / recheckOpenKkmShiftCloseIssues из rc.4 с отдельной
PostgreSQL. Готовый confirmed не подставляется: выполняются GET /kkm-checks,
/cash-shifts и /api/v1/ofd/platforma/z-reports, нормализация и сопоставление.
Всего 12 HTTP-чтений. Нет Z-отчёта → ofd_missing; incomplete и другая смена
оставляют issue=open / request=pending; правильный отчёт даёт resolved для
обоих. Смена остаётся active. Повторная проверка не создаёт дубликатов.
Это контрактная проверка на синтетических ответах, не реальные 1С/OFD.
Тестовый сервер завершён; скрипт не включён в продукт.

Отдельно в работающем portal-app выполнен только читающий verifier для одной
ранее разрешённой ошибки ККМ (не recheck/sync/dispatch). На дату 2026-08-31
получено status=confirmed, hasOneCClosure=true, hasOfdClosure=true. Проверен
один исторический случай; он не доказывает текущую полноту источников для всех
касс. Код завершения 0, лог `/tmp/pwa-live-source-readonly.log`. Пароль введён
владельцем в Terminal. Данные, env, расписание и контейнер не изменялись.

## План возврата при будущем разрешённом выпуске

До обновления зафиксировать image ID запущенного portal-app, сохранить отдельный
rollback tag и убедиться в наличии свежего backup по действующему runbook.
Деплоить только portal-app из проверенного commit; env, DB, uploads и соседние
сервисы не менять. Schema-миграций в кандидате нет. При ошибке вернуть сохранённый
image через compose override --no-build --no-deps; БД/инкассации/фото не откатывать.
После обновления и после возврата проверить health, роль/вход, фото, версию,
основные переходы и совместимость открытого старого PWA-клиента.
Production rollback-репетиция здесь не выполнялась; сведения rc.3 относятся
только к тестовой среде.

Конкретная процедура для будущего разрешённого production-выпуска:

1. Повторно прочитать HEAD, image ID и StartedAt `portal-app`; если код изменился
   относительно проверенной базы — остановить выпуск до сверки. Не использовать
   сохранённый ниже image ID без повторной проверки перед самым выпуском.
2. Последний подтверждённый рабочий образ:
   `sha256:98e99d51360a3019d1f05aa2fb1d3bb0f4f0efecf9b0ce0d75c8feb5e65c1217`.
   Перед rebuild сохранить фактический образ под отдельным rollback tag и
   записать его ID вне Docker build context. Проверить backup, не восстанавливать БД.
3. Выпуск только portal-app, с `PORTAL_ENV_FILE=server.env`, compose
   `docker-compose.portal.yml`, `--no-deps`. Не запускать test seed/runner,
   Prisma migrations или команды сброса. Фото остаются в `portal-uploads`.
4. При неуспехе создать точечный compose override для `portal-app` с
   `image: <сохранённый-image-id>`, запустить с `--no-build --no-deps`.
   Откатывается приложение, не операции сотрудников и не база. Исходный checkout
   вернуть на сохранённый commit только при чистом tracked status; без force/reset.
5. Проверить health, авторизацию, чтение фото, offline/update и основные экраны.
   Старый service worker обновится при получении старого файла; это отдельно
   проверить на клиенте, не обещать мгновенного обновления уже открытых устройств.

Сейчас rollback tag/override на production не создавались и переключение образов
не репетировалось: это план, а не выполненный production-откат.

## Точный локальный список файлов

- `.gitignore`
- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `app/(dashboard)/admin/workday/close-exceptions/[id]/page.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/(dashboard)/employee/EmployeeDetailLoading.tsx`
- `app/(dashboard)/employee/EmployeePortalHeader.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/issues/[id]/page.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `app/(dashboard)/employee/payment-checks/[id]/page.tsx`
- `app/api/admin/workday/close-exceptions/[id]/route.ts`
- `app/api/admin/workday/shift-control-photo/route.ts`
- `app/api/employee/shift-control/tasks/[id]/route.ts`
- `components/AdminShell.tsx`
- `components/EmployeeAttentionSummaryCard.tsx`
- `components/EmployeeCreditIssueActionCard.tsx`
- `components/EmployeePaymentCheckActionCard.tsx`
- `lib/kkm-shift-close-control.ts`
- `lib/workday-close-view.ts`
- `next.config.mjs`
- `package-lock.json`
- `package.json`
- `public/offline.html`
- `public/workday-sw.js`
- `tests/workday-close-view.test.ts`
- `components/EmployeeAboutApp.tsx`
- `components/EmployeeInterfaceStyle.tsx`
- `components/PwaPreviewIcons.tsx`
- `components/ReleaseLabel.tsx`
- `lib/cash-recount-input.ts`
- `lib/checklist-viewport.ts`
- `lib/release-info.ts`
- `lib/workday-kkm-exception-resolution.ts`
- `public/pwa-copper.css`
- `public/pwa-design-studio.css`
- `public/pwa-visual-proposal.css`
- `scripts/write-release-info.mjs`
- `tests/admin-workday-photo.test.cjs`
- `tests/cash-recount-input.test.ts`
- `tests/checklist-viewport.test.ts`
- `tests/employee-about-app.test.ts`
- `tests/offline-presentation.test.mjs`
- `tests/pwa-copper-presentation.test.mjs`
- `tests/pwa-release-boundary.test.mjs`
- `tests/pwa-upload-presentation.test.mjs`
- `tests/release-info.test.mjs`
- `tests/workday-kkm-exception-resolution.test.ts`
- `docs/ops/pwa-release-candidate-20261004.md` — этот отчёт.
- `public/brand/mobo-master/mobo-symbol-copper-ui.svg` — утверждённый знак.

Документация обновлена из-за перехода к отдельной фазе подготовки выпуска.
