CREATE TABLE "ProcurementForecastSnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotDate" TEXT NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementForecastSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcurementForecastSnapshot_snapshotDate_createdAt_idx"
ON "ProcurementForecastSnapshot"("snapshotDate", "createdAt");

CREATE INDEX "ProcurementForecastSnapshot_contentHash_idx"
ON "ProcurementForecastSnapshot"("contentHash");
