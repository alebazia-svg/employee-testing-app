CREATE TABLE "EmployeePreviewVisit" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "adminId" INTEGER NOT NULL,
 "employeeId" INTEGER NOT NULL,
 "adminName" TEXT NOT NULL,
 "employeeName" TEXT NOT NULL,
 "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "EmployeePreviewVisit_adminId_openedAt_idx" ON "EmployeePreviewVisit"("adminId", "openedAt");
CREATE INDEX "EmployeePreviewVisit_employeeId_openedAt_idx" ON "EmployeePreviewVisit"("employeeId", "openedAt");
