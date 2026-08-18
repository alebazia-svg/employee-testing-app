ALTER TABLE "CreditRealizationControlCase"
  ADD COLUMN "mismatchFirstDetectedAt" TIMESTAMP(3),
  ADD COLUMN "completeMismatchReads" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "CreditRealizationControlCase_status_completeMismatchReads_realizationAt_idx"
  ON "CreditRealizationControlCase"("status", "completeMismatchReads", "realizationAt");

UPDATE "WorkdayNotification" notification
SET "status" = 'cancelled', "updatedAt" = CURRENT_TIMESTAMP
FROM "WorkdayControlIssue" issue
WHERE notification."issueId" = issue."id"
  AND notification."status" = 'pending'
  AND issue."ruleKey" = 'credit_realization_mismatch';

UPDATE "WorkdayControlIssue"
SET "status" = 'resolved', "resolvedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
WHERE "ruleKey" = 'credit_realization_mismatch' AND "status" = 'open';
