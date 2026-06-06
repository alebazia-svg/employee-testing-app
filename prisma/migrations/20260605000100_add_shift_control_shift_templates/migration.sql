-- Add shift-specific templates for retail shift control
ALTER TABLE "ShiftControlTemplate" ADD COLUMN "shiftCode" TEXT NOT NULL DEFAULT 'default';

DROP INDEX "ShiftControlTemplate_department_isActive_idx";
DROP INDEX "ShiftControlTemplate_department_version_key";

CREATE INDEX "ShiftControlTemplate_department_shiftCode_isActive_idx" ON "ShiftControlTemplate"("department", "shiftCode", "isActive");
CREATE UNIQUE INDEX "ShiftControlTemplate_department_shiftCode_version_key" ON "ShiftControlTemplate"("department", "shiftCode", "version");

UPDATE "ShiftControlTemplate"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "department" = 'retail' AND "shiftCode" = 'default';

INSERT INTO "ShiftControlTemplate" ("name", "department", "shiftCode", "isActive", "version", "updatedAt")
VALUES
  ('Retail shift control 09:00-18:00 v1', 'retail', '09_18', true, 1, CURRENT_TIMESTAMP),
  ('Retail shift control 11:00-20:00 v1', 'retail', '11_20', true, 1, CURRENT_TIMESTAMP);

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT template."id", task."title", task."category", task."sortOrder", task."required", task."plannedTimeMinutes", CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
CROSS JOIN (
  VALUES
    ('Стартовая проверка наличных в кассе', 'opening', 10, true, 540),
    ('X-отчёт / чек открытия смены', 'opening', 20, true, 540),
    ('Проверка кредитов и рассрочек', 'during_shift', 30, true, 690),
    ('Проверка эквайринга', 'during_shift', 40, true, 810),
    ('Проверка наличных в кассе', 'during_shift', 50, true, 930),
    ('Проверка кредитов и рассрочек', 'during_shift', 60, true, 990),
    ('Проверка эквайринга', 'during_shift', 70, true, 1035),
    ('Сдача смены', 'closing', 80, true, 1080)
) AS task("title", "category", "sortOrder", "required", "plannedTimeMinutes")
WHERE template."department" = 'retail' AND template."shiftCode" = '09_18' AND template."version" = 1;

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT template."id", task."title", task."category", task."sortOrder", task."required", task."plannedTimeMinutes", CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
CROSS JOIN (
  VALUES
    ('Стартовая проверка наличных при входе в смену', 'opening', 10, true, 660),
    ('Проверка кредитов и рассрочек', 'during_shift', 20, true, 810),
    ('Проверка эквайринга', 'during_shift', 30, true, 930),
    ('Проверка наличных в кассе', 'during_shift', 40, true, 1050),
    ('Проверка кредитов и рассрочек', 'during_shift', 50, true, 1110),
    ('Проверка эквайринга', 'during_shift', 60, true, 1155),
    ('Сдача смены', 'closing', 70, true, 1200),
    ('Z-отчёт / чек закрытия смены', 'closing', 80, true, 1200)
) AS task("title", "category", "sortOrder", "required", "plannedTimeMinutes")
WHERE template."department" = 'retail' AND template."shiftCode" = '11_20' AND template."version" = 1;
