-- ADMIN-only observation and feedback for read-only 1C expense requests.
CREATE TABLE "ExpenseRequestSyncRun" (
    "id" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "sourceComplete" BOOLEAN NOT NULL DEFAULT false,
    "sourceRowCount" INTEGER NOT NULL DEFAULT 0,
    "createdCaseCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCaseCount" INTEGER NOT NULL DEFAULT 0,
    "evaluationCount" INTEGER NOT NULL DEFAULT 0,
    "newNotApprovedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseRequestSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseRequestAdminCase" (
    "id" TEXT NOT NULL,
    "oneCRequestRef" TEXT NOT NULL,
    "oneCNumber" TEXT NOT NULL DEFAULT '',
    "oneCDate" TIMESTAMP(3),
    "posted" BOOLEAN,
    "deletionMark" BOOLEAN,
    "currentStatusKey" TEXT NOT NULL DEFAULT '',
    "currentStatusName" TEXT NOT NULL DEFAULT '',
    "isNotApproved" BOOLEAN NOT NULL DEFAULT false,
    "notApprovedCycle" INTEGER NOT NULL DEFAULT 0,
    "enteredNotApprovedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "seenById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "latestSourceHash" TEXT NOT NULL DEFAULT '',
    "latestRuleVersion" TEXT NOT NULL DEFAULT '',
    "latestCategory" TEXT NOT NULL DEFAULT '',
    "latestCompletenessState" TEXT NOT NULL DEFAULT '',
    "requestedByRef" TEXT NOT NULL DEFAULT '',
    "requestedByName" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(18,2),
    "businessOperationName" TEXT NOT NULL DEFAULT '',
    "counterpartyName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseRequestAdminCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseRequestAdminEvaluation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "notApprovedCycle" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryCandidates" JSONB NOT NULL,
    "completenessState" TEXT NOT NULL,
    "evidenceState" TEXT NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "missingInformation" JSONB NOT NULL,
    "suggestedQuestion" TEXT,
    "decisionSources" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "ambiguous" BOOLEAN NOT NULL,
    "sourceComplete" BOOLEAN NOT NULL,
    "normalizedSource" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseRequestAdminEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseRequestAdminFeedback" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evaluationId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'overall',
    "reasonCode" TEXT,
    "decision" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "reviewedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseRequestAdminFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseRequestSyncRun_runKey_key" ON "ExpenseRequestSyncRun"("runKey");
CREATE INDEX "ExpenseRequestSyncRun_periodFrom_periodTo_idx" ON "ExpenseRequestSyncRun"("periodFrom", "periodTo");
CREATE INDEX "ExpenseRequestSyncRun_status_startedAt_idx" ON "ExpenseRequestSyncRun"("status", "startedAt");
CREATE UNIQUE INDEX "ExpenseRequestAdminCase_oneCRequestRef_key" ON "ExpenseRequestAdminCase"("oneCRequestRef");
CREATE INDEX "ExpenseRequestAdminCase_isNotApproved_seenAt_oneCDate_idx" ON "ExpenseRequestAdminCase"("isNotApproved", "seenAt", "oneCDate");
CREATE INDEX "ExpenseRequestAdminCase_currentStatusKey_oneCDate_idx" ON "ExpenseRequestAdminCase"("currentStatusKey", "oneCDate");
CREATE INDEX "ExpenseRequestAdminCase_requestedByRef_oneCDate_idx" ON "ExpenseRequestAdminCase"("requestedByRef", "oneCDate");
CREATE INDEX "ExpenseRequestAdminCase_latestCompletenessState_oneCDate_idx" ON "ExpenseRequestAdminCase"("latestCompletenessState", "oneCDate");
CREATE UNIQUE INDEX "ExpenseRequestAdminEvaluation_caseId_notApprovedCycle_sourceHash_ruleVersion_key" ON "ExpenseRequestAdminEvaluation"("caseId", "notApprovedCycle", "sourceHash", "ruleVersion");
CREATE INDEX "ExpenseRequestAdminEvaluation_caseId_evaluatedAt_idx" ON "ExpenseRequestAdminEvaluation"("caseId", "evaluatedAt");
CREATE INDEX "ExpenseRequestAdminEvaluation_completenessState_evaluatedAt_idx" ON "ExpenseRequestAdminEvaluation"("completenessState", "evaluatedAt");
CREATE INDEX "ExpenseRequestAdminEvaluation_syncRunId_idx" ON "ExpenseRequestAdminEvaluation"("syncRunId");
CREATE INDEX "ExpenseRequestAdminFeedback_caseId_createdAt_idx" ON "ExpenseRequestAdminFeedback"("caseId", "createdAt");
CREATE INDEX "ExpenseRequestAdminFeedback_evaluationId_reasonCode_createdAt_idx" ON "ExpenseRequestAdminFeedback"("evaluationId", "reasonCode", "createdAt");
CREATE INDEX "ExpenseRequestAdminFeedback_decision_createdAt_idx" ON "ExpenseRequestAdminFeedback"("decision", "createdAt");
CREATE INDEX "ExpenseRequestAdminFeedback_reviewedById_createdAt_idx" ON "ExpenseRequestAdminFeedback"("reviewedById", "createdAt");

ALTER TABLE "ExpenseRequestAdminCase" ADD CONSTRAINT "ExpenseRequestAdminCase_seenById_fkey" FOREIGN KEY ("seenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseRequestAdminCase" ADD CONSTRAINT "ExpenseRequestAdminCase_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseRequestAdminEvaluation" ADD CONSTRAINT "ExpenseRequestAdminEvaluation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseRequestAdminCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseRequestAdminEvaluation" ADD CONSTRAINT "ExpenseRequestAdminEvaluation_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "ExpenseRequestSyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseRequestAdminFeedback" ADD CONSTRAINT "ExpenseRequestAdminFeedback_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseRequestAdminCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseRequestAdminFeedback" ADD CONSTRAINT "ExpenseRequestAdminFeedback_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "ExpenseRequestAdminEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseRequestAdminFeedback" ADD CONSTRAINT "ExpenseRequestAdminFeedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
