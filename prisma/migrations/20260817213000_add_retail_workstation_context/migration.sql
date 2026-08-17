CREATE TABLE "RetailWorkstation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetailWorkstation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkstationDeviceBinding" (
    "id" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkstationDeviceBinding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TerminalFiscalMapping" ADD COLUMN "workstationId" TEXT;
ALTER TABLE "WorkdayKkmAssignment" ADD COLUMN "workstationId" TEXT;
ALTER TABLE "WorkdayKkmAssignment" ADD COLUMN "deviceBindingId" TEXT;
ALTER TABLE "WorkdayKkmAssignment" ALTER COLUMN "assignedById" DROP NOT NULL;
ALTER TABLE "WorkdayKkmAssignment" ALTER COLUMN "oneCCashRegisterRef" DROP NOT NULL;
ALTER TABLE "WorkdayKkmAssignment" ALTER COLUMN "oneCCashRegisterName" DROP NOT NULL;

CREATE UNIQUE INDEX "RetailWorkstation_code_key" ON "RetailWorkstation"("code");
CREATE INDEX "RetailWorkstation_isActive_code_idx" ON "RetailWorkstation"("isActive", "code");
CREATE UNIQUE INDEX "WorkstationDeviceBinding_tokenHash_key" ON "WorkstationDeviceBinding"("tokenHash");
CREATE INDEX "WorkstationDeviceBinding_workstationId_isActive_revokedAt_idx" ON "WorkstationDeviceBinding"("workstationId", "isActive", "revokedAt");
CREATE INDEX "TerminalFiscalMapping_workstationId_effectiveFrom_effectiveTo_idx" ON "TerminalFiscalMapping"("workstationId", "effectiveFrom", "effectiveTo");
CREATE INDEX "WorkdayKkmAssignment_workstationId_date_effectiveFrom_effectiveTo_idx" ON "WorkdayKkmAssignment"("workstationId", "date", "effectiveFrom", "effectiveTo");
CREATE INDEX "WorkdayKkmAssignment_deviceBindingId_effectiveFrom_effectiveTo_idx" ON "WorkdayKkmAssignment"("deviceBindingId", "effectiveFrom", "effectiveTo");

-- Concurrency guards for the live workstation context. Legacy manual KKM rows
-- (workstationId IS NULL) remain valid and are not rewritten by this migration.
CREATE UNIQUE INDEX "WorkdayKkmAssignment_active_workstation_date_key"
    ON "WorkdayKkmAssignment"("workstationId", "date")
    WHERE "effectiveTo" IS NULL AND "workstationId" IS NOT NULL;
CREATE UNIQUE INDEX "WorkdayKkmAssignment_active_user_date_workstation_key"
    ON "WorkdayKkmAssignment"("userId", "date")
    WHERE "effectiveTo" IS NULL AND "workstationId" IS NOT NULL;
CREATE UNIQUE INDEX "WorkdayKkmAssignment_active_workday_workstation_key"
    ON "WorkdayKkmAssignment"("workDayEntryId")
    WHERE "effectiveTo" IS NULL AND "workstationId" IS NOT NULL AND "workDayEntryId" IS NOT NULL;

ALTER TABLE "WorkstationDeviceBinding"
    ADD CONSTRAINT "WorkstationDeviceBinding_workstationId_fkey"
    FOREIGN KEY ("workstationId") REFERENCES "RetailWorkstation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalMapping"
    ADD CONSTRAINT "TerminalFiscalMapping_workstationId_fkey"
    FOREIGN KEY ("workstationId") REFERENCES "RetailWorkstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkdayKkmAssignment"
    ADD CONSTRAINT "WorkdayKkmAssignment_workstationId_fkey"
    FOREIGN KEY ("workstationId") REFERENCES "RetailWorkstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkdayKkmAssignment"
    ADD CONSTRAINT "WorkdayKkmAssignment_deviceBindingId_fkey"
    FOREIGN KEY ("deviceBindingId") REFERENCES "WorkstationDeviceBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
