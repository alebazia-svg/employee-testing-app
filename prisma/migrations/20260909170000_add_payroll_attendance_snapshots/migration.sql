CREATE TABLE "PayrollAttendanceSnapshot" (
    "id" SERIAL NOT NULL,
    "periodKey" TEXT NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAttendanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollAttendanceSnapshot_periodKey_key"
ON "PayrollAttendanceSnapshot"("periodKey");

CREATE INDEX "PayrollAttendanceSnapshot_sourceCheckedAt_idx"
ON "PayrollAttendanceSnapshot"("sourceCheckedAt");
