-- Keep historical baseline requests in audit without treating them as a live ADMIN queue.
ALTER TABLE "ExpenseRequestAdminCase"
ADD COLUMN "currentCycleOrigin" TEXT NOT NULL DEFAULT '';

UPDATE "ExpenseRequestAdminCase"
SET "currentCycleOrigin" = 'baseline'
WHERE "isNotApproved" = true;

CREATE INDEX "ExpenseRequestAdminCase_isNotApproved_currentCycleOrigin_deletionMark_oneCDate_idx"
ON "ExpenseRequestAdminCase"("isNotApproved", "currentCycleOrigin", "deletionMark", "oneCDate");
