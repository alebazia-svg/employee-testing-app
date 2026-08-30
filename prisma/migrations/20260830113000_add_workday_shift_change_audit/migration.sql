CREATE TABLE "WorkdayShiftChange" (
    "id" TEXT NOT NULL,
    "workDayEntryId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'employee',
    "fromShiftCode" TEXT NOT NULL,
    "fromShiftLabel" TEXT NOT NULL,
    "toShiftCode" TEXT NOT NULL,
    "toShiftLabel" TEXT NOT NULL,
    "fromLateMinutes" INTEGER NOT NULL,
    "toLateMinutes" INTEGER NOT NULL,
    "fromShadowPointsX2" INTEGER,
    "toShadowPointsX2" INTEGER,
    "latenessPolicyVersion" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkdayShiftChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkdayShiftChange_workDayEntryId_changedAt_idx" ON "WorkdayShiftChange"("workDayEntryId", "changedAt");
CREATE INDEX "WorkdayShiftChange_userId_changedAt_idx" ON "WorkdayShiftChange"("userId", "changedAt");

ALTER TABLE "WorkdayShiftChange"
ADD CONSTRAINT "WorkdayShiftChange_workDayEntryId_fkey"
FOREIGN KEY ("workDayEntryId") REFERENCES "WorkDayEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkdayShiftChange"
ADD CONSTRAINT "WorkdayShiftChange_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
