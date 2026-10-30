-- Add dev_password to tablets
-- Allows super admin to set a custom developer/WireGuard password for each tablet remotely.
-- The tablet bridge polls /tablets/:uuid/dev-password and applies it to its in-memory DEV_PASSWORD.

ALTER TABLE "tablets"
  ADD COLUMN IF NOT EXISTS "dev_password"        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "dev_password_set_at" TIMESTAMPTZ(3);
