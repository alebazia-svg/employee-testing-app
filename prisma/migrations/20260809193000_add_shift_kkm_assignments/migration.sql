CREATE TABLE "WorkdayKkmAssignment" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "plannedShiftCode" TEXT,
  "oneCCashRegisterRef" TEXT NOT NULL,
  "oneCCashRegisterName" TEXT NOT NULL,
  "kkmMode" TEXT NOT NULL DEFAULT 'personal',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "note" TEXT NOT NULL DEFAULT '',
  "assignedById" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "workDayEntryId" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkdayKkmAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkdayKkmAssignment_workDayEntryId_key" ON "WorkdayKkmAssignment"("workDayEntryId");
CREATE UNIQUE INDEX "WorkdayKkmAssignment_userId_date_key" ON "WorkdayKkmAssignment"("userId", "date");
CREATE UNIQUE INDEX "WorkdayKkmAssignment_date_oneCCashRegisterRef_key" ON "WorkdayKkmAssignment"("date", "oneCCashRegisterRef");
CREATE INDEX "WorkdayKkmAssignment_date_idx" ON "WorkdayKkmAssignment"("date");
CREATE INDEX "WorkdayKkmAssignment_oneCCashRegisterRef_date_idx" ON "WorkdayKkmAssignment"("oneCCashRegisterRef", "date");
CREATE INDEX "WorkdayKkmAssignment_assignedById_assignedAt_idx" ON "WorkdayKkmAssignment"("assignedById", "assignedAt");

ALTER TABLE "WorkdayKkmAssignment" ADD CONSTRAINT "WorkdayKkmAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayKkmAssignment" ADD CONSTRAINT "WorkdayKkmAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkdayKkmAssignment" ADD CONSTRAINT "WorkdayKkmAssignment_workDayEntryId_fkey" FOREIGN KEY ("workDayEntryId") REFERENCES "WorkDayEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
