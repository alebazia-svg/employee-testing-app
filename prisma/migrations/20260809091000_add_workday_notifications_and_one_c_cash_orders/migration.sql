ALTER TABLE "CashOperation"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "oneCDocumentRef" TEXT,
  ADD COLUMN "oneCDocumentNumber" TEXT,
  ADD COLUMN "oneCError" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "oneCCreatedAt" TIMESTAMP(3);

UPDATE "CashOperation"
SET "idempotencyKey" = 'legacy-cash-operation-' || "id"::TEXT
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "CashOperation" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "CashOperation_idempotencyKey_key" ON "CashOperation"("idempotencyKey");
CREATE INDEX "CashOperation_oneCDocumentRef_idx" ON "CashOperation"("oneCDocumentRef");

CREATE TABLE "WorkdayPushSubscription" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "disabledAt" TIMESTAMP(3),
  CONSTRAINT "WorkdayPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkdayControlIssue" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "taskId" INTEGER,
  "fingerprint" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "sourceData" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextReminderAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkdayControlIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkdayNotification" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "taskId" INTEGER,
  "issueId" INTEGER,
  "fingerprint" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkdayNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkdayPushSubscription_endpoint_key" ON "WorkdayPushSubscription"("endpoint");
CREATE INDEX "WorkdayPushSubscription_userId_disabledAt_idx" ON "WorkdayPushSubscription"("userId", "disabledAt");
CREATE UNIQUE INDEX "WorkdayControlIssue_fingerprint_key" ON "WorkdayControlIssue"("fingerprint");
CREATE INDEX "WorkdayControlIssue_userId_status_idx" ON "WorkdayControlIssue"("userId", "status");
CREATE INDEX "WorkdayControlIssue_taskId_status_idx" ON "WorkdayControlIssue"("taskId", "status");
CREATE INDEX "WorkdayControlIssue_status_nextReminderAt_idx" ON "WorkdayControlIssue"("status", "nextReminderAt");
CREATE UNIQUE INDEX "WorkdayNotification_fingerprint_key" ON "WorkdayNotification"("fingerprint");
CREATE INDEX "WorkdayNotification_userId_status_scheduledAt_idx" ON "WorkdayNotification"("userId", "status", "scheduledAt");
CREATE INDEX "WorkdayNotification_taskId_kind_idx" ON "WorkdayNotification"("taskId", "kind");
CREATE INDEX "WorkdayNotification_issueId_kind_idx" ON "WorkdayNotification"("issueId", "kind");

ALTER TABLE "WorkdayPushSubscription" ADD CONSTRAINT "WorkdayPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayControlIssue" ADD CONSTRAINT "WorkdayControlIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayControlIssue" ADD CONSTRAINT "WorkdayControlIssue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ShiftControlTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkdayNotification" ADD CONSTRAINT "WorkdayNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayNotification" ADD CONSTRAINT "WorkdayNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ShiftControlTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayNotification" ADD CONSTRAINT "WorkdayNotification_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "WorkdayControlIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
