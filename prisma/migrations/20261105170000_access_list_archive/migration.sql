-- Presentation only: never expires sessions or changes auth/push/ownership.
ALTER TABLE "PortalAccessSession" ADD COLUMN "listArchivedAt" TIMESTAMP(3);
