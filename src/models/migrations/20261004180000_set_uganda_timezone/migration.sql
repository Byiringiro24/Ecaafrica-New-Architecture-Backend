-- Uganda schools use East Africa Time (UTC+03:00), with no daylight-saving change.
-- Update the legacy Rwanda default and existing legacy-default schools so new
-- attendance timestamps and school settings use the deployment's local time.
ALTER TABLE "schools"
  ALTER COLUMN "timezone" SET DEFAULT 'Africa/Kampala';

UPDATE "schools"
SET "timezone" = 'Africa/Kampala'
WHERE "timezone" = 'Africa/Kigali';
