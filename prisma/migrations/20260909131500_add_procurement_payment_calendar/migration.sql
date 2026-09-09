ALTER TABLE "User"
ADD COLUMN "portalArea" TEXT NOT NULL DEFAULT 'WORKDAY',
ADD COLUMN "oneCManagerName" TEXT;

CREATE TABLE "SupplierPaymentPlan" (
  "id" TEXT NOT NULL,
  "planCode" TEXT NOT NULL,
  "managerUserId" INTEGER NOT NULL,
  "supplierPartner" TEXT NOT NULL,
  "supplierCounterparty" TEXT NOT NULL DEFAULT '',
  "orderRefs" JSONB NOT NULL,
  "orderNumbers" JSONB NOT NULL,
  "plannedDate" DATE NOT NULL,
  "plannedAmount" DECIMAL(18,2) NOT NULL,
  "condition" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "foreignAmount" DECIMAL(18,4),
  "exchangeRate" DECIMAL(18,6),
  "commissionAmount" DECIMAL(18,2),
  "exchangerName" TEXT NOT NULL DEFAULT '',
  "supplierConfirmation" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "approvedAt" TIMESTAMP(3),
  "approvedById" INTEGER,
  "oneCExpenseRequestRef" TEXT,
  "oneCCashEvidence" JSONB,
  "oneCIssuedAmount" DECIMAL(18,2),
  "oneCCashMatchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierPaymentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPaymentPlanEvent" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPaymentPlanEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPaymentPlan_planCode_key" ON "SupplierPaymentPlan"("planCode");
CREATE INDEX "SupplierPaymentPlan_managerUserId_plannedDate_idx" ON "SupplierPaymentPlan"("managerUserId", "plannedDate");
CREATE INDEX "SupplierPaymentPlan_status_plannedDate_idx" ON "SupplierPaymentPlan"("status", "plannedDate");
CREATE INDEX "SupplierPaymentPlan_supplierPartner_plannedDate_idx" ON "SupplierPaymentPlan"("supplierPartner", "plannedDate");
CREATE INDEX "SupplierPaymentPlanEvent_planId_createdAt_idx" ON "SupplierPaymentPlanEvent"("planId", "createdAt");
CREATE INDEX "SupplierPaymentPlanEvent_actorUserId_createdAt_idx" ON "SupplierPaymentPlanEvent"("actorUserId", "createdAt");

ALTER TABLE "SupplierPaymentPlan" ADD CONSTRAINT "SupplierPaymentPlan_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentPlan" ADD CONSTRAINT "SupplierPaymentPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentPlanEvent" ADD CONSTRAINT "SupplierPaymentPlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SupplierPaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentPlanEvent" ADD CONSTRAINT "SupplierPaymentPlanEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
