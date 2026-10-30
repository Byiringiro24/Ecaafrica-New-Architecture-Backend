-- Add is_active and activated_at to device_sessions
-- is_active = true means this session is currently "running" — all FK623 scans will be tagged to it
-- Only one session per device should be active at a time (enforced in application layer)

ALTER TABLE "device_sessions"
  ADD COLUMN IF NOT EXISTS "is_active"    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ;

-- Index for fast lookup of the active session per device
CREATE INDEX IF NOT EXISTS "idx_device_sessions_is_active"
  ON "device_sessions" ("device_id", "is_active")
  WHERE "is_active" = TRUE AND "deleted_at" IS NULL;
