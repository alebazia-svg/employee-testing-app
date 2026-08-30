ALTER TABLE "TerminalFiscalEmployeeReview"
ADD COLUMN "assignmentScope" TEXT NOT NULL DEFAULT 'individual';

ALTER TABLE "TerminalFiscalMatch"
ADD COLUMN "bankOperationRawType" TEXT;

ALTER TABLE "TerminalFiscalMatchEvaluation"
ADD COLUMN "bankOperationRawType" TEXT;

CREATE TABLE "TerminalFiscalReviewParticipant" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TerminalFiscalReviewParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalFiscalReviewParticipant_reviewId_userId_key"
ON "TerminalFiscalReviewParticipant"("reviewId", "userId");

CREATE INDEX "TerminalFiscalReviewParticipant_userId_reviewId_idx"
ON "TerminalFiscalReviewParticipant"("userId", "reviewId");

ALTER TABLE "TerminalFiscalReviewParticipant"
ADD CONSTRAINT "TerminalFiscalReviewParticipant_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "TerminalFiscalEmployeeReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TerminalFiscalReviewParticipant"
ADD CONSTRAINT "TerminalFiscalReviewParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
