CREATE TABLE "PayrollDraftRevision" (
    "id" SERIAL NOT NULL,
    "periodKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollDraftRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayrollDraftRevision_positive_revision" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "PayrollDraftRevision_periodKey_revision_key" ON "PayrollDraftRevision"("periodKey", "revision");
CREATE UNIQUE INDEX "PayrollDraftRevision_periodKey_requestId_key" ON "PayrollDraftRevision"("periodKey", "requestId");
