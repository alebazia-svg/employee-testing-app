CREATE TABLE "TaxControlDocument" (
  "id" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "uploadedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxControlDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxControlDocument_storageKey_key" ON "TaxControlDocument"("storageKey");
CREATE UNIQUE INDEX "TaxControlDocument_documentType_periodKey_sha256_key" ON "TaxControlDocument"("documentType", "periodKey", "sha256");
CREATE INDEX "TaxControlDocument_periodKey_documentType_createdAt_idx" ON "TaxControlDocument"("periodKey", "documentType", "createdAt");
CREATE INDEX "TaxControlDocument_status_createdAt_idx" ON "TaxControlDocument"("status", "createdAt");
ALTER TABLE "TaxControlDocument" ADD CONSTRAINT "TaxControlDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
