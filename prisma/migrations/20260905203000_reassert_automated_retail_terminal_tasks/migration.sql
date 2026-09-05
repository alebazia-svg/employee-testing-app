-- Retail terminal operations are reconciled automatically through
-- T-Bank -> 1C -> OFD. Re-assert the accepted template state after QA data
-- restores, while preserving every completed historical employee answer.
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
