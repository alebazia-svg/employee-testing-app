CREATE TABLE "TerminalFiscalMapping" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "terminalKey" TEXT NOT NULL,
  "tbankTerminalId" TEXT,
  "oneCAcquiringTerminalRef" TEXT NOT NULL,
  "oneCCashRegisterRef" TEXT NOT NULL,
  "kktRegistrationNumber" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'manual',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerminalFiscalMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TerminalFiscalMatchRun" (
  "id" TEXT NOT NULL,
  "runKey" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "mappingId" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "cycleKey" TEXT,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "tbankComplete" BOOLEAN NOT NULL DEFAULT false,
  "oneCComplete" BOOLEAN NOT NULL DEFAULT false,
  "ofdComplete" BOOLEAN NOT NULL DEFAULT false,
  "tbankCheckedAt" TIMESTAMP(3),
  "oneCCheckedAt" TIMESTAMP(3),
  "ofdCheckedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerminalFiscalMatchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TerminalFiscalMatch" (
  "id" TEXT NOT NULL,
  "matchingId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "mappingId" TEXT,
  "algorithmVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "operationType" TEXT,
  "bankOperationHash" TEXT NOT NULL,
  "oneCSourceRef" TEXT,
  "oneCSourceHash" TEXT,
  "ofdFiscalKeyHash" TEXT,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "timeDifferenceSeconds" INTEGER,
  "graceUntil" TIMESTAMP(3) NOT NULL,
  "tbankComplete" BOOLEAN NOT NULL,
  "oneCComplete" BOOLEAN NOT NULL,
  "ofdComplete" BOOLEAN NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerminalFiscalMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TerminalFiscalMatchEvaluation" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "cycleKey" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "mappingId" TEXT,
  "bankOperationHash" TEXT NOT NULL,
  "oneCSourceRef" TEXT,
  "oneCSourceHash" TEXT,
  "ofdFiscalKeyHash" TEXT,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "timeDifferenceSeconds" INTEGER,
  "graceUntil" TIMESTAMP(3) NOT NULL,
  "tbankComplete" BOOLEAN NOT NULL,
  "oneCComplete" BOOLEAN NOT NULL,
  "ofdComplete" BOOLEAN NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerminalFiscalMatchEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalFiscalMatchRun_runKey_key" ON "TerminalFiscalMatchRun"("runKey");
CREATE UNIQUE INDEX "TerminalFiscalMatch_matchingId_key" ON "TerminalFiscalMatch"("matchingId");
CREATE UNIQUE INDEX "TerminalFiscalMatchEvaluation_matchId_cycleKey_key" ON "TerminalFiscalMatchEvaluation"("matchId", "cycleKey");
CREATE UNIQUE INDEX "TerminalFiscalMatch_active_bank_operation_key" ON "TerminalFiscalMatch"("bankOperationHash");
CREATE UNIQUE INDEX "TerminalFiscalMatch_active_one_c_check_key" ON "TerminalFiscalMatch"("oneCSourceRef") WHERE "oneCSourceRef" IS NOT NULL;
CREATE UNIQUE INDEX "TerminalFiscalMatch_active_ofd_receipt_key" ON "TerminalFiscalMatch"("ofdFiscalKeyHash") WHERE "ofdFiscalKeyHash" IS NOT NULL;

CREATE INDEX "TerminalFiscalMapping_terminalKey_effectiveFrom_effectiveTo_idx" ON "TerminalFiscalMapping"("terminalKey", "effectiveFrom", "effectiveTo");
CREATE INDEX "TerminalFiscalMapping_oneCAcquiringTerminalRef_effectiveFrom_effectiveTo_idx" ON "TerminalFiscalMapping"("oneCAcquiringTerminalRef", "effectiveFrom", "effectiveTo");
CREATE INDEX "TerminalFiscalMapping_oneCCashRegisterRef_effectiveFrom_effectiveTo_idx" ON "TerminalFiscalMapping"("oneCCashRegisterRef", "effectiveFrom", "effectiveTo");
CREATE INDEX "TerminalFiscalMapping_kktRegistrationNumber_effectiveFrom_effectiveTo_idx" ON "TerminalFiscalMapping"("kktRegistrationNumber", "effectiveFrom", "effectiveTo");
CREATE INDEX "TerminalFiscalMapping_isActive_effectiveFrom_effectiveTo_idx" ON "TerminalFiscalMapping"("isActive", "effectiveFrom", "effectiveTo");
CREATE INDEX "TerminalFiscalMatchRun_mappingId_periodFrom_periodTo_idx" ON "TerminalFiscalMatchRun"("mappingId", "periodFrom", "periodTo");
CREATE INDEX "TerminalFiscalMatchRun_status_leaseUntil_idx" ON "TerminalFiscalMatchRun"("status", "leaseUntil");
CREATE INDEX "TerminalFiscalMatchRun_cycleKey_idx" ON "TerminalFiscalMatchRun"("cycleKey");
CREATE INDEX "TerminalFiscalMatch_runId_status_idx" ON "TerminalFiscalMatch"("runId", "status");
CREATE INDEX "TerminalFiscalMatch_mappingId_checkedAt_idx" ON "TerminalFiscalMatch"("mappingId", "checkedAt");
CREATE INDEX "TerminalFiscalMatch_reasonCode_checkedAt_idx" ON "TerminalFiscalMatch"("reasonCode", "checkedAt");
CREATE INDEX "TerminalFiscalMatch_bankOperationHash_idx" ON "TerminalFiscalMatch"("bankOperationHash");
CREATE INDEX "TerminalFiscalMatch_oneCSourceRef_idx" ON "TerminalFiscalMatch"("oneCSourceRef");
CREATE INDEX "TerminalFiscalMatch_ofdFiscalKeyHash_idx" ON "TerminalFiscalMatch"("ofdFiscalKeyHash");
CREATE INDEX "TerminalFiscalMatchEvaluation_runId_evaluatedAt_idx" ON "TerminalFiscalMatchEvaluation"("runId", "evaluatedAt");
CREATE INDEX "TerminalFiscalMatchEvaluation_status_reasonCode_evaluatedAt_idx" ON "TerminalFiscalMatchEvaluation"("status", "reasonCode", "evaluatedAt");

ALTER TABLE "TerminalFiscalMatchRun" ADD CONSTRAINT "TerminalFiscalMatchRun_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "TerminalFiscalMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalMatch" ADD CONSTRAINT "TerminalFiscalMatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TerminalFiscalMatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalMatch" ADD CONSTRAINT "TerminalFiscalMatch_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "TerminalFiscalMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalMatchEvaluation" ADD CONSTRAINT "TerminalFiscalMatchEvaluation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "TerminalFiscalMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalFiscalMatchEvaluation" ADD CONSTRAINT "TerminalFiscalMatchEvaluation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TerminalFiscalMatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
