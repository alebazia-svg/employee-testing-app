-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workdayControlMode" TEXT NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "RetailCashHandover" (
    "id" TEXT NOT NULL,
    "workDayEntryId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "countRequestKey" TEXT NOT NULL,
    "actual" DECIMAL(18,2) NOT NULL,
    "expected" DECIMAL(18,2),
    "snapshot" JSONB NOT NULL,
    "countHistory" JSONB NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'counted',
    "organizationRef" TEXT NOT NULL,
    "sourceCashboxRef" TEXT NOT NULL,
    "recipientUserId" INTEGER,
    "recipientWorkDayId" INTEGER,
    "recipientName" TEXT,
    "targetCashboxRef" TEXT,
    "preparedUntil" TIMESTAMP(3),
    "handedAt" TIMESTAMP(3),
    "operationKey" TEXT NOT NULL,
    "processingToken" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "expenseRef" TEXT,
    "expenseNumber" TEXT,
    "receiptRef" TEXT,
    "receiptNumber" TEXT,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailCashHandover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetailCashHandover_workDayEntryId_key" ON "RetailCashHandover"("workDayEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailCashHandover_countRequestKey_key" ON "RetailCashHandover"("countRequestKey");

-- CreateIndex
CREATE UNIQUE INDEX "RetailCashHandover_operationKey_key" ON "RetailCashHandover"("operationKey");

-- CreateIndex
CREATE INDEX "RetailCashHandover_status_updatedAt_idx" ON "RetailCashHandover"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "RetailCashHandover" ADD CONSTRAINT "RetailCashHandover_workDayEntryId_fkey" FOREIGN KEY ("workDayEntryId") REFERENCES "WorkDayEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
