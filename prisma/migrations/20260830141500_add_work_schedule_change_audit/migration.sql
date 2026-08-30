CREATE TABLE "WorkScheduleChange" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "previousStatus" TEXT,
  "nextStatus" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'employee',
  "workingBefore" INTEGER NOT NULL,
  "workingAfter" INTEGER NOT NULL,
  "coverageState" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkScheduleChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkScheduleChange_userId_date_createdAt_idx" ON "WorkScheduleChange"("userId", "date", "createdAt");
CREATE INDEX "WorkScheduleChange_department_date_createdAt_idx" ON "WorkScheduleChange"("department", "date", "createdAt");
CREATE INDEX "WorkScheduleChange_coverageState_createdAt_idx" ON "WorkScheduleChange"("coverageState", "createdAt");

ALTER TABLE "WorkScheduleChange"
ADD CONSTRAINT "WorkScheduleChange_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
