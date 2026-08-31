CREATE TABLE "EmployeeVacation" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "dateFrom" TEXT NOT NULL,
    "dateTo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeVacation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeVacationChange" (
    "id" TEXT NOT NULL,
    "vacationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousDateFrom" TEXT,
    "previousDateTo" TEXT,
    "nextDateFrom" TEXT,
    "nextDateTo" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeVacationChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeVacation_userId_status_dateFrom_dateTo_idx" ON "EmployeeVacation"("userId", "status", "dateFrom", "dateTo");
CREATE INDEX "EmployeeVacation_department_status_dateFrom_dateTo_idx" ON "EmployeeVacation"("department", "status", "dateFrom", "dateTo");
CREATE INDEX "EmployeeVacationChange_vacationId_createdAt_idx" ON "EmployeeVacationChange"("vacationId", "createdAt");
CREATE INDEX "EmployeeVacationChange_userId_createdAt_idx" ON "EmployeeVacationChange"("userId", "createdAt");
CREATE INDEX "EmployeeVacationChange_department_createdAt_idx" ON "EmployeeVacationChange"("department", "createdAt");

ALTER TABLE "EmployeeVacation" ADD CONSTRAINT "EmployeeVacation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeVacation" ADD CONSTRAINT "EmployeeVacation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeVacation" ADD CONSTRAINT "EmployeeVacation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeVacationChange" ADD CONSTRAINT "EmployeeVacationChange_vacationId_fkey" FOREIGN KEY ("vacationId") REFERENCES "EmployeeVacation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeVacationChange" ADD CONSTRAINT "EmployeeVacationChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeVacationChange" ADD CONSTRAINT "EmployeeVacationChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
