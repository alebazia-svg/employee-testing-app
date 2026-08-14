ALTER TABLE "UserOneCCashboxMapping"
ADD COLUMN "oneCCashierRef" TEXT,
ADD COLUMN "oneCCashierName" TEXT;

CREATE UNIQUE INDEX "UserOneCCashboxMapping_oneCCashierRef_key"
ON "UserOneCCashboxMapping"("oneCCashierRef");

ALTER TABLE "TerminalFiscalMatch"
ADD COLUMN "oneCCashierRef" TEXT;

ALTER TABLE "TerminalFiscalMatchEvaluation"
ADD COLUMN "oneCCashierRef" TEXT;

CREATE INDEX "TerminalFiscalMatch_oneCCashierRef_idx"
ON "TerminalFiscalMatch"("oneCCashierRef");
