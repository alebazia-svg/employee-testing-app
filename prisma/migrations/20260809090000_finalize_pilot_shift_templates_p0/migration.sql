-- Pilot P0: the 09:00-20:00 retail handover already contains the final cash
-- recount. Remove the duplicate 19:30 recount from the active template and
-- from unfinished runs. Completed historical tasks stay unchanged.
DELETE FROM "ShiftControlTask" task
USING "ShiftControlRun" run, "WorkDayEntry" workday
WHERE task."runId" = run."id"
  AND workday."id" = run."workDayEntryId"
  AND run."department" = 'retail'
  AND run."status" = 'active'
  AND workday."shiftCode" = '09_20'
  AND task."category" = 'cash'
  AND task."plannedTimeMinutes" = 1170
  AND task."status" = 'pending';

DELETE FROM "ShiftControlTemplateTask" task
USING "ShiftControlTemplate" template
WHERE task."templateId" = template."id"
  AND template."department" = 'retail'
  AND template."shiftCode" = '09_20'
  AND template."isActive" = true
  AND task."category" = 'cash'
  AND task."plannedTimeMinutes" = 1170;

-- Keep employee-facing titles bank-neutral in every active retail template.
UPDATE "ShiftControlTemplateTask" task
SET
  "title" = 'Проверка операций терминала',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlTemplate" template
WHERE task."templateId" = template."id"
  AND template."department" = 'retail'
  AND template."isActive" = true
  AND task."category" = 'acquiring';

UPDATE "ShiftControlTask" task
SET
  "title" = 'Проверка операций терминала',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ShiftControlRun" run
WHERE task."runId" = run."id"
  AND run."department" = 'retail'
  AND run."status" = 'active'
  AND task."category" = 'acquiring';
