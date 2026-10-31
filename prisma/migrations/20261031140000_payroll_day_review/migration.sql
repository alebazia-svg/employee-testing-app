CREATE TABLE "PayrollDayReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "payrollName" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL CHECK ("periodKey" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  "dates" JSONB NOT NULL CHECK (jsonb_typeof("dates") = 'array' AND jsonb_array_length("dates") BETWEEN 1 AND 31),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','approved','rejected','cancelled')),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accessOnly" BOOLEAN NOT NULL DEFAULT false,
  "dayRateCents" INTEGER NOT NULL CHECK ("dayRateCents" > 0),
  "approvedAdditionalDays" INTEGER CHECK ("approvedAdditionalDays" BETWEEN 0 AND 31),
  "approvedAmountCents" INTEGER CHECK ("approvedAmountCents" >= 0),
  "decidedAt" TIMESTAMP(3),
  "decidedById" INTEGER REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decisionComment" TEXT NOT NULL DEFAULT '',
  CHECK (("status" = 'pending' AND "decidedAt" IS NULL AND "decidedById" IS NULL) OR ("status" <> 'pending' AND "decidedAt" IS NOT NULL)),
  CHECK ("status" NOT IN ('approved','rejected') OR "decidedById" IS NOT NULL)
);
CREATE INDEX "PayrollDayReview_employeeId_periodKey_status_idx" ON "PayrollDayReview"("employeeId","periodKey","status");
CREATE INDEX "PayrollDayReview_status_submittedAt_idx" ON "PayrollDayReview"("status","submittedAt");
CREATE UNIQUE INDEX "PayrollDayReview_one_pending" ON "PayrollDayReview"("employeeId","periodKey") WHERE "status" = 'pending';

ALTER TABLE "PayrollDayReview" ADD CONSTRAINT "PayrollDayReview_access_only_amount" CHECK (NOT "accessOnly" OR (COALESCE("approvedAdditionalDays",0)=0 AND COALESCE("approvedAmountCents",0)=0));
