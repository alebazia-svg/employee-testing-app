CREATE TABLE "WorkdayDeviation" (
    "id" TEXT NOT NULL,
    "workDayEntryId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "lateMinutesSnapshot" INTEGER,
    "requestedEndMinutes" INTEGER,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkdayDeviation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkdayDeviation_workDayEntryId_kind_key" ON "WorkdayDeviation"("workDayEntryId", "kind");
CREATE INDEX "WorkdayDeviation_userId_reportedAt_idx" ON "WorkdayDeviation"("userId", "reportedAt");
CREATE INDEX "WorkdayDeviation_kind_reportedAt_idx" ON "WorkdayDeviation"("kind", "reportedAt");

ALTER TABLE "WorkdayDeviation" ADD CONSTRAINT "WorkdayDeviation_workDayEntryId_fkey" FOREIGN KEY ("workDayEntryId") REFERENCES "WorkDayEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkdayDeviation" ADD CONSTRAINT "WorkdayDeviation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
