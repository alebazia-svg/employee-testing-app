DROP INDEX "WorkdayKkmAssignment_workDayEntryId_key";
DROP INDEX "WorkdayKkmAssignment_userId_date_key";
DROP INDEX "WorkdayKkmAssignment_date_oneCCashRegisterRef_key";
DROP INDEX "WorkdayKkmAssignment_date_idx";

ALTER TABLE "WorkdayKkmAssignment"
  ADD COLUMN "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN "effectiveTo" TIMESTAMP(3),
  ADD COLUMN "changeReason" TEXT NOT NULL DEFAULT '';

UPDATE "WorkdayKkmAssignment"
SET "effectiveFrom" = "assignedAt"
WHERE "effectiveFrom" IS NULL;

ALTER TABLE "WorkdayKkmAssignment" ALTER COLUMN "effectiveFrom" SET NOT NULL;
ALTER TABLE "WorkdayKkmAssignment" DROP COLUMN "lockedAt";

CREATE INDEX "WorkdayKkmAssignment_userId_date_effectiveFrom_idx" ON "WorkdayKkmAssignment"("userId", "date", "effectiveFrom");
CREATE INDEX "WorkdayKkmAssignment_date_effectiveFrom_effectiveTo_idx" ON "WorkdayKkmAssignment"("date", "effectiveFrom", "effectiveTo");
