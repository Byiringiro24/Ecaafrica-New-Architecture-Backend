-- Director of Discipline replaces the former Boarding Officer role. Existing
-- accounts retain their access under the new operational role.
ALTER TYPE "UserRole" RENAME VALUE 'boarding_officer' TO 'director_of_discipline';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'patron';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'matron';

ALTER TYPE "StudentLeaveType" ADD VALUE IF NOT EXISTS 'short_leave';
ALTER TYPE "StudentLeaveType" ADD VALUE IF NOT EXISTS 'long_leave';
CREATE TYPE "StudentLeaveRequestSource" AS ENUM ('patron_matron', 'parent_app', 'parent_phone', 'parent_visit', 'dod');

ALTER TABLE "student_leave_requests"
  ADD COLUMN "source" "StudentLeaveRequestSource" NOT NULL DEFAULT 'dod',
  ADD COLUMN "requested_by" BIGINT,
  ADD COLUMN "destination" VARCHAR(255),
  ADD COLUMN "parent_contact" VARCHAR(50),
  ADD COLUMN "expected_return_at" TIMESTAMPTZ(3),
  ADD COLUMN "clarification_note" TEXT;

CREATE TABLE "dormitory_supervisor_assignments" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "dormitory_id" BIGINT NOT NULL REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "staff_profile_id" BIGINT NOT NULL REFERENCES "staff_profiles"("id") ON DELETE CASCADE,
  "assigned_by" BIGINT,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removed_at" TIMESTAMPTZ(3),
  CONSTRAINT "dormitory_supervisor_assignments_dormitory_id_staff_profile_id_key"
    UNIQUE ("dormitory_id", "staff_profile_id")
);
CREATE INDEX "dormitory_supervisor_assignments_school_id_idx" ON "dormitory_supervisor_assignments"("school_id");
CREATE INDEX "dormitory_supervisor_assignments_staff_profile_id_idx" ON "dormitory_supervisor_assignments"("staff_profile_id");
CREATE INDEX "dormitory_supervisor_assignments_removed_at_idx" ON "dormitory_supervisor_assignments"("removed_at");
