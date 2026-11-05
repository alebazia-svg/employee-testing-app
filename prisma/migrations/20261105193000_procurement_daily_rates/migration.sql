CREATE TABLE "ProcurementDailyRate" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "day" DATE NOT NULL,
 "currency" TEXT NOT NULL CHECK ("currency" IN ('USDT','CNY')),
 "rate" DECIMAL(18,6) NOT NULL CHECK ("rate" > 0),
 "revision" INTEGER NOT NULL CHECK ("revision" > 0),
 "actorUserId" INTEGER NOT NULL,
 "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProcurementDailyRate_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProcurementDailyRate_day_currency_revision_key" ON "ProcurementDailyRate"("day", "currency", "revision");
