ALTER TABLE "TerminalFiscalReviewParticipant"
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "handlingUntil" TIMESTAMP(3),
ADD COLUMN "response" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "respondedAt" TIMESTAMP(3);
