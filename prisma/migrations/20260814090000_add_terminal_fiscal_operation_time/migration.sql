ALTER TABLE "TerminalFiscalMatch"
ADD COLUMN "bankOperationAt" TIMESTAMP(3);

ALTER TABLE "TerminalFiscalMatchEvaluation"
ADD COLUMN "bankOperationAt" TIMESTAMP(3);

CREATE INDEX "TerminalFiscalMatch_mappingId_bankOperationAt_idx"
ON "TerminalFiscalMatch"("mappingId", "bankOperationAt");
