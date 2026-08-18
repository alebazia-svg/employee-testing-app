-- Employees still open and close the KKM, but 1C cash-shift data verifies the
-- result automatically. Keep completed historical photo tasks and their files,
-- while removing only unfinished tasks from active runs and future templates.
DELETE FROM "ShiftControlTask" task
USING "ShiftControlRun" run
WHERE task."runId" = run."id"
  AND run."department" = 'retail'
  AND run."status" = 'active'
  AND task."status" = 'pending'
  AND task."category" IN ('opening', 'closing');

DELETE FROM "ShiftControlTemplateTask" task
USING "ShiftControlTemplate" template
WHERE task."templateId" = template."id"
  AND template."department" = 'retail'
  AND template."isActive" = true
  AND task."category" IN ('opening', 'closing');

-- Three cash recounts remain: when accepting the cashbox, around the middle of
-- the shift, and inside shift handover. Make the first two purposes explicit.
WITH schedule("department", "shiftCode", "sortOrder", "title", "plannedTimeMinutes") AS (
  VALUES
    ('retail', '09_18', 10, 'Принять кассу: пересчитать наличные', 540),
    ('retail', '09_18', 50, 'Пересчитать наличные в середине смены', 810),
    ('retail', '11_20', 10, 'Принять кассу: пересчитать наличные', 660),
    ('retail', '11_20', 40, 'Пересчитать наличные в середине смены', 930),
    ('retail', '09_20', 10, 'Принять кассу: пересчитать наличные', 540),
    ('retail', '09_20', 50, 'Пересчитать наличные в середине смены', 870),
    ('wholesale', '09_18', 10, 'Принять кассу: пересчитать наличные', 540),
    ('wholesale', '09_18', 20, 'Пересчитать наличные в середине смены', 810),
    ('wholesale', '09_19', 10, 'Принять кассу: пересчитать наличные', 540),
    ('wholesale', '09_19', 20, 'Пересчитать наличные в середине смены', 840),
    ('wholesale', '10_19', 10, 'Принять кассу: пересчитать наличные', 600),
    ('wholesale', '10_19', 20, 'Пересчитать наличные в середине смены', 870)
)
UPDATE "ShiftControlTemplateTask" task
SET
  "title" = schedule."title",
  "plannedTimeMinutes" = schedule."plannedTimeMinutes",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template, schedule
WHERE task."templateId" = template."id"
  AND template."department" = schedule."department"
  AND template."shiftCode" = schedule."shiftCode"
  AND template."isActive" = true
  AND task."sortOrder" = schedule."sortOrder"
  AND task."category" = 'cash';

-- Existing pending reminders move by the same delta as their task. Sent or
-- completed history is immutable.
WITH schedule("department", "shiftCode", "sortOrder", "title", "plannedTimeMinutes") AS (
  VALUES
    ('retail', '09_18', 10, 'Принять кассу: пересчитать наличные', 540),
    ('retail', '09_18', 50, 'Пересчитать наличные в середине смены', 810),
    ('retail', '11_20', 10, 'Принять кассу: пересчитать наличные', 660),
    ('retail', '11_20', 40, 'Пересчитать наличные в середине смены', 930),
    ('retail', '09_20', 10, 'Принять кассу: пересчитать наличные', 540),
    ('retail', '09_20', 50, 'Пересчитать наличные в середине смены', 870),
    ('wholesale', '09_18', 10, 'Принять кассу: пересчитать наличные', 540),
    ('wholesale', '09_18', 20, 'Пересчитать наличные в середине смены', 810),
    ('wholesale', '09_19', 10, 'Принять кассу: пересчитать наличные', 540),
    ('wholesale', '09_19', 20, 'Пересчитать наличные в середине смены', 840),
    ('wholesale', '10_19', 10, 'Принять кассу: пересчитать наличные', 600),
    ('wholesale', '10_19', 20, 'Пересчитать наличные в середине смены', 870)
), changed AS (
  SELECT
    task."id",
    task."sortOrder",
    schedule."title",
    schedule."plannedTimeMinutes",
    schedule."plannedTimeMinutes" - task."plannedTimeMinutes" AS "deltaMinutes"
  FROM "ShiftControlTask" task
  JOIN "ShiftControlRun" run ON run."id" = task."runId"
  JOIN "WorkDayEntry" workday ON workday."id" = run."workDayEntryId"
  JOIN schedule
    ON schedule."department" = run."department"
   AND schedule."shiftCode" = workday."shiftCode"
   AND schedule."sortOrder" = task."sortOrder"
  WHERE run."status" = 'active'
    AND task."status" = 'pending'
    AND task."category" = 'cash'
)
UPDATE "WorkdayNotification" notification
SET
  "scheduledAt" = notification."scheduledAt" + changed."deltaMinutes" * INTERVAL '1 minute',
  "title" = CASE
    WHEN changed."sortOrder" = 10 THEN 'Пора принять кассу'
    ELSE 'Пора пересчитать кассу'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM changed
WHERE notification."taskId" = changed."id"
  AND notification."status" = 'pending';

WITH schedule("department", "shiftCode", "sortOrder", "title", "plannedTimeMinutes") AS (
  VALUES
    ('retail', '09_18', 10, 'Принять кассу: пересчитать наличные', 540),
    ('retail', '09_18', 50, 'Пересчитать наличные в середине смены', 810),
    ('retail', '11_20', 10, 'Принять кассу: пересчитать наличные', 660),
    ('retail', '11_20', 40, 'Пересчитать наличные в середине смены', 930),
    ('retail', '09_20', 10, 'Принять кассу: пересчитать наличные', 540),
    ('retail', '09_20', 50, 'Пересчитать наличные в середине смены', 870),
    ('wholesale', '09_18', 10, 'Принять кассу: пересчитать наличные', 540),
    ('wholesale', '09_18', 20, 'Пересчитать наличные в середине смены', 810),
    ('wholesale', '09_19', 10, 'Принять кассу: пересчитать наличные', 540),
    ('wholesale', '09_19', 20, 'Пересчитать наличные в середине смены', 840),
    ('wholesale', '10_19', 10, 'Принять кассу: пересчитать наличные', 600),
    ('wholesale', '10_19', 20, 'Пересчитать наличные в середине смены', 870)
)
UPDATE "ShiftControlTask" task
SET
  "title" = schedule."title",
  "plannedTimeMinutes" = schedule."plannedTimeMinutes",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlRun" run, "WorkDayEntry" workday, schedule
WHERE task."runId" = run."id"
  AND workday."id" = run."workDayEntryId"
  AND schedule."department" = run."department"
  AND schedule."shiftCode" = workday."shiftCode"
  AND schedule."sortOrder" = task."sortOrder"
  AND run."status" = 'active'
  AND task."status" = 'pending'
  AND task."category" = 'cash';

-- Pending employee notifications must follow the new privacy rule too. Keep
-- delivered history immutable, but prevent an old queued body from exposing
-- the expected balance or discrepancy after this rollout.
UPDATE "WorkdayNotification" notification
SET
  "title" = 'Контроль наличных',
  "body" = CASE
    WHEN notification."kind" = 'issue_reminder'
      THEN 'Вопрос по наличным остаётся открытым. Если нужна помощь, обратитесь к администратору.'
    ELSE 'Результат пересчёта сохранён для контроля. Следующий пересчёт выполните по графику.'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "WorkdayControlIssue" issue
WHERE notification."issueId" = issue."id"
  AND issue."ruleKey" = 'cash_recount_mismatch'
  AND notification."status" = 'pending';
