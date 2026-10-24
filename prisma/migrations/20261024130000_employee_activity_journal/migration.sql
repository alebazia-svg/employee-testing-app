-- Additive only; previous application remains compatible after rollback.
CREATE TABLE "PortalActivityCoverage" ("id" INTEGER PRIMARY KEY, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "PortalActivityCoverage" ("id") VALUES (1);
CREATE TABLE "PortalActivityEvent" (
 "id" TEXT PRIMARY KEY, "userId" INTEGER NOT NULL, "sessionId" TEXT NOT NULL,
 "eventKey" VARCHAR(100) NOT NULL, "section" VARCHAR(32) NOT NULL, "kind" VARCHAR(32) NOT NULL,
 "notificationId" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PortalActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PortalActivityEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PortalAccessSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PortalActivityEvent_userId_eventKey_key" ON "PortalActivityEvent"("userId", "eventKey");
CREATE INDEX "PortalActivityEvent_userId_createdAt_idx" ON "PortalActivityEvent"("userId", "createdAt");
CREATE INDEX "PortalActivityEvent_createdAt_idx" ON "PortalActivityEvent"("createdAt");
