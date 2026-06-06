-- CreateTable
CREATE TABLE "ShiftControlTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftControlTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftControlTemplateTask" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "plannedTimeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftControlTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftControlRun" (
    "id" SERIAL NOT NULL,
    "workDayEntryId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "templateId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closingComment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftControlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftControlTask" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "templateTaskId" INTEGER,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "plannedTimeMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftControlTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftControlTemplate_department_isActive_idx" ON "ShiftControlTemplate"("department", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftControlTemplate_department_version_key" ON "ShiftControlTemplate"("department", "version");

-- CreateIndex
CREATE INDEX "ShiftControlTemplateTask_templateId_sortOrder_idx" ON "ShiftControlTemplateTask"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShiftControlTemplateTask_category_idx" ON "ShiftControlTemplateTask"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftControlRun_workDayEntryId_key" ON "ShiftControlRun"("workDayEntryId");

-- CreateIndex
CREATE INDEX "ShiftControlRun_userId_date_idx" ON "ShiftControlRun"("userId", "date");

-- CreateIndex
CREATE INDEX "ShiftControlRun_department_date_idx" ON "ShiftControlRun"("department", "date");

-- CreateIndex
CREATE INDEX "ShiftControlRun_status_idx" ON "ShiftControlRun"("status");

-- CreateIndex
CREATE INDEX "ShiftControlTask_runId_sortOrder_idx" ON "ShiftControlTask"("runId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShiftControlTask_status_idx" ON "ShiftControlTask"("status");

-- CreateIndex
CREATE INDEX "ShiftControlTask_category_idx" ON "ShiftControlTask"("category");

-- AddForeignKey
ALTER TABLE "ShiftControlTemplateTask" ADD CONSTRAINT "ShiftControlTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftControlTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftControlRun" ADD CONSTRAINT "ShiftControlRun_workDayEntryId_fkey" FOREIGN KEY ("workDayEntryId") REFERENCES "WorkDayEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftControlRun" ADD CONSTRAINT "ShiftControlRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftControlRun" ADD CONSTRAINT "ShiftControlRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftControlTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftControlTask" ADD CONSTRAINT "ShiftControlTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ShiftControlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftControlTask" ADD CONSTRAINT "ShiftControlTask_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "ShiftControlTemplateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed initial retail shift control template
INSERT INTO "ShiftControlTemplate" ("name", "department", "isActive", "version", "updatedAt")
VALUES ('Retail shift control v1', 'retail', true, 1, CURRENT_TIMESTAMP);

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT "id", 'Проверить готовность торговой точки', 'opening', 10, true, 0, CURRENT_TIMESTAMP
FROM "ShiftControlTemplate"
WHERE "department" = 'retail' AND "version" = 1;

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT "id", 'Проверить витрины и выкладку', 'opening', 20, true, 30, CURRENT_TIMESTAMP
FROM "ShiftControlTemplate"
WHERE "department" = 'retail' AND "version" = 1;

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT "id", 'Проверить рабочую зону в течение смены', 'during_shift', 30, true, 240, CURRENT_TIMESTAMP
FROM "ShiftControlTemplate"
WHERE "department" = 'retail' AND "version" = 1;

INSERT INTO "ShiftControlTemplateTask" ("templateId", "title", "category", "sortOrder", "required", "plannedTimeMinutes", "updatedAt")
SELECT "id", 'Подготовить точку к закрытию смены', 'closing', 40, true, 540, CURRENT_TIMESTAMP
FROM "ShiftControlTemplate"
WHERE "department" = 'retail' AND "version" = 1;
