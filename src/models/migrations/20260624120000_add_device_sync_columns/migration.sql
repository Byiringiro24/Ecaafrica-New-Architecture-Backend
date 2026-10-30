-- Add device sync metadata columns if they do not exist
ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "last_sync_status" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "last_sync_error" TEXT,
  ADD COLUMN IF NOT EXISTS "last_status_message" TEXT,
  ADD COLUMN IF NOT EXISTS "api_url" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "tablet_ip" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "tablet_port" SMALLINT,
  ADD COLUMN IF NOT EXISTS "firmware_version" VARCHAR(20);
