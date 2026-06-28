INSERT INTO "ShiftControlTemplate" ("name", "department", "shiftCode", "isActive", "version", "updatedAt")
SELECT 'Retail shift control 09:00-20:00 v1', 'retail', '09_20', true, 1, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "ShiftControlTemplate"
  WHERE "department" = 'retail'
    AND "shiftCode" = '09_20'
    AND "version" = 1
);

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT template."id", task."title", task."category", task."sortOrder", true, task."plannedTimeMinutes", CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
JOIN (
  VALUES
    (10, 'Проверить наличные при входе в смену', 'cash', 540),
    (20, 'Загрузить X-отчёт / чек открытия смены', 'opening', 540),
    (30, 'Проверить кредиты и рассрочки', 'credit', 690),
    (40, 'Проверить эквайринг', 'acquiring', 810),
    (50, 'Проверить наличные в кассе', 'cash', 930),
    (60, 'Повторно проверить кредиты и рассрочки', 'credit', 1020),
    (70, 'Повторно проверить эквайринг', 'acquiring', 1110),
    (80, 'Финальная проверка наличных', 'cash', 1170),
    (90, 'Сдать смену', 'handover', 1200),
    (100, 'Загрузить Z-отчёт / чек закрытия смены', 'closing', 1200)
) AS task("sortOrder", "title", "category", "plannedTimeMinutes")
  ON true
WHERE template."department" = 'retail'
  AND template."shiftCode" = '09_20'
  AND template."version" = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "ShiftControlTemplateTask" existingTask
    WHERE existingTask."templateId" = template."id"
      AND existingTask."sortOrder" = task."sortOrder"
  );
