CREATE TABLE "SupplierPaymentReceipt" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "authorUserId" INTEGER NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPaymentReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierPaymentReceipt_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SupplierPaymentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SupplierPaymentReceipt_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupplierPaymentReceipt_storageKey_key" ON "SupplierPaymentReceipt"("storageKey");
CREATE UNIQUE INDEX "SupplierPaymentReceipt_planId_sha256_key" ON "SupplierPaymentReceipt"("planId", "sha256");
CREATE INDEX "SupplierPaymentReceipt_planId_createdAt_idx" ON "SupplierPaymentReceipt"("planId", "createdAt");
