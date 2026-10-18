ALTER TABLE "PortalAccessBrowserOwner" ADD COLUMN "label" VARCHAR(80);
ALTER TABLE "PortalAccessSession" ADD COLUMN "lastIp" VARCHAR(45), ADD COLUMN "ipCheckedAt" TIMESTAMP(3);
