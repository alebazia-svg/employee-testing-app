-- Capture the authoritative server-side QR acceptance before shift selection.
CREATE TABLE "WorkdayStartIntent" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "qrAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkdayStartIntent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkDayEntry"
ADD COLUMN "qrAcceptedAt" TIMESTAMP(3),
ADD COLUMN "startIntentId" TEXT,
ADD COLUMN "latenessPolicyVersion" TEXT,
ADD COLUMN "latenessShadowPointsX2" INTEGER;

CREATE UNIQUE INDEX "WorkdayStartIntent_userId_date_key" ON "WorkdayStartIntent"("userId", "date");
CREATE INDEX "WorkdayStartIntent_date_department_idx" ON "WorkdayStartIntent"("date", "department");
CREATE INDEX "WorkdayStartIntent_expiresAt_consumedAt_idx" ON "WorkdayStartIntent"("expiresAt", "consumedAt");
CREATE UNIQUE INDEX "WorkDayEntry_startIntentId_key" ON "WorkDayEntry"("startIntentId");

ALTER TABLE "WorkdayStartIntent"
ADD CONSTRAINT "WorkdayStartIntent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkDayEntry"
ADD CONSTRAINT "WorkDayEntry_startIntentId_fkey"
FOREIGN KEY ("startIntentId") REFERENCES "WorkdayStartIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
