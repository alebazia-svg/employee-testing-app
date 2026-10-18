-- Additive observation only. Old rows stay unknown; no subscription changes.
ALTER TABLE "PortalAccessSession"
  ADD COLUMN "displayMode" TEXT,
  ADD COLUMN "contextCheckedAt" TIMESTAMP(3);
ALTER TABLE "PortalAccessSession" ADD CONSTRAINT "PortalAccessSession_displayMode_check"
  CHECK ("displayMode" IS NULL OR "displayMode" IN ('app', 'browser', 'unknown'));

-- One latest completed provider attempt per subscription, not an unbounded log.
-- Keep the recipient identity so reassigned subscriptions cannot expose the
-- previous account's result. Provider acceptance is NOT device receipt/read.
ALTER TABLE "WorkdayPushSubscription"
  ADD COLUMN "lastPushAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastPushResultAt" TIMESTAMP(3),
  ADD COLUMN "lastPushOutcome" TEXT,
  ADD COLUMN "lastPushErrorCode" TEXT,
  ADD COLUMN "lastPushUserId" INTEGER;
ALTER TABLE "WorkdayPushSubscription" ADD CONSTRAINT "WorkdayPushSubscription_lastPushOutcome_check"
  CHECK ("lastPushOutcome" IS NULL OR "lastPushOutcome" IN ('accepted', 'rejected', 'failed'));
