INSERT INTO "ShiftControlTemplate" ("name", "department", "shiftCode", "isActive", "version", "updatedAt")
SELECT source."name", source."department", source."shiftCode", true, 1, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('Wholesale shift control 09:00-18:00 v1', 'wholesale', '09_18'),
    ('Wholesale shift control 10:00-19:00 v1', 'wholesale', '10_19')
) AS source("name", "department", "shiftCode")
WHERE NOT EXISTS (
  SELECT 1
  FROM "ShiftControlTemplate" existing
  WHERE existing."department" = source."department"
    AND existing."shiftCode" = source."shiftCode"
    AND existing."version" = 1
);

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT template."id", task."title", task."category", task."sortOrder", true, task."plannedTimeMinutes", CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
JOIN (
  VALUES
    ('09_18', 10, 'Проверить наличные в кассе', 'cash', 720),
    ('09_18', 20, 'Проверить наличные в кассе', 'cash', 960),
    ('09_18', 30, 'Сдать смену', 'handover', 1080),
    ('10_19', 10, 'Проверить наличные в кассе', 'cash', 780),
    ('10_19', 20, 'Проверить наличные в кассе', 'cash', 1020),
    ('10_19', 30, 'Сдать смену', 'handover', 1140)
) AS task("shiftCode", "sortOrder", "title", "category", "plannedTimeMinutes")
  ON task."shiftCode" = template."shiftCode"
WHERE template."department" = 'wholesale'
  AND template."version" = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "ShiftControlTemplateTask" existingTask
    WHERE existingTask."templateId" = template."id"
      AND existingTask."sortOrder" = task."sortOrder"
  );
