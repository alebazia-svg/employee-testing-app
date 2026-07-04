CREATE TABLE "UserOneCCashboxMapping" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "oneCCashboxRef" TEXT NOT NULL,
    "oneCCashboxName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOneCCashboxMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserOneCCashboxMapping_userId_key" ON "UserOneCCashboxMapping"("userId");
CREATE INDEX "UserOneCCashboxMapping_oneCCashboxRef_idx" ON "UserOneCCashboxMapping"("oneCCashboxRef");
CREATE INDEX "UserOneCCashboxMapping_isActive_idx" ON "UserOneCCashboxMapping"("isActive");

ALTER TABLE "UserOneCCashboxMapping" ADD CONSTRAINT "UserOneCCashboxMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
