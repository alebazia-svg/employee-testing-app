ALTER TABLE "SupplierPaymentPlan" ADD COLUMN "paymentPurpose" TEXT NOT NULL DEFAULT 'GOODS';
ALTER TABLE "SupplierPaymentPlan" ADD CONSTRAINT "SupplierPaymentPlan_paymentPurpose_check" CHECK ("paymentPurpose" IN ('GOODS', 'DELIVERY'));
