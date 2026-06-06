-- Remove the temporary default retail template and keep only real shift-specific templates.
DELETE FROM "ShiftControlTemplate"
WHERE "department" = 'retail' AND "shiftCode" = 'default';

-- 09:00-18:00 template
UPDATE "ShiftControlTemplateTask" task
SET
  "title" = source."title",
  "category" = source."category",
  "plannedTimeMinutes" = source."plannedTimeMinutes",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
JOIN LATERAL (
  VALUES
    (10, 'Проверить наличные в кассе', 'cash', 540),
    (20, 'Загрузить X-отчёт / чек открытия смены', 'opening', 540),
    (30, 'Проверить кредиты и рассрочки', 'credit', 690),
    (40, 'Проверить эквайринг', 'acquiring', 810),
    (50, 'Проверить наличные в кассе', 'cash', 930),
    (60, 'Проверить кредиты и рассрочки', 'credit', 990),
    (70, 'Проверить эквайринг', 'acquiring', 1035),
    (80, 'Сдать смену', 'handover', 1080)
) AS source("sortOrder", "title", "category", "plannedTimeMinutes") ON true
WHERE task."templateId" = template."id"
  AND source."sortOrder" = task."sortOrder"
  AND template."department" = 'retail'
  AND template."shiftCode" = '09_18'
  AND template."isActive" = true;

-- 11:00-20:00 template
UPDATE "ShiftControlTemplateTask" task
SET
  "title" = source."title",
  "category" = source."category",
  "plannedTimeMinutes" = source."plannedTimeMinutes",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
JOIN LATERAL (
  VALUES
    (10, 'Проверить наличные при входе в смену', 'cash', 660),
    (20, 'Проверить кредиты и рассрочки', 'credit', 810),
    (30, 'Проверить эквайринг', 'acquiring', 930),
    (40, 'Проверить наличные в кассе', 'cash', 1050),
    (50, 'Проверить кредиты и рассрочки', 'credit', 1110),
    (60, 'Проверить эквайринг', 'acquiring', 1155),
    (70, 'Сдать смену', 'handover', 1200),
    (80, 'Загрузить Z-отчёт / чек закрытия смены', 'closing', 1200)
) AS source("sortOrder", "title", "category", "plannedTimeMinutes") ON true
WHERE task."templateId" = template."id"
  AND source."sortOrder" = task."sortOrder"
  AND template."department" = 'retail'
  AND template."shiftCode" = '11_20'
  AND template."isActive" = true;

-- Normalize already-created shift control tasks for active retail runs.
UPDATE "ShiftControlTask" task
SET
  "title" = source."title",
  "category" = source."category",
  "plannedTimeMinutes" = source."plannedTimeMinutes",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlRun" run
JOIN "WorkDayEntry" workday ON workday."id" = run."workDayEntryId"
JOIN LATERAL (
  VALUES
    ('09_18', 10, 'Проверить наличные в кассе', 'cash', 540),
    ('09_18', 20, 'Загрузить X-отчёт / чек открытия смены', 'opening', 540),
    ('09_18', 30, 'Проверить кредиты и рассрочки', 'credit', 690),
    ('09_18', 40, 'Проверить эквайринг', 'acquiring', 810),
    ('09_18', 50, 'Проверить наличные в кассе', 'cash', 930),
    ('09_18', 60, 'Проверить кредиты и рассрочки', 'credit', 990),
    ('09_18', 70, 'Проверить эквайринг', 'acquiring', 1035),
    ('09_18', 80, 'Сдать смену', 'handover', 1080),
    ('11_20', 10, 'Проверить наличные при входе в смену', 'cash', 660),
    ('11_20', 20, 'Проверить кредиты и рассрочки', 'credit', 810),
    ('11_20', 30, 'Проверить эквайринг', 'acquiring', 930),
    ('11_20', 40, 'Проверить наличные в кассе', 'cash', 1050),
    ('11_20', 50, 'Проверить кредиты и рассрочки', 'credit', 1110),
    ('11_20', 60, 'Проверить эквайринг', 'acquiring', 1155),
    ('11_20', 70, 'Сдать смену', 'handover', 1200),
    ('11_20', 80, 'Загрузить Z-отчёт / чек закрытия смены', 'closing', 1200)
) AS source("shiftCode", "sortOrder", "title", "category", "plannedTimeMinutes") ON source."shiftCode" = workday."shiftCode"
WHERE task."runId" = run."id"
  AND source."sortOrder" = task."sortOrder"
  AND run."department" = 'retail'
  AND run."status" = 'active';

INSERT INTO "ShiftControlTask" ("runId", "templateTaskId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "status", "updatedAt")
SELECT
  run."id",
  templateTask."id",
  source."title",
  source."category",
  source."sortOrder",
  true,
  source."plannedTimeMinutes",
  'pending',
  CURRENT_TIMESTAMP
FROM "ShiftControlRun" run
JOIN "WorkDayEntry" workday ON workday."id" = run."workDayEntryId"
JOIN "ShiftControlTemplate" template
  ON template."department" = 'retail'
  AND template."shiftCode" = workday."shiftCode"
  AND template."isActive" = true
JOIN (
  VALUES
    ('09_18', 10, 'Проверить наличные в кассе', 'cash', 540),
    ('09_18', 20, 'Загрузить X-отчёт / чек открытия смены', 'opening', 540),
    ('09_18', 30, 'Проверить кредиты и рассрочки', 'credit', 690),
    ('09_18', 40, 'Проверить эквайринг', 'acquiring', 810),
    ('09_18', 50, 'Проверить наличные в кассе', 'cash', 930),
    ('09_18', 60, 'Проверить кредиты и рассрочки', 'credit', 990),
    ('09_18', 70, 'Проверить эквайринг', 'acquiring', 1035),
    ('09_18', 80, 'Сдать смену', 'handover', 1080),
    ('11_20', 10, 'Проверить наличные при входе в смену', 'cash', 660),
    ('11_20', 20, 'Проверить кредиты и рассрочки', 'credit', 810),
    ('11_20', 30, 'Проверить эквайринг', 'acquiring', 930),
    ('11_20', 40, 'Проверить наличные в кассе', 'cash', 1050),
    ('11_20', 50, 'Проверить кредиты и рассрочки', 'credit', 1110),
    ('11_20', 60, 'Проверить эквайринг', 'acquiring', 1155),
    ('11_20', 70, 'Сдать смену', 'handover', 1200),
    ('11_20', 80, 'Загрузить Z-отчёт / чек закрытия смены', 'closing', 1200)
) AS source("shiftCode", "sortOrder", "title", "category", "plannedTimeMinutes")
ON source."shiftCode" = workday."shiftCode"
JOIN "ShiftControlTemplateTask" templateTask
  ON templateTask."templateId" = template."id"
  AND templateTask."sortOrder" = source."sortOrder"
WHERE run."department" = 'retail'
  AND run."status" = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM "ShiftControlTask" existingTask
    WHERE existingTask."runId" = run."id"
      AND existingTask."sortOrder" = source."sortOrder"
  );
