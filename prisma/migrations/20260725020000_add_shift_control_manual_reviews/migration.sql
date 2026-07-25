CREATE TABLE "ShiftControlManualReview" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "checkId" TEXT NOT NULL,
    "checkLabel" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "reviewedById" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftControlManualReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftControlManualReview_taskId_checkId_reviewedAt_idx"
ON "ShiftControlManualReview"("taskId", "checkId", "reviewedAt");

CREATE INDEX "ShiftControlManualReview_reviewedById_reviewedAt_idx"
ON "ShiftControlManualReview"("reviewedById", "reviewedAt");

ALTER TABLE "ShiftControlManualReview"
ADD CONSTRAINT "ShiftControlManualReview_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "ShiftControlTask"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftControlManualReview"
ADD CONSTRAINT "ShiftControlManualReview_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
