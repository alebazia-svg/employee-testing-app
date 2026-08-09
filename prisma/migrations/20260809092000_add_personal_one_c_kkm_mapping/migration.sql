ALTER TABLE "UserOneCCashboxMapping"
  ADD COLUMN "oneCCashRegisterRef" TEXT,
  ADD COLUMN "oneCCashRegisterName" TEXT,
  ADD COLUMN "oneCAcquiringTerminalRef" TEXT,
  ADD COLUMN "oneCAcquiringTerminalName" TEXT,
  ADD COLUMN "tbankTerminalId" TEXT,
  ADD COLUMN "kkmMode" TEXT NOT NULL DEFAULT 'personal';

CREATE INDEX "UserOneCCashboxMapping_oneCCashRegisterRef_idx" ON "UserOneCCashboxMapping"("oneCCashRegisterRef");
CREATE INDEX "UserOneCCashboxMapping_tbankTerminalId_idx" ON "UserOneCCashboxMapping"("tbankTerminalId");
