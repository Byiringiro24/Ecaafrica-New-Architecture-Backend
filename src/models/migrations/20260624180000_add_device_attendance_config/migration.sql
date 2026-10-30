-- Add attendance configuration persistence to devices
ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "attendance_config" JSONB;
