CREATE TABLE "CreditRealizationControlRun" (
  "id" TEXT NOT NULL,
  "runKey" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'shadow',
  "algorithmVersion" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "oneCComplete" BOOLEAN NOT NULL DEFAULT false,
  "ofdComplete" BOOLEAN NOT NULL DEFAULT false,
  "sourceDocuments" INTEGER NOT NULL DEFAULT 0,
  "confirmedCount" INTEGER NOT NULL DEFAULT 0,
  "mismatchCount" INTEGER NOT NULL DEFAULT 0,
  "needsReviewCount" INTEGER NOT NULL DEFAULT 0,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "unavailableCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditRealizationControlRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditRealizationControlCase" (
  "id" TEXT NOT NULL,
  "realizationRef" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "realizationAt" TIMESTAMP(3) NOT NULL,
  "amountKopecks" INTEGER NOT NULL,
  "managerRef" TEXT,
  "status" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "employeeActionCandidate" BOOLEAN NOT NULL DEFAULT false,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditRealizationControlCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditRealizationControlEvaluation" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "employeeActionCandidate" BOOLEAN NOT NULL DEFAULT false,
  "oneCComplete" BOOLEAN NOT NULL,
  "ofdComplete" BOOLEAN NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditRealizationControlEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditRealizationControlRun_runKey_key" ON "CreditRealizationControlRun"("runKey");
CREATE INDEX "CreditRealizationControlRun_status_startedAt_idx" ON "CreditRealizationControlRun"("status", "startedAt");
CREATE INDEX "CreditRealizationControlRun_periodFrom_periodTo_idx" ON "CreditRealizationControlRun"("periodFrom", "periodTo");
CREATE UNIQUE INDEX "CreditRealizationControlCase_realizationRef_key" ON "CreditRealizationControlCase"("realizationRef");
CREATE INDEX "CreditRealizationControlCase_status_lastCheckedAt_idx" ON "CreditRealizationControlCase"("status", "lastCheckedAt");
CREATE INDEX "CreditRealizationControlCase_managerRef_status_realizationAt_idx" ON "CreditRealizationControlCase"("managerRef", "status", "realizationAt");
CREATE INDEX "CreditRealizationControlCase_employeeActionCandidate_status_realizationAt_idx" ON "CreditRealizationControlCase"("employeeActionCandidate", "status", "realizationAt");
CREATE UNIQUE INDEX "CreditRealizationControlEvaluation_caseId_evidenceHash_key" ON "CreditRealizationControlEvaluation"("caseId", "evidenceHash");
CREATE INDEX "CreditRealizationControlEvaluation_runId_evaluatedAt_idx" ON "CreditRealizationControlEvaluation"("runId", "evaluatedAt");
CREATE INDEX "CreditRealizationControlEvaluation_status_reasonCode_evaluatedAt_idx" ON "CreditRealizationControlEvaluation"("status", "reasonCode", "evaluatedAt");

ALTER TABLE "CreditRealizationControlEvaluation" ADD CONSTRAINT "CreditRealizationControlEvaluation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CreditRealizationControlCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditRealizationControlEvaluation" ADD CONSTRAINT "CreditRealizationControlEvaluation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CreditRealizationControlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
