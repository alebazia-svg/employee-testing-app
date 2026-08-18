ALTER TABLE "CashOperation"
ADD COLUMN "oneCReceiptDocumentRef" TEXT,
ADD COLUMN "oneCReceiptDocumentNumber" TEXT,
ADD COLUMN "oneCPostedAt" TIMESTAMP(3);

CREATE INDEX "CashOperation_oneCReceiptDocumentRef_idx"
ON "CashOperation"("oneCReceiptDocumentRef");
