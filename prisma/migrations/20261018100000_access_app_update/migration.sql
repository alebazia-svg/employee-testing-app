-- Additive diagnostics and one bounded, targeted command per authenticated connection.
-- No subscription, business row or existing access record is changed.
ALTER TABLE "PortalAccessSession"
  ADD COLUMN "appObservation" JSONB,
  ADD COLUMN "appCheckedAt" TIMESTAMP(3),
  ADD COLUMN "appUpdateCommand" JSONB;
ALTER TABLE "PortalAccessSession"
  ADD CONSTRAINT "PortalAccessSession_appObservation_object" CHECK ("appObservation" IS NULL OR (jsonb_typeof("appObservation") = 'object' AND octet_length("appObservation"::text) <= 2048)),
  ADD CONSTRAINT "PortalAccessSession_appUpdateCommand_object" CHECK ("appUpdateCommand" IS NULL OR (jsonb_typeof("appUpdateCommand") = 'object' AND octet_length("appUpdateCommand"::text) <= 2048));
