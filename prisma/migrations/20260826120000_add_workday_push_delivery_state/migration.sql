ALTER TABLE "WorkdayNotification"
ADD COLUMN "pushStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "pushDeliveredAt" TIMESTAMP(3),
ADD COLUMN "nextPushAttemptAt" TIMESTAMP(3);

UPDATE "WorkdayNotification"
SET "pushStatus" = CASE
  WHEN "status" = 'sent' THEN 'legacy_unknown'
  WHEN "status" = 'cancelled' THEN 'cancelled'
  ELSE 'pending'
END;

CREATE INDEX "WorkdayNotification_status_pushStatus_nextPushAttemptAt_idx"
ON "WorkdayNotification"("status", "pushStatus", "nextPushAttemptAt");
