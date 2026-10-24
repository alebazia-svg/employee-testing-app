-- Additive only. Existing files, payment links and plan amounts are untouched.
ALTER TABLE "SupplierPaymentReceipt"
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'RECEIPT',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "replacedById" TEXT,
  ADD COLUMN "qrConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "qrConfirmedById" INTEGER,
  ADD COLUMN "qrConfirmationContext" TEXT,
  ADD COLUMN "paymentRefs" JSONB,
  ADD COLUMN "paymentSnapshots" JSONB,
  ADD COLUMN "receiptPlanContext" TEXT;
ALTER TABLE "SupplierPaymentReceipt"
  ADD CONSTRAINT "SupplierPaymentReceipt_purpose_check" CHECK ("purpose" IN ('RECEIPT', 'REQUISITES', 'QR')),
  ADD CONSTRAINT "SupplierPaymentReceipt_revision_check" CHECK ("revision" >= 0),
  ADD CONSTRAINT "SupplierPaymentReceipt_replacement_fk" FOREIGN KEY ("replacedById") REFERENCES "SupplierPaymentReceipt"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "SupplierPaymentReceipt_qr_actor_fk" FOREIGN KEY ("qrConfirmedById") REFERENCES "User"("id") ON DELETE RESTRICT;
CREATE INDEX "SupplierPaymentReceipt_planId_purpose_idx" ON "SupplierPaymentReceipt"("planId", "purpose");
