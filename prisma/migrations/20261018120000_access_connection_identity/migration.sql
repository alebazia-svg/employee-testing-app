-- Display classification only; no authorization or push subscription changes.
ALTER TABLE "PortalAccessSession"
  ADD COLUMN "browserInstanceId" TEXT,
  ADD COLUMN "isService" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "serviceMarkedAt" TIMESTAMP(3),
  ADD COLUMN "serviceMarkedBy" INTEGER;
CREATE INDEX "PortalAccessSession_userId_browserInstanceId_idx"
  ON "PortalAccessSession"("userId", "browserInstanceId");
