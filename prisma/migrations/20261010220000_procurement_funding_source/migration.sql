ALTER TABLE "SupplierPaymentPlan" ADD COLUMN "fundingSource" TEXT;
ALTER TABLE "SupplierPaymentPlan" ADD CONSTRAINT "SupplierPaymentPlan_fundingSource_check"
CHECK ("fundingSource" IS NULL OR ("paymentMethod" = 'USDT' AND "fundingSource" IN ('WALLET', 'CASH_EXCHANGE')));
