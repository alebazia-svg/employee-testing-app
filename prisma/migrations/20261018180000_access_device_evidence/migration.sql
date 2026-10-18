-- Additive diagnostics only. Do not backfill historical identity timestamps or guess owners.
ALTER TABLE "PortalAccessSession"
  ADD COLUMN "identityBoundAt" TIMESTAMP(3),
  ADD COLUMN "observedBrowserId" TEXT,
  ADD COLUMN "observedOrigin" VARCHAR(200),
  ADD COLUMN "deviceObservation" JSONB,
  ADD COLUMN "deviceCheckedAt" TIMESTAMP(3),
  ADD COLUMN "lastInteractionAt" TIMESTAMP(3);

-- Explicit administrator grouping only; equal labels/IPs never create a group.
ALTER TABLE "PortalAccessBrowserOwner" ADD COLUMN "deviceGroupId" TEXT;
