ALTER TABLE "PayrollRun"
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "finalizedByUserId" INTEGER,
ADD COLUMN "supersededAt" TIMESTAMP(3),
ADD COLUMN "supersededByUserId" INTEGER,
ADD COLUMN "supersededByRunId" INTEGER;

UPDATE "PayrollRun"
SET "finalizedAt" = COALESCE("checkedAt", "updatedAt")
WHERE "status" = 'FINAL';

CREATE INDEX "PayrollRun_supersededByRunId_idx" ON "PayrollRun"("supersededByRunId");
CREATE UNIQUE INDEX "PayrollRun_one_final_per_period_idx"
ON "PayrollRun"("periodId")
WHERE "status" = 'FINAL';

ALTER TABLE "PayrollRun"
ADD CONSTRAINT "PayrollRun_finalizedByUserId_fkey"
FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
ADD CONSTRAINT "PayrollRun_supersededByUserId_fkey"
FOREIGN KEY ("supersededByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
ADD CONSTRAINT "PayrollRun_supersededByRunId_fkey"
FOREIGN KEY ("supersededByRunId") REFERENCES "PayrollRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
