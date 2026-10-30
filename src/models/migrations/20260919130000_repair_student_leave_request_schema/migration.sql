-- Repair leave columns that may be missing on databases created before the
-- current boarding leave schema was fully deployed. Every operation is
-- idempotent so this is safe against partially migrated environments.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentLeaveRequestSource') THEN
    CREATE TYPE "StudentLeaveRequestSource" AS ENUM (
      'patron_matron', 'parent_app', 'parent_phone', 'parent_visit', 'dod'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveState') THEN
    CREATE TYPE "LeaveState" AS ENUM (
      'draft', 'requested', 'pending_dod_approval', 'approved', 'rejected',
      'awaiting_physical_exit', 'outside_school', 'returned', 'closed', 'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveCategory') THEN
    CREATE TYPE "LeaveCategory" AS ENUM (
      'short_leave', 'long_leave', 'medical_leave', 'emergency_leave'
    );
  END IF;
END $$;

ALTER TYPE "StudentLeaveRequestSource" ADD VALUE IF NOT EXISTS 'patron_matron';
ALTER TYPE "StudentLeaveRequestSource" ADD VALUE IF NOT EXISTS 'parent_app';
ALTER TYPE "StudentLeaveRequestSource" ADD VALUE IF NOT EXISTS 'parent_phone';
ALTER TYPE "StudentLeaveRequestSource" ADD VALUE IF NOT EXISTS 'parent_visit';
ALTER TYPE "StudentLeaveRequestSource" ADD VALUE IF NOT EXISTS 'dod';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'requested';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'pending_dod_approval';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'awaiting_physical_exit';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'outside_school';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE "LeaveState" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "LeaveCategory" ADD VALUE IF NOT EXISTS 'short_leave';
ALTER TYPE "LeaveCategory" ADD VALUE IF NOT EXISTS 'long_leave';
ALTER TYPE "LeaveCategory" ADD VALUE IF NOT EXISTS 'medical_leave';
ALTER TYPE "LeaveCategory" ADD VALUE IF NOT EXISTS 'emergency_leave';

ALTER TYPE "StudentLeaveType" ADD VALUE IF NOT EXISTS 'short_leave';
ALTER TYPE "StudentLeaveType" ADD VALUE IF NOT EXISTS 'long_leave';
ALTER TYPE "StudentLeaveType" ADD VALUE IF NOT EXISTS 'half_day';
ALTER TYPE "StudentLeaveType" ADD VALUE IF NOT EXISTS 'home_leave';

ALTER TABLE "student_leave_requests"
  ADD COLUMN IF NOT EXISTS "requested_by" BIGINT,
  ADD COLUMN IF NOT EXISTS "leave_state" "LeaveState" NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS "leave_category" "LeaveCategory" NOT NULL DEFAULT 'short_leave',
  ADD COLUMN IF NOT EXISTS "start_time" TIME,
  ADD COLUMN IF NOT EXISTS "expected_return_time" TIME,
  ADD COLUMN IF NOT EXISTS "expected_return_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "destination" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "parent_contact" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "clarification_note" TEXT,
  ADD COLUMN IF NOT EXISTS "source" "StudentLeaveRequestSource",
  ADD COLUMN IF NOT EXISTS "medical_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "supporting_doc_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "requested_by_role" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "gate_keeper_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "late_return_flagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "actual_duration_mins" INTEGER,
  ADD COLUMN IF NOT EXISTS "approved_duration_mins" INTEGER,
  ADD COLUMN IF NOT EXISTS "parent_notified_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "patron_notified_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "dod_notified_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "created_by" BIGINT;

CREATE INDEX IF NOT EXISTS "student_leave_requests_leave_state_idx"
  ON "student_leave_requests"("leave_state");
CREATE INDEX IF NOT EXISTS "student_leave_requests_leave_category_idx"
  ON "student_leave_requests"("leave_category");
