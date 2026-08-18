DO $$
DECLARE
  active_template RECORD;
  source_template_id INTEGER;
  restored_template_id INTEGER;
BEGIN
  FOR active_template IN
    SELECT DISTINCT ON ("shiftCode") *
    FROM "ShiftControlTemplate"
    WHERE "department" = 'retail' AND "isActive" = true
    ORDER BY "shiftCode", "version" DESC
  LOOP
    SELECT template."id" INTO source_template_id
    FROM "ShiftControlTemplate" template
    WHERE template."department" = active_template."department"
      AND template."shiftCode" = active_template."shiftCode"
      AND EXISTS (
        SELECT 1 FROM "ShiftControlTemplateTask" task
        WHERE task."templateId" = template."id" AND task."category" = 'credit'
      )
    ORDER BY template."version" DESC
    LIMIT 1;

    IF source_template_id IS NULL THEN
      RAISE EXCEPTION 'CREDIT_TEMPLATE_SOURCE_NOT_FOUND:%', active_template."shiftCode";
    END IF;

    UPDATE "ShiftControlTemplate"
    SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = active_template."id";

    INSERT INTO "ShiftControlTemplate" (
      "name", "department", "shiftCode", "isActive", "version", "createdAt", "updatedAt"
    ) VALUES (
      active_template."name", active_template."department", active_template."shiftCode",
      true, active_template."version" + 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING "id" INTO restored_template_id;

    INSERT INTO "ShiftControlTemplateTask" (
      "templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "createdAt", "updatedAt"
    )
    SELECT
      restored_template_id, "title", "category", "sortOrder", "required", "plannedTimeMinutes", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "ShiftControlTemplateTask"
    WHERE "templateId" = source_template_id
    ORDER BY "sortOrder", "id";
  END LOOP;
END $$;

UPDATE "ShiftControlTask" task
SET
  "required" = true,
  "status" = 'pending',
  "completedAt" = NULL,
  "comment" = '',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlRun" run
WHERE run."id" = task."runId"
  AND run."status" = 'active'
  AND task."category" = 'credit'
  AND task."status" = 'done'
  AND task."comment" = 'Заменено автоматическим контролем; действие сотрудника не требуется.';

UPDATE "WorkdayNotification" notification
SET "status" = 'pending', "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlTask" task
JOIN "ShiftControlRun" run ON run."id" = task."runId"
WHERE notification."taskId" = task."id"
  AND notification."status" = 'cancelled'
  AND notification."scheduledAt" > CURRENT_TIMESTAMP
  AND task."category" = 'credit'
  AND task."status" = 'pending'
  AND run."status" = 'active';

UPDATE "WorkdayNotification" notification
SET "status" = 'cancelled', "updatedAt" = CURRENT_TIMESTAMP
FROM "WorkdayControlIssue" issue
WHERE notification."issueId" = issue."id"
  AND notification."status" = 'pending'
  AND issue."ruleKey" = 'credit_realization_mismatch';

UPDATE "WorkdayControlIssue"
SET
  "status" = 'resolved',
  "resolvedAt" = CURRENT_TIMESTAMP,
  "nextReminderAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "ruleKey" = 'credit_realization_mismatch' AND "status" = 'open';
