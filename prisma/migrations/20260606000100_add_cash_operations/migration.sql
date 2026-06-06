-- CreateTable
CREATE TABLE "CashOperation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "workDayEntryId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "photoPath" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending_1c',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashOperation_userId_date_idx" ON "CashOperation"("userId", "date");

-- CreateIndex
CREATE INDEX "CashOperation_workDayEntryId_idx" ON "CashOperation"("workDayEntryId");

-- CreateIndex
CREATE INDEX "CashOperation_direction_idx" ON "CashOperation"("direction");

-- CreateIndex
CREATE INDEX "CashOperation_status_idx" ON "CashOperation"("status");

-- AddForeignKey
ALTER TABLE "CashOperation" ADD CONSTRAINT "CashOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOperation" ADD CONSTRAINT "CashOperation_workDayEntryId_fkey" FOREIGN KEY ("workDayEntryId") REFERENCES "WorkDayEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
