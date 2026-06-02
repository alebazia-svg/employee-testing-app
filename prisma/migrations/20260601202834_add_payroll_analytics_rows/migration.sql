-- CreateTable
CREATE TABLE "PayrollAnalyticsRow" (
    "id" SERIAL NOT NULL,
    "payrollRunId" INTEGER NOT NULL,
    "sourceFileId" INTEGER,
    "periodKey" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeId" INTEGER,
    "department" TEXT,
    "location" TEXT,
    "client" TEXT,
    "category" TEXT,
    "nomenclatureType" TEXT,
    "itemName" TEXT NOT NULL,
    "article" TEXT,
    "quantity" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPercent" DOUBLE PRECISION,
    "markupPercent" DOUBLE PRECISION,
    "calculationType" TEXT NOT NULL,
    "componentType" TEXT,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "isReturn" BOOLEAN NOT NULL DEFAULT false,
    "isNegative" BOOLEAN NOT NULL DEFAULT false,
    "isManualRuleApplied" BOOLEAN NOT NULL DEFAULT false,
    "manualRuleLabel" TEXT,
    "problemFlags" JSONB,
    "checkReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAnalyticsRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollAnalyticsRow_payrollRunId_idx" ON "PayrollAnalyticsRow"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollAnalyticsRow_periodKey_idx" ON "PayrollAnalyticsRow"("periodKey");

-- CreateIndex
CREATE INDEX "PayrollAnalyticsRow_employeeName_idx" ON "PayrollAnalyticsRow"("employeeName");

-- CreateIndex
CREATE INDEX "PayrollAnalyticsRow_calculationType_idx" ON "PayrollAnalyticsRow"("calculationType");

-- CreateIndex
CREATE INDEX "PayrollAnalyticsRow_isCredit_idx" ON "PayrollAnalyticsRow"("isCredit");

-- CreateIndex
CREATE INDEX "PayrollAnalyticsRow_isNegative_idx" ON "PayrollAnalyticsRow"("isNegative");

-- AddForeignKey
ALTER TABLE "PayrollAnalyticsRow" ADD CONSTRAINT "PayrollAnalyticsRow_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAnalyticsRow" ADD CONSTRAINT "PayrollAnalyticsRow_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "PayrollSourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
