CREATE TABLE "PortalAccessSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "loggedOutAt" TIMESTAMP(3),
    "pushState" TEXT NOT NULL DEFAULT 'unknown',
    "pushCheckedAt" TIMESTAMP(3),
    "pushSubscriptionId" INTEGER,
    CONSTRAINT "PortalAccessSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalAccessSession_sessionHash_key" ON "PortalAccessSession"("sessionHash");
CREATE INDEX "PortalAccessSession_firstSeenAt_id_idx" ON "PortalAccessSession"("firstSeenAt", "id");
CREATE INDEX "PortalAccessSession_userId_firstSeenAt_idx" ON "PortalAccessSession"("userId", "firstSeenAt");
ALTER TABLE "PortalAccessSession" ADD CONSTRAINT "PortalAccessSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalAccessSession" ADD CONSTRAINT "PortalAccessSession_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "WorkdayPushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
