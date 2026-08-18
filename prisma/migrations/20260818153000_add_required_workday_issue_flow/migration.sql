ALTER TABLE "WorkdayControlIssue"
  ADD COLUMN "employeeActionRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "originDate" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CreditRealizationControlCase"
  ADD COLUMN "receiptDelayMinutes" INTEGER,
  ADD COLUMN "receiptCashierRef" TEXT,
  ADD COLUMN "receiptCashierName" TEXT;

ALTER TABLE "CreditRealizationControlEvaluation"
  ADD COLUMN "receiptDelayMinutes" INTEGER,
  ADD COLUMN "receiptCashierRef" TEXT,
  ADD COLUMN "receiptCashierName" TEXT;

CREATE TABLE "WorkdayControlIssueMessage" (
  "id" TEXT NOT NULL,
  "issueId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkdayControlIssueMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkdayCloseExceptionRequest" (
  "id" TEXT NOT NULL,
  "workDayEntryId" INTEGER NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reasonCode" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "issueIds" JSONB NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedById" INTEGER,
  "decisionComment" TEXT NOT NULL DEFAULT '',
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkdayCloseExceptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkdayControlIssue_userId_employeeActionRequired_status_idx" ON "WorkdayControlIssue"("userId", "employeeActionRequired", "status");
CREATE INDEX "WorkdayControlIssueMessage_issueId_createdAt_idx" ON "WorkdayControlIssueMessage"("issueId", "createdAt");
CREATE INDEX "WorkdayControlIssueMessage_authorId_createdAt_idx" ON "WorkdayControlIssueMessage"("authorId", "createdAt");
CREATE INDEX "WorkdayCloseExceptionRequest_workDayEntryId_status_requestedAt_idx" ON "WorkdayCloseExceptionRequest"("workDayEntryId", "status", "requestedAt");
CREATE INDEX "WorkdayCloseExceptionRequest_employeeId_status_requestedAt_idx" ON "WorkdayCloseExceptionRequest"("employeeId", "status", "requestedAt");
CREATE INDEX "WorkdayCloseExceptionRequest_status_requestedAt_idx" ON "WorkdayCloseExceptionRequest"("status", "requestedAt");

ALTER TABLE "WorkdayControlIssueMessage" ADD CONSTRAINT "WorkdayControlIssueMessage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "WorkdayControlIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayControlIssueMessage" ADD CONSTRAINT "WorkdayControlIssueMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkdayCloseExceptionRequest" ADD CONSTRAINT "WorkdayCloseExceptionRequest_workDayEntryId_fkey" FOREIGN KEY ("workDayEntryId") REFERENCES "WorkDayEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayCloseExceptionRequest" ADD CONSTRAINT "WorkdayCloseExceptionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayCloseExceptionRequest" ADD CONSTRAINT "WorkdayCloseExceptionRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
