-- CreateTable
CREATE TABLE "SalesAnalyticsReport" (
    "id" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "sourceReportType" TEXT NOT NULL DEFAULT 'extended_vgp',
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAnalyticsReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAnalyticsRow" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "sourceReportType" TEXT NOT NULL DEFAULT 'extended_vgp',
    "employeeName" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "client" TEXT,
    "category" TEXT,
    "nomenclatureType" TEXT,
    "itemName" TEXT NOT NULL,
    "article" TEXT,
    "quantity" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPercent" DOUBLE PRECISION,
    "markupPercent" DOUBLE PRECISION,
    "documentName" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "documentDate" TIMESTAMP(3),
    "unitRevenue" DOUBLE PRECISION,
    "unitCost" DOUBLE PRECISION,
    "unitGrossProfit" DOUBLE PRECISION,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "isReturn" BOOLEAN NOT NULL DEFAULT false,
    "isRealReturn" BOOLEAN NOT NULL DEFAULT false,
    "isNegative" BOOLEAN NOT NULL DEFAULT false,
    "problemFlags" JSONB,
    "checkReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesAnalyticsRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesAnalyticsReport_period_idx" ON "SalesAnalyticsReport"("period");

-- CreateIndex
CREATE INDEX "SalesAnalyticsReport_sourceReportType_idx" ON "SalesAnalyticsReport"("sourceReportType");

-- CreateIndex
CREATE INDEX "SalesAnalyticsReport_uploadedAt_idx" ON "SalesAnalyticsReport"("uploadedAt");

-- CreateIndex
CREATE INDEX "SalesAnalyticsRow_reportId_idx" ON "SalesAnalyticsRow"("reportId");

-- CreateIndex
CREATE INDEX "SalesAnalyticsRow_sourceReportType_idx" ON "SalesAnalyticsRow"("sourceReportType");

-- CreateIndex
CREATE INDEX "SalesAnalyticsRow_employeeName_idx" ON "SalesAnalyticsRow"("employeeName");

-- CreateIndex
CREATE INDEX "SalesAnalyticsRow_documentType_idx" ON "SalesAnalyticsRow"("documentType");

-- CreateIndex
CREATE INDEX "SalesAnalyticsRow_isCredit_idx" ON "SalesAnalyticsRow"("isCredit");

-- CreateIndex
CREATE INDEX "SalesAnalyticsRow_isRealReturn_idx" ON "SalesAnalyticsRow"("isRealReturn");

-- CreateIndex
CREATE INDEX "SalesAnalyticsRow_isNegative_idx" ON "SalesAnalyticsRow"("isNegative");

-- AddForeignKey
ALTER TABLE "SalesAnalyticsRow" ADD CONSTRAINT "SalesAnalyticsRow_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SalesAnalyticsReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
