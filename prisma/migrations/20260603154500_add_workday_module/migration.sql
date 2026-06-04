CREATE TABLE "WorkScheduleEntry" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkScheduleEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkDayEntry" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "shiftCode" TEXT NOT NULL,
  "shiftLabel" TEXT NOT NULL,
  "shiftStartMinutes" INTEGER,
  "shiftEndMinutes" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "comment" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkDayEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkScheduleEntry_userId_date_key" ON "WorkScheduleEntry"("userId", "date");
CREATE INDEX "WorkScheduleEntry_date_idx" ON "WorkScheduleEntry"("date");
CREATE INDEX "WorkScheduleEntry_department_date_idx" ON "WorkScheduleEntry"("department", "date");
CREATE INDEX "WorkScheduleEntry_status_idx" ON "WorkScheduleEntry"("status");

CREATE UNIQUE INDEX "WorkDayEntry_userId_date_key" ON "WorkDayEntry"("userId", "date");
CREATE INDEX "WorkDayEntry_date_idx" ON "WorkDayEntry"("date");
CREATE INDEX "WorkDayEntry_department_date_idx" ON "WorkDayEntry"("department", "date");
CREATE INDEX "WorkDayEntry_status_idx" ON "WorkDayEntry"("status");

ALTER TABLE "WorkScheduleEntry" ADD CONSTRAINT "WorkScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkDayEntry" ADD CONSTRAINT "WorkDayEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
