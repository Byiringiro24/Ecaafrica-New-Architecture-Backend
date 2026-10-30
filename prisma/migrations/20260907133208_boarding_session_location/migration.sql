-- Add session_name and location_type to boarding_attendance_sessions
-- session_name: e.g. "Morning Roll Call", "Dinner Service", "Lights Out"
-- location_type: dormitory | dining_hall | library | other
-- created_by: user who opened the session (patron/matron)

ALTER TABLE "boarding_attendance_sessions"
  ADD COLUMN IF NOT EXISTS "session_name"   VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "location_type"  VARCHAR(50) DEFAULT 'dormitory',
  ADD COLUMN IF NOT EXISTS "created_by"     BIGINT;

-- Add FK to users for created_by
ALTER TABLE "boarding_attendance_sessions"
  ADD CONSTRAINT "boarding_att_sess_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;

-- Index for listing sessions by location_type
CREATE INDEX IF NOT EXISTS "boarding_att_sessions_location_type_idx"
  ON "boarding_attendance_sessions" ("school_id", "location_type");

-- Index for listing sessions by creator (patron/matron can see their own)
CREATE INDEX IF NOT EXISTS "boarding_att_sessions_created_by_idx"
  ON "boarding_attendance_sessions" ("created_by");

-- Add patron-visible device sessions (patron can manage device_sessions for their dorms)
-- No schema change needed — device_sessions.device_id links to devices.dormitory_id
-- This is enforced at the application layer
