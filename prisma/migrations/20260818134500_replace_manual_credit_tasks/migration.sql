DO $$
DECLARE
  source_template RECORD;
  new_template_id INTEGER;
BEGIN
  FOR source_template IN
    SELECT DISTINCT ON ("shiftCode") *
    FROM "ShiftControlTemplate"
    WHERE "department" = 'retail' AND "isActive" = true
    ORDER BY "shiftCode", "version" DESC
  LOOP
    UPDATE "ShiftControlTemplate"
    SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = source_template."id";

    INSERT INTO "ShiftControlTemplate" (
      "name", "department", "shiftCode", "isActive", "version", "createdAt", "updatedAt"
    ) VALUES (
      source_template."name", source_template."department", source_template."shiftCode",
      true, source_template."version" + 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING "id" INTO new_template_id;

    INSERT INTO "ShiftControlTemplateTask" (
      "templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "createdAt", "updatedAt"
    )
    SELECT
      new_template_id, "title", "category", "sortOrder", "required", "plannedTimeMinutes", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "ShiftControlTemplateTask"
    WHERE "templateId" = source_template."id" AND "category" <> 'credit'
    ORDER BY "sortOrder", "id";
  END LOOP;
END $$;

UPDATE "WorkdayNotification" notification
SET "status" = 'cancelled', "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlTask" task
JOIN "ShiftControlRun" run ON run."id" = task."runId"
WHERE notification."taskId" = task."id"
  AND notification."status" = 'pending'
  AND task."category" = 'credit'
  AND task."status" = 'pending'
  AND run."status" = 'active';

UPDATE "ShiftControlTask" task
SET
  "required" = false,
  "status" = 'done',
  "completedAt" = CURRENT_TIMESTAMP,
  "comment" = 'Заменено автоматическим контролем; действие сотрудника не требуется.',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlRun" run
WHERE run."id" = task."runId"
  AND run."status" = 'active'
  AND task."category" = 'credit'
  AND task."status" = 'pending';
