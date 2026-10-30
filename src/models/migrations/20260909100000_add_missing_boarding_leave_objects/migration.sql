-- Restore boarding objects referenced by the current Prisma schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveState') THEN
    CREATE TYPE "LeaveState" AS ENUM (
      'draft', 'requested', 'pending_dod_approval', 'approved', 'rejected',
      'awaiting_physical_exit', 'outside_school', 'returned', 'closed', 'cancelled'
    );
  END IF;
END $$;

ALTER TABLE "student_leave_requests"
  ADD COLUMN IF NOT EXISTS "leave_state" "LeaveState" NOT NULL DEFAULT 'requested';

CREATE INDEX IF NOT EXISTS "student_leave_requests_leave_state_idx"
  ON "student_leave_requests"("leave_state");

CREATE TABLE IF NOT EXISTS "boarding_attendance_windows" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "dormitory_id" BIGINT REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "start_time" TIME NOT NULL,
  "end_time" TIME NOT NULL,
  "grace_minutes" SMALLINT NOT NULL DEFAULT 0,
  "escalation_mins" SMALLINT NOT NULL DEFAULT 60,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "applicable_days" VARCHAR(20) NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
  "created_by" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "boarding_att_windows_school_id_idx"
  ON "boarding_attendance_windows"("school_id");
CREATE INDEX IF NOT EXISTS "boarding_att_windows_dormitory_id_idx"
  ON "boarding_attendance_windows"("dormitory_id");
