-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rulesVersion" TEXT NOT NULL DEFAULT 'client-snapshot-v1',
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dayPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disciplineBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceSummary" JSONB,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEmployeeResult" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "userId" INTEGER,
    "department" TEXT NOT NULL,
    "payrollDepartment" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "salaryType" TEXT NOT NULL,
    "salaryRule" TEXT NOT NULL,
    "workedDays" DOUBLE PRECISION,
    "lateCount" DOUBLE PRECISION,
    "daysSource" TEXT NOT NULL,
    "dayRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dayPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "filmBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plotterBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "techBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accessoryBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wholesaleBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disciplineBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseBase" DOUBLE PRECISION,
    "purchasePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasePercentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseTargetAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseTargetSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "agentCreditCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "reasons" JSONB,
    "comment" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayrollEmployeeResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSourceFile" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedSheet" TEXT,
    "rowCount" INTEGER,
    "parsedRowCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "warnings" JSONB,
    "metadata" JSONB,

    CONSTRAINT "PayrollSourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollManualInput" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "workedDays" TEXT,
    "lateCount" TEXT,
    "advance" TEXT,
    "agentCreditCommission" TEXT,
    "fixedBonus" TEXT,
    "fixedDeduction" TEXT,
    "purchaseAdvance" TEXT,
    "purchaseDeduction" TEXT,
    "comment" TEXT NOT NULL DEFAULT '',
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollManualInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollCalculationDetail" (
    "id" SERIAL NOT NULL,
    "employeeResultId" INTEGER NOT NULL,
    "component" TEXT NOT NULL,
    "base" DOUBLE PRECISION,
    "formula" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comment" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayrollCalculationDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "employeeResultId" INTEGER,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_periodKey_key" ON "PayrollPeriod"("periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_year_month_key" ON "PayrollPeriod"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_periodId_runNumber_key" ON "PayrollRun"("periodId", "runNumber");

-- CreateIndex
CREATE INDEX "PayrollEmployeeResult_runId_idx" ON "PayrollEmployeeResult"("runId");

-- CreateIndex
CREATE INDEX "PayrollEmployeeResult_employeeName_idx" ON "PayrollEmployeeResult"("employeeName");

-- CreateIndex
CREATE INDEX "PayrollSourceFile_runId_idx" ON "PayrollSourceFile"("runId");

-- CreateIndex
CREATE INDEX "PayrollSourceFile_sha256_idx" ON "PayrollSourceFile"("sha256");

-- CreateIndex
CREATE INDEX "PayrollManualInput_runId_idx" ON "PayrollManualInput"("runId");

-- CreateIndex
CREATE INDEX "PayrollManualInput_employeeName_idx" ON "PayrollManualInput"("employeeName");

-- CreateIndex
CREATE INDEX "PayrollCalculationDetail_employeeResultId_idx" ON "PayrollCalculationDetail"("employeeResultId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_runId_idx" ON "PayrollAdjustment"("runId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_employeeResultId_idx" ON "PayrollAdjustment"("employeeResultId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeResult" ADD CONSTRAINT "PayrollEmployeeResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSourceFile" ADD CONSTRAINT "PayrollSourceFile_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollManualInput" ADD CONSTRAINT "PayrollManualInput_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCalculationDetail" ADD CONSTRAINT "PayrollCalculationDetail_employeeResultId_fkey" FOREIGN KEY ("employeeResultId") REFERENCES "PayrollEmployeeResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_employeeResultId_fkey" FOREIGN KEY ("employeeResultId") REFERENCES "PayrollEmployeeResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
