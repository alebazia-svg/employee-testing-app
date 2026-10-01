CREATE TABLE "PayrollFinboxRevision" (
  "id" SERIAL NOT NULL,
  "periodKey" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollFinboxRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollFinboxRevision_amount_check" CHECK ("amountCents" >= 0 AND "amountCents" <= 1000000000)
);
CREATE UNIQUE INDEX "PayrollFinboxRevision_periodKey_revision_key" ON "PayrollFinboxRevision"("periodKey", "revision");
