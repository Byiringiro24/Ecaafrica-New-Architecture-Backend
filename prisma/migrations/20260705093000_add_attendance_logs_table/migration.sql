-- Create or extend the dedicated device attendance log table.
CREATE TABLE IF NOT EXISTS "attendance_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL,
  "log_id" TEXT,
  "user_id" TEXT,
  "student_id" TEXT,
  "student_device_id" TEXT,
  "student_name" TEXT,
  "class_name" TEXT,
  "section" TEXT,
  "device_id" TEXT,
  "authentication_method" TEXT,
  "direction" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "status" TEXT,
  "attendance_period" TEXT,
  "raw_data" JSONB,
  "sync_state" VARCHAR(20) NOT NULL DEFAULT 'synced',
  "is_flagged" BOOLEAN NOT NULL DEFAULT FALSE,
  "flag_reason" VARCHAR(255),
  "synced_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS "attendance_logs"
  ADD COLUMN IF NOT EXISTS "school_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "log_id" TEXT,
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "student_id" TEXT,
  ADD COLUMN IF NOT EXISTS "student_device_id" TEXT,
  ADD COLUMN IF NOT EXISTS "student_name" TEXT,
  ADD COLUMN IF NOT EXISTS "class_name" TEXT,
  ADD COLUMN IF NOT EXISTS "section" TEXT,
  ADD COLUMN IF NOT EXISTS "device_id" TEXT,
  ADD COLUMN IF NOT EXISTS "authentication_method" TEXT,
  ADD COLUMN IF NOT EXISTS "direction" TEXT,
  ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "attendance_period" TEXT,
  ADD COLUMN IF NOT EXISTS "raw_data" JSONB,
  ADD COLUMN IF NOT EXISTS "sync_state" VARCHAR(20) NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS "is_flagged" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "flag_reason" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_logs_log_id_device_id_key"
  ON "attendance_logs" ("log_id", "device_id");

CREATE INDEX IF NOT EXISTS "idx_attendance_logs_school_timestamp"
  ON "attendance_logs" ("school_id", "timestamp");

CREATE INDEX IF NOT EXISTS "idx_attendance_logs_student_device_id"
  ON "attendance_logs" ("student_device_id");

CREATE INDEX IF NOT EXISTS "idx_attendance_logs_class_section"
  ON "attendance_logs" ("class_name", "section");

CREATE INDEX IF NOT EXISTS "idx_attendance_logs_device_id"
  ON "attendance_logs" ("device_id");

CREATE INDEX IF NOT EXISTS "idx_attendance_logs_created_at"
  ON "attendance_logs" ("created_at");

-- Backfill device-generated attendance rows into the dedicated table.
INSERT INTO "attendance_logs" (
  "school_id",
  "log_id",
  "user_id",
  "student_id",
  "student_device_id",
  "student_name",
  "class_name",
  "section",
  "device_id",
  "authentication_method",
  "direction",
  "timestamp",
  "status",
  "attendance_period",
  "raw_data",
  "sync_state",
  "is_flagged",
  "flag_reason",
  "synced_at",
  "created_at"
)
SELECT
  ar."school_id",
  ar."id"::text AS "log_id",
  ar."marked_by"::text AS "user_id",
  COALESCE(st."student_id_number"::text, ar."student_id"::text) AS "student_id",
  COALESCE(st."device_user_id"::text, st."student_id_number"::text, ar."student_id"::text) AS "student_device_id",
  COALESCE(st."first_name" || ' ' || st."last_name", 'Unknown') AS "student_name",
  cls."name" AS "class_name",
  sec."name" AS "section",
  'legacy-attendance-records' AS "device_id",
  ar."scan_method"::text AS "authentication_method",
  'entry' AS "direction",
  COALESCE(ar."scanned_at", ar."created_at") AS "timestamp",
  ar."status"::text AS "status",
  COALESCE(ar."notes", sess."session_type"::text) AS "attendance_period",
  jsonb_build_object(
    'attendance_record_id', ar."id"::text,
    'session_id', ar."session_id"::text,
    'student_id', ar."student_id"::text,
    'status', ar."status"::text,
    'scan_method', ar."scan_method"::text,
    'scanned_at', COALESCE(ar."scanned_at", ar."created_at"),
    'notes', ar."notes",
    'created_at', ar."created_at",
    'updated_at', ar."updated_at"
  ) AS "raw_data",
  'synced' AS "sync_state",
  FALSE AS "is_flagged",
  NULL::varchar(255) AS "flag_reason",
  COALESCE(ar."scanned_at", ar."updated_at", ar."created_at") AS "synced_at",
  ar."created_at"
FROM "attendance_records" ar
JOIN "attendance_sessions" sess ON sess."id" = ar."session_id"
LEFT JOIN "students" st ON st."id" = ar."student_id"
LEFT JOIN "sections" sec ON sec."id" = sess."section_id"
LEFT JOIN "classes" cls ON cls."id" = sec."class_id"
WHERE ar."scan_method" <> 'manual'
  AND NOT EXISTS (
    SELECT 1
    FROM "attendance_logs" al
    WHERE al."log_id" = ar."id"::text
      AND al."device_id" = 'legacy-attendance-records'
  );

-- Remove device-generated rows from manual attendance so manual and device logs are separated.
DELETE FROM "attendance_records"
WHERE "scan_method" <> 'manual';
