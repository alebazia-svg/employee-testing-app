ALTER TABLE "WorkstationDeviceBinding"
    ADD COLUMN "provisioningExpiresAt" TIMESTAMP(3),
    ADD COLUMN "boundAt" TIMESTAMP(3);

-- Preserve compatibility if an older persistent binding exists during deploy.
UPDATE "WorkstationDeviceBinding"
SET "boundAt" = "createdAt"
WHERE "boundAt" IS NULL;

CREATE UNIQUE INDEX "WorkstationDeviceBinding_active_workstation_key"
    ON "WorkstationDeviceBinding"("workstationId")
    WHERE "isActive" = true AND "revokedAt" IS NULL;
