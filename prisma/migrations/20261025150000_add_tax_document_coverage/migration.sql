ALTER TABLE "TaxControlDocument"
ADD COLUMN "coverageFrom" TEXT,
ADD COLUMN "coverageTo" TEXT;

CREATE INDEX "TaxControlDocument_coverageFrom_coverageTo_documentType_idx"
ON "TaxControlDocument"("coverageFrom", "coverageTo", "documentType");
