-- Additive: legacy photo-first operations retain their existing paths and statuses.
ALTER TABLE "CashOperation"
  ADD COLUMN "photoExpectedSha256" TEXT,
  ADD COLUMN "photoExpectedBytes" INTEGER,
  ADD COLUMN "photoReceivedAt" TIMESTAMP(3),
  ADD COLUMN "oneCProcessingStartedAt" TIMESTAMP(3);
