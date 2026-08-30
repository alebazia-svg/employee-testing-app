ALTER TABLE "CreditRealizationControlCase"
  ADD COLUMN "paymentKind" TEXT,
  ADD COLUMN "paymentDocumentRef" TEXT,
  ADD COLUMN "paymentDocumentNumber" TEXT,
  ADD COLUMN "paymentAmountKopecks" INTEGER,
  ADD COLUMN "expectedCreditKopecks" INTEGER;
