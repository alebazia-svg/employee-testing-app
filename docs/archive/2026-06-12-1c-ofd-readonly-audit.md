# 1C / OFD read-only audit

> Исторический отчёт от 12.06.2026. Он отражает состояние тестового AIAgentAPI
> на момент проверки и заменён текущей реализацией портала: `/sales-realizations`,
> кассовыми read-only endpoints и диагностикой SABY/OFD. Не использовать как
> описание актуальных возможностей системы.

Дата проверки: 2026-06-12.

## Scope

Проверка ограничена read-only диагностикой тестовой базы 1С и будущего сопоставления документов 1С с фискальными документами ОФД.

Не менялись production-логика, кассовые процессы, payroll, analytics и checklists.

## Текущий статус конфигурации

В текущем локальном окружении не заданы обязательные переменные:

- `1C_BASE_URL`
- `1C_API_USER`
- `1C_API_PASSWORD`

Переменные `1C_REQUEST_TIMEOUT_MS` и `1C_CACHE_TTL_SECONDS` имеют безопасные значения по умолчанию в коде: `5000` мс и `0` секунд соответственно. В `.env.example` и `server.env.example` они указаны как `5000` и `30`.

Из-за отсутствия URL и реквизитов портал сейчас не может выполнить сетевой запрос к тестовой базе 1С. На этом этапе нельзя достоверно отличить проблему URL, авторизации, публикации HTTP-сервиса, сети, SSL, Basic Auth или расширения AIAgentAPI: запрос до 1С не начинается.

## Уже существующий контур в портале

В проекте уже есть read-only health-контур:

- `lib/one-c.ts`
- `app/api/admin/1c/health/route.ts`
- `app/(dashboard)/admin/1c/page.tsx`

Он проверяет `GET /ping`, `GET /version`, `GET /info` относительно `1C_BASE_URL` с Basic Auth.

Важный нюанс: если в `1C_BASE_URL` указан корень сервера 1С, а HTTP-сервис опубликован как `/hs/agent`, текущий health будет ходить в неверные адреса. В таком случае `1C_BASE_URL` должен быть полным base URL опубликованного сервиса, например:

```text
https://test-1c.example.ru/<base>/hs/agent
```

## Добавленная read-only проверка

Добавлен отдельный диагностический скрипт:

```text
scripts/audit-1c-readonly.mjs
```

Он:

- читает `.env` и process env;
- маскирует пароль в выводе;
- выполняет только `GET`-запросы;
- проверяет health endpoints `ping`, `version`, `info`, `health`, `status`;
- дополнительно пробует возможные read-only документные endpoints;
- проверяет как прямой `1C_BASE_URL`, так и вариант `1C_BASE_URL/hs/agent`;
- для документных endpoints добавляет период последнего месяца и `limit=5`;
- выводит HTTP-статусы, длительность, поля ответа и до 5 успешных примеров.

Запуск:

```powershell
node .\scripts\audit-1c-readonly.mjs
```

Если endpoint-имена в AIAgentAPI отличаются, их можно передать без изменения кода:

```powershell
$env:ONE_C_AUDIT_PATHS="/checks,/retailSales,/organizations"
node .\scripts\audit-1c-readonly.mjs
```

## Результат запуска в текущем окружении

Скрипт остановился на проверке конфигурации:

```json
{
  "baseUrl": "<empty>",
  "user": "<empty>",
  "password": "<empty>",
  "timeoutMs": 5000,
  "cacheTtlSeconds": 0
}
```

Не хватает:

- `1C_BASE_URL`
- `1C_API_USER`
- `1C_API_PASSWORD`

## Какие endpoints пока не удалось подтвердить

Из-за отсутствия реквизитов не удалось подтвердить доступность endpoints по:

- продажам / реализациям;
- чекам ККМ;
- отчётам о розничных продажах;
- кассам ККМ;
- организациям;
- менеджерам / пользователям / ответственным.

Также пока не удалось получить фактические поля документов: дата, время, сумма, номер чека, номер смены, ФД, ФП/ФПД, касса, организация, менеджер.

## Минимальный набор полей 1С для сопоставления с ОФД

Для устойчивого сопоставления 1С с ОФД желательно получать из 1С:

- дата и время документа / чека;
- сумма;
- организация, включая различение `ИП Кештова` и `ИП Амир`;
- касса ККМ;
- менеджер / ответственный;
- номер чека;
- номер смены;
- фискальный накопитель, если есть;
- ФД;
- ФП / ФПД;
- регистрационный номер ККТ, если есть.

Минимально достаточный вариант для первичного fuzzy matching: дата/время, сумма, организация, касса ККМ, номер чека или номер смены. Надёжный deterministic matching требует ФН + ФД + ФП/ФПД или хотя бы ФД + ФП/ФПД + ККТ.

## Какие данные понадобятся от ОФД

К ОФД пока подключаться не нужно. Для будущего сопоставления понадобится источник, который отдаёт:

- список фискальных документов;
- дата и время;
- сумма;
- ККТ / регистрационный номер ККТ;
- ФН;
- ФД;
- ФП / ФПД;
- статус документа;
- ошибки ФЛК / ОФД;
- способ получения данных: API, экспорт, email или webhook-уведомления.

## Предварительный вывод

До тестовой базы 1С в текущем окружении достучаться не получилось, потому что не настроены обязательные переменные подключения.

Доступные endpoints и реальные поля ответов пока не подтверждены. Полей для сопоставления 1С ↔ ОФД пока не хватает не по модели, а по факту доступа: нет выборки документов из 1С.

Самый безопасный следующий шаг: получить тестовые `1C_BASE_URL`, `1C_API_USER`, `1C_API_PASSWORD` для опубликованного HTTP-сервиса AIAgentAPI и запустить `scripts/audit-1c-readonly.mjs`. Если запуск должен идти с сервера, нужна только команда с временными env-переменными, без записи секретов в репозиторий:

```powershell
$env:1C_BASE_URL="https://test-1c.example.ru/base/hs/agent"
$env:1C_API_USER="<test-user>"
$env:1C_API_PASSWORD="<test-password>"
$env:1C_REQUEST_TIMEOUT_MS="10000"
node .\scripts\audit-1c-readonly.mjs
```

## Повторная локальная проверка с тестовыми реквизитами

Дата проверки: 2026-06-12.

Проверка выполнена из локального проекта с временными переменными окружения. Секреты в файлы не записывались.

### Связь и health

Тестовая база 1С доступна по HTTP, Basic Auth принят, SSL не участвует, так как URL использует `http://`.

Доступные health endpoints:

- `/ping` -> HTTP 200, поля: `ok`, `service`, `base`
- `/version` -> HTTP 200, поля: `ok`, `service`, `endpoint`, `api_version`, `extension`, `configuration`, `configuration_version`, `environment`, `mode`, `stable_baseline`, `package_version`, `draft_features`
- `/info` -> HTTP 200, поля: `ok`, `service`, `endpoint`, `user`, `app`, `version`

Ответ `/version` подтвердил:

- `extension`: `AIAgentAPI`
- `configuration`: `Управление торговлей, редакция 11`
- `configuration_version`: `11.4.13.57`
- `environment`: `test`
- `mode`: `read-only`
- `package_version`: `AIAgentAPI-v0.15.16-inventory-balance-ref-smoke-2026-06-04`
- `draft_features`: `purchase-recommendations, sales-customers, sales-customer-products, supplier-order-quality, product-metadata`

Недоступные health aliases:

- `/health` -> HTTP 404
- `/status` -> HTTP 404

### Реально доступные read-only endpoints

Найдены endpoints с HTTP 200:

- `/sales-summary`
- `/sales-customers`
- `/sales-customer-products`
- `/purchase-quality`
- `/purchase-recommendations`
- `/supplier-order-quality`
- `/products`
- `/product-metadata`, если передан `search` или `ref`; без параметра вернул HTTP 400 с понятной ошибкой

Проверенные, но не опубликованные endpoints:

- `/sales`
- `/realizations`
- `/realisations`
- `/retail-sales-reports`
- `/kkm-checks`
- `/cash-receipts`
- `/cash-registers`
- `/organizations`
- `/users`
- `/managers`
- `/documents`
- дополнительные варианты для `retail-*`, `cash-*`, `kkm-*`, `fiscal-*`, `checks`, `receipts`, `shifts`, `employees`, `responsibles` также не дали HTTP 200

### Поля по продажам

`/sales-summary`:

- верхний уровень: `ok`, `service`, `endpoint`, `date_from`, `date_to`, `source`, `totals`, `top_products`, `daily`
- `source`: `Документ.РеализацияТоваровУслуг.Товары`
- `totals`: `documents`, `quantity`, `revenue`
- `daily[]`: `date`, `documents`, `quantity`, `revenue`
- `top_products[]`: `ref`, `code`, `name`, `article`, `quantity`, `revenue`

Пример периода последнего доступного месяца в финальном прогоне: `2026-05-13` - `2026-06-12`; итоги: `documents=200`, `quantity=2659`, `revenue=2401688.45`.

Пример daily-строк:

- `2026-05-13`: `documents=43`, `quantity=553`, `revenue=370354.16`
- `2026-05-14`: `documents=43`, `quantity=658`, `revenue=565789`
- `2026-05-15`: `documents=35`, `quantity=385`, `revenue=383238.24`
- `2026-05-16`: `documents=43`, `quantity=628`, `revenue=786934.05`
- `2026-05-17`: `documents=36`, `quantity=435`, `revenue=295373`

`/sales-customers`:

- верхний уровень: `ok`, `service`, `endpoint`, `date_from`, `date_to`, `source`, `customer_field`, `periods`, `thresholds`, `totals`, `customers`, `top_growers`, `top_decliners`
- `source`: `Документ.РеализацияТоваровУслуг.Товары`
- `customer_field`: `Товары.Ссылка.Партнер`
- `totals`: `customers`, `documents`, `quantity`, `revenue`
- `customers[]`: `ref`, `name`, `documents`, `total_quantity`, `total_revenue`, `period_1_quantity`, `period_1_revenue`, `period_2_quantity`, `period_2_revenue`, `period_3_quantity`, `period_3_revenue`, `revenue_change`, `revenue_change_percent`, `trend`

`/sales-customer-products`:

- верхний уровень: `ok`, `service`, `endpoint`, `date_from`, `date_to`, `customer_search`, `source`, `customer_field`, `limit`, `periods`, `totals`, `items`
- `items[]`: `customer_ref`, `customer_name`, `product_ref`, `product_code`, `product_name`, `product_article`, `product_segment`, `documents`, `quantity`, `revenue`, period fields, `revenue_change`, `revenue_change_percent`, `trend`

### Документы 1С для сопоставления с ОФД

Получить 3-5 кассовых или реализационных документов за последний месяц не удалось: опубликованные sales endpoints возвращают агрегаты, а не список документов.

`/supplier-order-quality` возвращает 3-5 документов заказов поставщику, но это не кассовые документы и не подходит для сопоставления с ОФД. Поля такого документа: `ref`, `date`, `number`, `comment`, `amount`, `supplier_partner`, `supplier_counterparty`, `manager`, `current_state`, `payment_amount`, `receipt_amount`, `lines`, `summary`.

Для ОФД-сверки в текущем AIAgentAPI не хватает endpoint, который отдаёт хотя бы один из типов:

- список чеков ККМ;
- список отчётов о розничных продажах;
- список реализаций с документными реквизитами;
- справочник касс ККМ;
- справочник организаций;
- менеджеры / ответственные;
- фискальные реквизиты: ФН, ФД, ФП / ФПД, номер смены, номер чека, ККТ.

### Диагноз

Это не проблема URL, сети, SSL или Basic Auth:

- URL опубликован и отвечает;
- сеть с локальной машины до тестовой 1С есть;
- Basic Auth принят;
- SSL не применим, так как используется HTTP;
- расширение AIAgentAPI установлено и работает в read-only режиме.

Ограничение сейчас на стороне опубликованного API/расширения: в тестовой базе доступны health и аналитические endpoints, но не опубликованы endpoints, достаточные для выгрузки кассовых/фискальных документов.

Самый безопасный следующий шаг: попросить 1С-сторону добавить или описать read-only endpoint для последних чеков/розничных документов с фильтрами `date_from`, `date_to`, `limit` и полями для ОФД-сопоставления. До этого портал можно подключать только к health/summary-диагностике, не к сверке ОФД.

## Уточнение: реализации на контрагента кредит / рассрочка

Дата проверки: 2026-06-12.

Фокус проверки: не чеки ККМ, а документы 1С `Реализация товаров и услуг`, которые менеджеры создают на контрагента / партнёра кредитов и рассрочек.

### Что удалось установить текущими endpoints

Через `/sales-customers` найден клиент:

- `ref`: `537e501e-4640-11ed-8f49-0025901e48ee`
- `name`: `Кредит/рассрочка`
- `source`: `Документ.РеализацияТоваровУслуг.Товары`
- `customer_field`: `Товары.Ссылка.Партнер`

Важно: текущий endpoint называет это `customer` и указывает поле источника как `Партнер`, а не явно `Контрагент`. Для сверки с ручной работой менеджеров нужно, чтобы новый endpoint вернул оба поля, если в документе есть и `Партнер`, и `Контрагент`.

За последний доступный месяц `2026-05-13` - `2026-06-12`:

- `/sales-customers?date_from=2026-05-13&date_to=2026-06-12&limit=500`
- найден `Кредит/рассрочка`
- `documents`: `8`
- `total_quantity`: `24`
- `total_revenue`: `885622`

Через `/sales-customer-products?date_from=2026-05-13&date_to=2026-06-12&customer_search=кредит&limit=50` удалось получить агрегированные строки товаров по этому клиенту:

- `rows`: `22`
- `quantity`: `24`
- `revenue`: `885622`
- поля строки: `customer_ref`, `customer_name`, `product_ref`, `product_code`, `product_name`, `product_article`, `product_segment`, `documents`, `quantity`, `revenue`, period fields, `trend`

Примеры агрегированных товарных строк:

- `Смартфон Apple iPhone 17 Pro Max eSIM (без Rustore)`: `documents=2`, `quantity=2`, `revenue=276321`
- `Смартфон Apple iPhone 17 Pro SIM + eSIM (без Rustore)`: `documents=1`, `quantity=1`, `revenue=141939`
- `Смартфон Apple iPhone 17 Pro eSIM (без Rustore)`: `documents=1`, `quantity=1`, `revenue=119090`

### Чего не хватает в текущих endpoints

Текущие sales endpoints подтверждают, что реализации на `Кредит/рассрочка` есть, но возвращают только агрегаты. Они не возвращают список документов `Реализация товаров и услуг`.

Сейчас нельзя получить:

- номер документа реализации;
- дату и время документа;
- признак проведения;
- организацию;
- контрагента как отдельное поле;
- склад;
- ответственного / менеджера;
- менеджера из вкладки `Дополнительно`, если это отдельный реквизит;
- комментарий документа;
- строки товаров в привязке к конкретному документу;
- сумму конкретного документа.

Вывод: текущих endpoints недостаточно, чтобы сопоставлять реализации с ошибками СБИС ОФД. Можно увидеть, что за период было 8 документов и сумма 885622, но нельзя сопоставить конкретную ошибку СБИС с конкретной реализацией.

### ТЗ для AIAgentAPI / Кодекса Аслана

Добавить read-only endpoint:

```text
GET /hs/agent/sales-realizations
```

Назначение: вернуть список документов `Документ.РеализацияТоваровУслуг` с фильтрами по периоду и клиенту / контрагенту для последующего сопоставления с ошибками СБИС ОФД.

Endpoint должен быть строго read-only: только чтение документов и табличной части, без записи, перепроведения, изменения пометок удаления или изменения статусов.

Параметры запроса:

- `date_from` — дата начала периода, формат `YYYY-MM-DD`, обязательно.
- `date_to` — дата конца периода, формат `YYYY-MM-DD`, обязательно.
- `customer_search` — строка поиска по партнёру / контрагенту, например `кредит` или `рассрочка`, необязательно.
- `customer_ref` — ссылка / GUID партнёра или контрагента, необязательно. Для текущего найденного клиента: `537e501e-4640-11ed-8f49-0025901e48ee`.
- `posted` — фильтр проведения: `true`, `false`, `all`; по умолчанию `all`.
- `limit` — максимум документов, по умолчанию `50`, максимум `500`.
- `offset` или `page` — пагинация, желательно.
- `include_lines` — `true/false`, по умолчанию `true` для диагностического режима.

Минимальная структура ответа:

```json
{
  "ok": true,
  "service": "AIAgentAPI",
  "endpoint": "sales-realizations",
  "date_from": "2026-05-13",
  "date_to": "2026-06-12",
  "filters": {
    "customer_search": "кредит",
    "customer_ref": "537e501e-4640-11ed-8f49-0025901e48ee",
    "posted": "all",
    "limit": 50,
    "offset": 0
  },
  "totals": {
    "documents": 8,
    "amount": 885622
  },
  "documents": [
    {
      "ref": "uuid-or-1c-ref",
      "number": "00OF-000000",
      "date": "2026-05-13T12:34:56",
      "posted": true,
      "deletion_mark": false,
      "organization_ref": "uuid",
      "organization_name": "ИП ...",
      "partner_ref": "537e501e-4640-11ed-8f49-0025901e48ee",
      "partner_name": "Кредит/рассрочка",
      "counterparty_ref": "uuid",
      "counterparty_name": "Кредит/рассрочка",
      "amount": 123456.78,
      "currency": "RUB",
      "warehouse_ref": "uuid",
      "warehouse_name": "Основной склад",
      "responsible_ref": "uuid",
      "responsible_name": "ФИО ответственного",
      "manager_ref": "uuid",
      "manager_name": "ФИО менеджера",
      "additional_manager_ref": "uuid",
      "additional_manager_name": "ФИО менеджера из вкладки Дополнительно",
      "comment": "текст комментария",
      "lines": [
        {
          "line_number": 1,
          "product_ref": "uuid",
          "product_code": "OF-00000000",
          "product_name": "Товар",
          "product_article": "",
          "quantity": 1,
          "price": 123456.78,
          "amount": 123456.78,
          "vat_rate": "Без НДС",
          "vat_amount": 0
        }
      ]
    }
  ]
}
```

Желательные дополнительные поля, если доступны в типовой УТ 11 или расширении:

- `operation_type` / `business_operation`;
- `document_status`;
- `payment_form` или признак кредит / рассрочка, если он хранится отдельно от партнёра;
- `agreement_ref`, `agreement_name`;
- `contract_ref`, `contract_name`;
- `department_ref`, `department_name`;
- `created_by`, `modified_by`;
- `created_at`, `updated_at`;
- `basis_document_ref`, `basis_document_type`, если реализация создана на основании заказа.

Для будущего сопоставления с ошибками СБИС ОФД минимум нужны поля:

- `number`;
- `date`;
- `posted`;
- `organization_name`;
- `partner_name` / `counterparty_name`;
- `amount`;
- `warehouse_name`;
- `responsible_name`;
- `manager_name` и/или `additional_manager_name`;
- `comment`;
- `lines[].product_name`, `lines[].quantity`, `lines[].amount`.

Этого будет достаточно, чтобы искать кандидатов по дате, сумме, организации, менеджеру, контрагенту `Кредит/рассрочка` и составу товаров. Для автоматического точного сопоставления с конкретным фискальным документом дополнительно пригодятся фискальные реквизиты, если они где-то связаны с реализацией, но для разбора ошибок СБИС по кредитным реализациям первичный endpoint выше уже закрывает главный разрыв.
