INSERT INTO "ShiftControlTemplate" ("name", "department", "shiftCode", "isActive", "version", "updatedAt")
SELECT 'Wholesale shift control 09:00-19:00 v1', 'wholesale', '09_19', true, 1, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "ShiftControlTemplate"
  WHERE "department" = 'wholesale'
    AND "shiftCode" = '09_19'
    AND "version" = 1
);

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT template."id", task."title", task."category", task."sortOrder", true, task."plannedTimeMinutes", CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
JOIN (
  VALUES
    (10, 'Проверить наличные в кассе', 'cash', 720),
    (20, 'Проверить наличные в кассе', 'cash', 960),
    (30, 'Сдать смену', 'handover', 1140)
) AS task("sortOrder", "title", "category", "plannedTimeMinutes") ON true
WHERE template."department" = 'wholesale'
  AND template."shiftCode" = '09_19'
  AND template."version" = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "ShiftControlTemplateTask" existingTask
    WHERE existingTask."templateId" = template."id"
      AND existingTask."sortOrder" = task."sortOrder"
  );
