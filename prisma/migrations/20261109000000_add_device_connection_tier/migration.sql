-- Add connection_tier column to devices table for 3-tier FK623 status tracking
-- Tier values: "full" | "bridge" | "offline"
--   full    = bridge reachable + this specific FK623 device confirmed connected
--   bridge  = bridge reachable via WireGuard but FK623 not physically connected
--   offline = bridge not reachable (WireGuard down, tablet off, etc.)

ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "connection_tier" VARCHAR(10) DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Back-fill: devices with is_connected=true get "full", others get "offline"
UPDATE "devices"
SET connection_tier = CASE
  WHEN is_connected = true THEN 'full'
  ELSE 'offline'
END
WHERE connection_tier = 'offline' OR connection_tier IS NULL;

-- Index for fast filtering by tier
CREATE INDEX IF NOT EXISTS "devices_connection_tier_idx" ON "devices"("connection_tier");
CREATE INDEX IF NOT EXISTS "devices_last_seen_at_idx"    ON "devices"("last_seen_at");
CREATE INDEX IF NOT EXISTS "devices_is_active_idx"       ON "devices"("is_active");
