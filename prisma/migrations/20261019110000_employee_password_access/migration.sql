-- Additive: existing passwords and sessions remain valid until an explicit reset.
ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "passwordResetAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetById" INTEGER;
