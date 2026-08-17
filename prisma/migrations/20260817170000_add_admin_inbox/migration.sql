-- Shared ADMIN inbox. Delivery channels remain secondary and do not own read state.
CREATE TABLE "AdminInboxEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminInboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminInboxReceipt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminInboxReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminInboxEvent_eventKey_key" ON "AdminInboxEvent"("eventKey");
CREATE INDEX "AdminInboxEvent_type_occurredAt_idx" ON "AdminInboxEvent"("type", "occurredAt");
CREATE INDEX "AdminInboxEvent_sourceType_sourceId_occurredAt_idx" ON "AdminInboxEvent"("sourceType", "sourceId", "occurredAt");
CREATE UNIQUE INDEX "AdminInboxReceipt_eventId_userId_key" ON "AdminInboxReceipt"("eventId", "userId");
CREATE INDEX "AdminInboxReceipt_userId_readAt_createdAt_idx" ON "AdminInboxReceipt"("userId", "readAt", "createdAt");

ALTER TABLE "AdminInboxReceipt" ADD CONSTRAINT "AdminInboxReceipt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AdminInboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminInboxReceipt" ADD CONSTRAINT "AdminInboxReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
