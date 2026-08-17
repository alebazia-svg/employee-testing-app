-- Terminal payments are reconciled automatically through T-Bank -> 1C -> OFD.
-- Keep completed history, but remove unfinished duplicate employee checks and
-- stop creating them in future retail shifts.
DELETE FROM "ShiftControlTask" task
USING "ShiftControlRun" run
WHERE task."runId" = run."id"
  AND run."department" = 'retail'
  AND run."status" = 'active'
  AND task."category" = 'acquiring'
  AND task."status" = 'pending';

DELETE FROM "ShiftControlTemplateTask" task
USING "ShiftControlTemplate" template
WHERE task."templateId" = template."id"
  AND template."department" = 'retail'
  AND template."isActive" = true
  AND task."category" = 'acquiring';
