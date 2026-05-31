-- CreateTable
CREATE TABLE "PayrollClassificationRule" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchType" TEXT NOT NULL,
    "itemText" TEXT,
    "categoryText" TEXT,
    "article" TEXT,
    "department" TEXT DEFAULT 'all',
    "saleContext" TEXT DEFAULT 'all',
    "targetCalculationType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollClassificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollClassificationRule_isActive_priority_idx" ON "PayrollClassificationRule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "PayrollClassificationRule_matchType_idx" ON "PayrollClassificationRule"("matchType");

-- CreateIndex
CREATE INDEX "PayrollClassificationRule_targetCalculationType_idx" ON "PayrollClassificationRule"("targetCalculationType");
