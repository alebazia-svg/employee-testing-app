-- Expand the existing allow-list; do not rewrite any payment plan or link.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "SupplierPaymentPlan"
  DROP CONSTRAINT "SupplierPaymentPlan_paymentPurpose_check",
  ADD CONSTRAINT "SupplierPaymentPlan_paymentPurpose_check"
    CHECK ("paymentPurpose" IN ('GOODS', 'DELIVERY', 'SUPPLIER_ADVANCE'));
COMMIT;
