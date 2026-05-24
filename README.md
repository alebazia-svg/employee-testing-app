# OFFONIKA — система аттестации сотрудников

Стек: **Next.js + TypeScript + Tailwind CSS + SQLite + Prisma ORM**.

## Возможности

- Роли: администратор и сотрудник.
- Авторизация по логину и паролю.
- Аттестации, разделы, вопросы, попытки и результаты.
- Автоматический расчёт результата: процент, статус, ошибки, дата.
- Админ-разделы для сотрудников, аттестаций, результатов и посещаемости.
- Подготовленная интеграция Google Sheets для модуля “Посещаемость”.

## Локальный запуск

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Создайте `.env` на основе `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Инициализируйте базу:
   ```bash
   npm run db:push
   ```

4. Заполните demo-данными:
   ```bash
   npm run db:seed
   ```

5. Запустите приложение:
   ```bash
   npm run dev
   ```

6. Откройте `http://localhost:3000`.

## Demo-аккаунты

- Администратор: `admin` / `admin123`
- Сотрудник: `seller` / `seller123`

## OFFONIKA branding

Готовый wordmark хранится в `public/offonika-wordmark.png` и используется в login, employee header и admin sidebar.

## Google Sheets для “Посещаемости”

Интеграция уже подготовлена, но реальные ключи не подключены. Пока переменные Google Sheets пустые, страница `/admin/attendance` показывает demo-данные.

Ожидаемый лист в Google Sheets: `Посещаемость`.

Ожидаемые колонки:

| Сотрудник | Дата | Статус | Приход | Уход | Комментарий |
| --- | --- | --- | --- | --- | --- |
| Марина С. | 2026-05-22 | На месте | 09:58 | 18:05 | Комментарий |

### 1. Создать Google Cloud Project

1. Откройте [Google Cloud Console](https://console.cloud.google.com/).
2. Создайте новый проект или выберите существующий.
3. Убедитесь, что выбран именно этот проект в верхней панели.

### 2. Включить Google Sheets API

1. В Google Cloud Console откройте `APIs & Services` → `Library`.
2. Найдите `Google Sheets API`.
3. Нажмите `Enable`.

### 3. Создать Service Account

1. Откройте `IAM & Admin` → `Service Accounts`.
2. Нажмите `Create service account`.
3. Задайте имя, например `offonika-attendance-reader`.
4. Роль на уровне проекта можно не выдавать, если аккаунт будет читать только конкретную таблицу.
5. Создайте аккаунт.

### 4. Создать ключ Service Account

1. Откройте созданный Service Account.
2. Перейдите во вкладку `Keys`.
3. Нажмите `Add key` → `Create new key`.
4. Выберите `JSON`.
5. Скачайте JSON-файл и храните его безопасно.

Из JSON понадобятся:

- `client_email` → `GOOGLE_SHEETS_CLIENT_EMAIL`
- `private_key` → `GOOGLE_SHEETS_PRIVATE_KEY`

В `.env` private key можно вставить одной строкой с `\n`, например:

```env
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 5. Дать Service Account доступ к таблице

1. Откройте нужную Google Sheets таблицу.
2. Нажмите `Share`.
3. Вставьте `client_email` service account.
4. Дайте доступ `Viewer`.
5. Сохраните.

Без этого шага Google Sheets API вернёт ошибку доступа.

### 6. Где взять Spreadsheet ID

Откройте таблицу. В URL будет строка вида:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
```

Скопируйте часть между `/d/` и `/edit`:

```env
GOOGLE_SHEETS_SPREADSHEET_ID="SPREADSHEET_ID"
```

### 7. Заполнить `.env`

Добавьте значения в `.env`:

```env
GOOGLE_SHEETS_CLIENT_EMAIL="offonika-attendance-reader@your-project.iam.gserviceaccount.com"
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID="your_spreadsheet_id"
```

После изменения `.env` перезапустите dev server:

```bash
npm run dev
```

Теперь `/admin/attendance` начнёт читать данные из Google Sheets.

## Безопасность

- Не коммитьте `.env`.
- Не вставляйте service account private key в код.
- Давайте service account доступ только к нужной таблице.
- Для чтения используется scope `https://www.googleapis.com/auth/spreadsheets.readonly`.
