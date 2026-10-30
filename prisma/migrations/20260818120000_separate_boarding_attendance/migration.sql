-- Boarding attendance is intentionally stored separately from classroom
-- attendance.  The IF NOT EXISTS guards keep this migration safe for schools
-- that already received these tables through an earlier deployment.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardingSessionType') THEN
    CREATE TYPE "BoardingSessionType" AS ENUM ('morning', 'evening');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardingRollStatus') THEN
    CREATE TYPE "BoardingRollStatus" AS ENUM ('present', 'absent', 'on_leave');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "boarding_roll_calls" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "dormitory_id" BIGINT NOT NULL REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "roll_date" DATE NOT NULL,
  "session_type" "BoardingSessionType" NOT NULL,
  "conducted_by" BIGINT REFERENCES "staff_profiles"("id"),
  "submitted_at" TIMESTAMPTZ(3),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boarding_roll_calls_dormitory_id_roll_date_session_type_key"
    UNIQUE ("dormitory_id", "roll_date", "session_type")
);

CREATE TABLE IF NOT EXISTS "boarding_roll_call_records" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "roll_call_id" BIGINT NOT NULL REFERENCES "boarding_roll_calls"("id") ON DELETE CASCADE,
  "student_id" BIGINT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "status" "BoardingRollStatus" NOT NULL DEFAULT 'present',
  "notes" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boarding_roll_call_records_roll_call_id_student_id_key"
    UNIQUE ("roll_call_id", "student_id")
);

CREATE INDEX IF NOT EXISTS "boarding_roll_calls_school_id_idx" ON "boarding_roll_calls"("school_id");
CREATE INDEX IF NOT EXISTS "boarding_roll_calls_roll_date_idx" ON "boarding_roll_calls"("roll_date");
CREATE INDEX IF NOT EXISTS "boarding_roll_call_records_school_id_idx" ON "boarding_roll_call_records"("school_id");
CREATE INDEX IF NOT EXISTS "boarding_roll_call_records_created_at_idx" ON "boarding_roll_call_records"("created_at");
