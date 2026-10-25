-- Additive audit context only. No business rows or historical events changed.
ALTER TABLE "PortalActivityEvent" ADD COLUMN "context" JSONB;
