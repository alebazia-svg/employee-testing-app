-- Explicit owner-browser classification; no access or subscription changes.
CREATE TABLE "PortalAccessBrowserOwner" (
  "browserInstanceId" TEXT NOT NULL PRIMARY KEY,
  "ownerUserId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMP(3)
);
CREATE INDEX "PortalAccessBrowserOwner_ownerUserId_idx" ON "PortalAccessBrowserOwner"("ownerUserId");
