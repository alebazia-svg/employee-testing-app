CREATE TABLE "PayrollOneCControlSnapshot" (
    "id" SERIAL NOT NULL,
    "periodKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DAILY',
    "dateFrom" TEXT NOT NULL,
    "dateTo" TEXT NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollOneCControlSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollOneCControlSnapshot_periodKey_kind_dateFrom_dateTo_key"
ON "PayrollOneCControlSnapshot"("periodKey", "kind", "dateFrom", "dateTo");

CREATE INDEX "PayrollOneCControlSnapshot_periodKey_kind_dateTo_idx"
ON "PayrollOneCControlSnapshot"("periodKey", "kind", "dateTo");
