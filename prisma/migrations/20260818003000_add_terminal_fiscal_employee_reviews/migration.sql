CREATE TABLE "TerminalFiscalEmployeeReview" (
  "id" TEXT NOT NULL,
  "reviewKey" TEXT NOT NULL,
  "matchingHash" TEXT NOT NULL,
  "mappingId" TEXT,
  "employeeId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "reasonCode" TEXT NOT NULL,
  "bankOperationAt" TIMESTAMP(3) NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "cashierRefHash" TEXT NOT NULL,
  "attributionWindowMinutes" INTEGER NOT NULL DEFAULT 15,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerminalFiscalEmployeeReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TerminalFiscalReviewMessage" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "authorId" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerminalFiscalReviewMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkdayNotification" ADD COLUMN "reviewId" TEXT;

CREATE UNIQUE INDEX "TerminalFiscalEmployeeReview_reviewKey_key" ON "TerminalFiscalEmployeeReview"("reviewKey");
CREATE UNIQUE INDEX "TerminalFiscalEmployeeReview_matchingHash_key" ON "TerminalFiscalEmployeeReview"("matchingHash");
CREATE INDEX "TerminalFiscalEmployeeReview_employeeId_status_bankOperationAt_idx" ON "TerminalFiscalEmployeeReview"("employeeId", "status", "bankOperationAt");
CREATE INDEX "TerminalFiscalEmployeeReview_status_lastCheckedAt_idx" ON "TerminalFiscalEmployeeReview"("status", "lastCheckedAt");
CREATE INDEX "TerminalFiscalEmployeeReview_mappingId_bankOperationAt_idx" ON "TerminalFiscalEmployeeReview"("mappingId", "bankOperationAt");
CREATE INDEX "TerminalFiscalReviewMessage_reviewId_createdAt_idx" ON "TerminalFiscalReviewMessage"("reviewId", "createdAt");
CREATE INDEX "TerminalFiscalReviewMessage_authorId_createdAt_idx" ON "TerminalFiscalReviewMessage"("authorId", "createdAt");
CREATE INDEX "WorkdayNotification_reviewId_kind_idx" ON "WorkdayNotification"("reviewId", "kind");

ALTER TABLE "TerminalFiscalEmployeeReview" ADD CONSTRAINT "TerminalFiscalEmployeeReview_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "TerminalFiscalMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalEmployeeReview" ADD CONSTRAINT "TerminalFiscalEmployeeReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalReviewMessage" ADD CONSTRAINT "TerminalFiscalReviewMessage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "TerminalFiscalEmployeeReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalReviewMessage" ADD CONSTRAINT "TerminalFiscalReviewMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkdayNotification" ADD CONSTRAINT "WorkdayNotification_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "TerminalFiscalEmployeeReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
