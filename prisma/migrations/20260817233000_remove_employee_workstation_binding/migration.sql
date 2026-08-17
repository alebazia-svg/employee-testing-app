-- Workstations remain equipment-only through TerminalFiscalMapping.workstationId.
-- Employee attribution is based exclusively on the confirmed 1C cashier mapping.
DROP INDEX IF EXISTS "WorkdayKkmAssignment_active_workstation_date_key";
DROP INDEX IF EXISTS "WorkdayKkmAssignment_active_user_date_workstation_key";
DROP INDEX IF EXISTS "WorkdayKkmAssignment_active_workday_workstation_key";
DROP INDEX IF EXISTS "WorkdayKkmAssignment_workstationId_date_effectiveFrom_effectiveTo_idx";
DROP INDEX IF EXISTS "WorkdayKkmAssignment_deviceBindingId_effectiveFrom_effectiveTo_idx";

ALTER TABLE "WorkdayKkmAssignment"
    DROP CONSTRAINT IF EXISTS "WorkdayKkmAssignment_workstationId_fkey",
    DROP CONSTRAINT IF EXISTS "WorkdayKkmAssignment_deviceBindingId_fkey",
    DROP COLUMN IF EXISTS "workstationId",
    DROP COLUMN IF EXISTS "deviceBindingId";

DROP TABLE IF EXISTS "WorkstationDeviceBinding";
