CREATE TABLE "AdminInboxDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "externalMessageId" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminInboxDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminInboxDelivery_eventId_channel_recipientKey_key"
ON "AdminInboxDelivery"("eventId", "channel", "recipientKey");

CREATE INDEX "AdminInboxDelivery_channel_status_createdAt_idx"
ON "AdminInboxDelivery"("channel", "status", "createdAt");

ALTER TABLE "AdminInboxDelivery"
ADD CONSTRAINT "AdminInboxDelivery_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "AdminInboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
