-- ============================================================
-- Boarding Management System — Full Schema Migration
-- Adds: BoardingStatus, LeaveState, DOD role, patron/matron
-- assignments, device→dormitory links, dining tables,
-- boarding attendance windows, gate exit records,
-- student photo_url, manual attendance corrections
-- ============================================================

-- ── 1. New ENUM types ────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardingStatus') THEN
    CREATE TYPE "BoardingStatus" AS ENUM (
      'in_school', 'in_dormitory', 'on_short_leave', 'on_long_leave',
      'on_medical_leave', 'absent', 'returned', 'exit_pending',
      'exit_approved', 'outside_school'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveState') THEN
    CREATE TYPE "LeaveState" AS ENUM (
      'draft', 'requested', 'pending_dod_approval', 'approved',
      'rejected', 'awaiting_physical_exit', 'outside_school',
      'returned', 'closed', 'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveCategory') THEN
    CREATE TYPE "LeaveCategory" AS ENUM (
      'short_leave', 'long_leave', 'medical_leave', 'emergency_leave'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiningMealType') THEN
    CREATE TYPE "DiningMealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiningScheduleScope') THEN
    CREATE TYPE "DiningScheduleScope" AS ENUM ('dormitory', 'room', 'class');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiningAttendanceStatus') THEN
    CREATE TYPE "DiningAttendanceStatus" AS ENUM ('present', 'absent', 'on_leave', 'excused');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceLocationScope') THEN
    CREATE TYPE "DeviceLocationScope" AS ENUM ('gate', 'dormitory', 'dining_hall', 'classroom', 'library', 'other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardingAttendanceStatus') THEN
    CREATE TYPE "BoardingAttendanceStatus" AS ENUM (
      'present', 'late', 'missing_attendance', 'on_approved_leave', 'manual_adjusted'
    );
  END IF;

  -- Add 'director_of_discipline' to UserRole enum if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'director_of_discipline'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'director_of_discipline';
  END IF;

  -- Add 'patron' to UserRole enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'patron'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'patron';
  END IF;

  -- Add 'matron' to UserRole enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'matron'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'matron';
  END IF;

  -- Extend StudentLeaveType with short_leave and long_leave categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'short_leave'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'StudentLeaveType')
  ) THEN
    ALTER TYPE "StudentLeaveType" ADD VALUE 'short_leave';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'long_leave'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'StudentLeaveType')
  ) THEN
    ALTER TYPE "StudentLeaveType" ADD VALUE 'long_leave';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'half_day'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'StudentLeaveType')
  ) THEN
    ALTER TYPE "StudentLeaveType" ADD VALUE 'half_day';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'home_leave'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'StudentLeaveType')
  ) THEN
    ALTER TYPE "StudentLeaveType" ADD VALUE 'home_leave';
  END IF;

END $$;

-- ── 2. Alter students — add boarding_status + photo_url ───────

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "boarding_status"  "BoardingStatus" DEFAULT 'in_school',
  ADD COLUMN IF NOT EXISTS "photo_url"        VARCHAR(500);

CREATE INDEX IF NOT EXISTS "students_boarding_status_idx" ON "students"("boarding_status");

-- ── 3. Alter devices — add dormitory/location assignment ──────

ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "location_scope"    "DeviceLocationScope" DEFAULT 'gate',
  ADD COLUMN IF NOT EXISTS "dormitory_id"      BIGINT REFERENCES "dormitories"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "location_label"    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "assigned_by"       BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "assigned_at"       TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "devices_dormitory_id_idx" ON "devices"("dormitory_id");
CREATE INDEX IF NOT EXISTS "devices_location_scope_idx" ON "devices"("location_scope");

-- ── 4. Alter dormitories — add block/hostel hierarchy ────────

ALTER TABLE "dormitories"
  ADD COLUMN IF NOT EXISTS "hostel_name"     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "block_name"      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "building"        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "floor"           SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_active"       BOOLEAN DEFAULT true;

-- ── 5. Alter dorm_rooms — add bed tracking ───────────────────

ALTER TABLE "dorm_rooms"
  ADD COLUMN IF NOT EXISTS "bed_count"       SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "floor"           SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_active"       BOOLEAN DEFAULT true;

-- ── 6. Patron/Matron dormitory assignments ───────────────────

CREATE TABLE IF NOT EXISTS "patron_dormitory_assignments" (
  "id"           BIGSERIAL PRIMARY KEY,
  "school_id"    BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "user_id"      BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "dormitory_id" BIGINT NOT NULL REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "assigned_by"  BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "patron_dorm_assignments_user_dorm_key" UNIQUE ("user_id", "dormitory_id")
);
CREATE INDEX IF NOT EXISTS "patron_dorm_assignments_school_id_idx"  ON "patron_dormitory_assignments"("school_id");
CREATE INDEX IF NOT EXISTS "patron_dorm_assignments_user_id_idx"    ON "patron_dormitory_assignments"("user_id");
CREATE INDEX IF NOT EXISTS "patron_dorm_assignments_dormitory_id_idx" ON "patron_dormitory_assignments"("dormitory_id");

-- ── 7. Enhanced student leave requests ───────────────────────

ALTER TABLE "student_leave_requests"
  ADD COLUMN IF NOT EXISTS "leave_state"           "LeaveState" DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS "leave_category"        "LeaveCategory" DEFAULT 'short_leave',
  ADD COLUMN IF NOT EXISTS "start_time"            TIME,
  ADD COLUMN IF NOT EXISTS "expected_return_time"  TIME,
  ADD COLUMN IF NOT EXISTS "destination"           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "requested_by_role"     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "created_by"            BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "supporting_doc_url"    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "parent_notified_at"    TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "gate_keeper_id"        BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "late_return_flagged"   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "actual_duration_mins"  INT,
  ADD COLUMN IF NOT EXISTS "approved_duration_mins" INT,
  ADD COLUMN IF NOT EXISTS "medical_notes"         TEXT,
  ADD COLUMN IF NOT EXISTS "patron_notified_at"    TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "dod_notified_at"       TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "student_leave_requests_leave_state_idx"    ON "student_leave_requests"("leave_state");
CREATE INDEX IF NOT EXISTS "student_leave_requests_leave_category_idx" ON "student_leave_requests"("leave_category");
CREATE INDEX IF NOT EXISTS "student_leave_requests_gate_keeper_id_idx" ON "student_leave_requests"("gate_keeper_id");

-- ── 8. Gate exit audit records ────────────────────────────────

CREATE TABLE IF NOT EXISTS "gate_exit_records" (
  "id"             BIGSERIAL PRIMARY KEY,
  "school_id"      BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "leave_id"       BIGINT NOT NULL REFERENCES "student_leave_requests"("id") ON DELETE CASCADE,
  "student_id"     BIGINT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "gate_keeper_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "exit_at"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "return_at"      TIMESTAMPTZ(3),
  "device_id"      VARCHAR(50),
  "notes"          TEXT,
  "created_at"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "gate_exit_records_school_id_idx"   ON "gate_exit_records"("school_id");
CREATE INDEX IF NOT EXISTS "gate_exit_records_leave_id_idx"    ON "gate_exit_records"("leave_id");
CREATE INDEX IF NOT EXISTS "gate_exit_records_student_id_idx"  ON "gate_exit_records"("student_id");
CREATE INDEX IF NOT EXISTS "gate_exit_records_exit_at_idx"     ON "gate_exit_records"("exit_at");

-- ── 9. Boarding attendance (dedicated, biometric-driven) ──────

CREATE TABLE IF NOT EXISTS "boarding_attendance_windows" (
  "id"              BIGSERIAL PRIMARY KEY,
  "school_id"       BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "dormitory_id"    BIGINT REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "name"            VARCHAR(100) NOT NULL,
  "start_time"      TIME NOT NULL,
  "end_time"        TIME NOT NULL,
  "grace_minutes"   SMALLINT DEFAULT 0,
  "escalation_mins" SMALLINT DEFAULT 60,
  "is_active"       BOOLEAN DEFAULT true,
  "applicable_days" VARCHAR(20) DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
  "created_by"      BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "boarding_att_windows_school_id_idx"    ON "boarding_attendance_windows"("school_id");
CREATE INDEX IF NOT EXISTS "boarding_att_windows_dormitory_id_idx" ON "boarding_attendance_windows"("dormitory_id");

CREATE TABLE IF NOT EXISTS "boarding_attendance_sessions" (
  "id"              BIGSERIAL PRIMARY KEY,
  "school_id"       BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "window_id"       BIGINT REFERENCES "boarding_attendance_windows"("id") ON DELETE SET NULL,
  "dormitory_id"    BIGINT REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "session_date"    DATE NOT NULL,
  "window_start"    TIMESTAMPTZ(3),
  "window_end"      TIMESTAMPTZ(3),
  "reconciled_at"   TIMESTAMPTZ(3),
  "total_expected"  INT DEFAULT 0,
  "total_present"   INT DEFAULT 0,
  "total_late"      INT DEFAULT 0,
  "total_on_leave"  INT DEFAULT 0,
  "total_missing"   INT DEFAULT 0,
  "notes"           TEXT,
  "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "boarding_att_sessions_school_id_idx"     ON "boarding_attendance_sessions"("school_id");
CREATE INDEX IF NOT EXISTS "boarding_att_sessions_dormitory_id_idx"  ON "boarding_attendance_sessions"("dormitory_id");
CREATE INDEX IF NOT EXISTS "boarding_att_sessions_session_date_idx"  ON "boarding_attendance_sessions"("session_date");
CREATE INDEX IF NOT EXISTS "boarding_att_sessions_reconciled_at_idx" ON "boarding_attendance_sessions"("reconciled_at");

CREATE TABLE IF NOT EXISTS "boarding_attendance_records" (
  "id"                  BIGSERIAL PRIMARY KEY,
  "school_id"           BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "session_id"          BIGINT NOT NULL REFERENCES "boarding_attendance_sessions"("id") ON DELETE CASCADE,
  "student_id"          BIGINT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "status"              "BoardingAttendanceStatus" NOT NULL DEFAULT 'missing_attendance',
  "scan_time"           TIMESTAMPTZ(3),
  "biometric_log_id"    BIGINT,
  "is_manual"           BOOLEAN DEFAULT false,
  "manual_reason"       TEXT,
  "corrected_by"        BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "corrected_at"        TIMESTAMPTZ(3),
  "original_status"     "BoardingAttendanceStatus",
  "parent_notified_at"  TIMESTAMPTZ(3),
  "escalated_at"        TIMESTAMPTZ(3),
  "notes"               TEXT,
  "created_at"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boarding_att_records_session_student_key" UNIQUE ("session_id", "student_id")
);
CREATE INDEX IF NOT EXISTS "boarding_att_records_school_id_idx"    ON "boarding_attendance_records"("school_id");
CREATE INDEX IF NOT EXISTS "boarding_att_records_session_id_idx"   ON "boarding_attendance_records"("session_id");
CREATE INDEX IF NOT EXISTS "boarding_att_records_student_id_idx"   ON "boarding_attendance_records"("student_id");
CREATE INDEX IF NOT EXISTS "boarding_att_records_status_idx"       ON "boarding_attendance_records"("status");
CREATE INDEX IF NOT EXISTS "boarding_att_records_scan_time_idx"    ON "boarding_attendance_records"("scan_time");
CREATE INDEX IF NOT EXISTS "boarding_att_records_escalated_at_idx" ON "boarding_attendance_records"("escalated_at");

-- ── 10. Dining management ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "dining_menus" (
  "id"           BIGSERIAL PRIMARY KEY,
  "school_id"    BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "name"         VARCHAR(100) NOT NULL,
  "menu_type"    VARCHAR(20) NOT NULL DEFAULT 'weekly',
  "start_date"   DATE,
  "end_date"     DATE,
  "is_active"    BOOLEAN DEFAULT true,
  "created_by"   BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "dining_menus_school_id_idx"  ON "dining_menus"("school_id");
CREATE INDEX IF NOT EXISTS "dining_menus_start_date_idx" ON "dining_menus"("start_date");

CREATE TABLE IF NOT EXISTS "dining_menu_items" (
  "id"          BIGSERIAL PRIMARY KEY,
  "menu_id"     BIGINT NOT NULL REFERENCES "dining_menus"("id") ON DELETE CASCADE,
  "school_id"   BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "day_of_week" SMALLINT NOT NULL,
  "meal_type"   "DiningMealType" NOT NULL,
  "items"       TEXT NOT NULL,
  "notes"       TEXT,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "dining_menu_items_menu_id_idx" ON "dining_menu_items"("menu_id");

CREATE TABLE IF NOT EXISTS "dining_schedules" (
  "id"            BIGSERIAL PRIMARY KEY,
  "school_id"     BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "scope"         "DiningScheduleScope" NOT NULL DEFAULT 'dormitory',
  "dormitory_id"  BIGINT REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "room_id"       BIGINT REFERENCES "dorm_rooms"("id") ON DELETE CASCADE,
  "class_id"      BIGINT REFERENCES "classes"("id") ON DELETE CASCADE,
  "meal_type"     "DiningMealType" NOT NULL,
  "start_time"    TIME NOT NULL,
  "end_time"      TIME NOT NULL,
  "applicable_days" VARCHAR(20) DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
  "is_active"     BOOLEAN DEFAULT true,
  "created_by"    BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "dining_schedules_school_id_idx"   ON "dining_schedules"("school_id");
CREATE INDEX IF NOT EXISTS "dining_schedules_dormitory_id_idx" ON "dining_schedules"("dormitory_id");
CREATE INDEX IF NOT EXISTS "dining_schedules_meal_type_idx"   ON "dining_schedules"("meal_type");

CREATE TABLE IF NOT EXISTS "dining_sessions" (
  "id"           BIGSERIAL PRIMARY KEY,
  "school_id"    BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "schedule_id"  BIGINT REFERENCES "dining_schedules"("id") ON DELETE SET NULL,
  "dormitory_id" BIGINT REFERENCES "dormitories"("id") ON DELETE CASCADE,
  "meal_type"    "DiningMealType" NOT NULL,
  "session_date" DATE NOT NULL,
  "opened_at"    TIMESTAMPTZ(3),
  "closed_at"    TIMESTAMPTZ(3),
  "marked_by"    BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "notes"        TEXT,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "dining_sessions_school_id_idx"    ON "dining_sessions"("school_id");
CREATE INDEX IF NOT EXISTS "dining_sessions_dormitory_id_idx" ON "dining_sessions"("dormitory_id");
CREATE INDEX IF NOT EXISTS "dining_sessions_session_date_idx" ON "dining_sessions"("session_date");
CREATE INDEX IF NOT EXISTS "dining_sessions_meal_type_idx"    ON "dining_sessions"("meal_type");

CREATE TABLE IF NOT EXISTS "dining_attendance" (
  "id"            BIGSERIAL PRIMARY KEY,
  "school_id"     BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "session_id"    BIGINT NOT NULL REFERENCES "dining_sessions"("id") ON DELETE CASCADE,
  "student_id"    BIGINT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "status"        "DiningAttendanceStatus" NOT NULL DEFAULT 'absent',
  "marked_by"     BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "marked_at"     TIMESTAMPTZ(3),
  "leave_status"  VARCHAR(50),
  "notes"         VARCHAR(255),
  "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dining_attendance_session_student_key" UNIQUE ("session_id", "student_id")
);
CREATE INDEX IF NOT EXISTS "dining_attendance_school_id_idx"  ON "dining_attendance"("school_id");
CREATE INDEX IF NOT EXISTS "dining_attendance_session_id_idx" ON "dining_attendance"("session_id");
CREATE INDEX IF NOT EXISTS "dining_attendance_student_id_idx" ON "dining_attendance"("student_id");
CREATE INDEX IF NOT EXISTS "dining_attendance_status_idx"     ON "dining_attendance"("status");

-- ── 11. Boarding configuration per school ────────────────────

CREATE TABLE IF NOT EXISTS "boarding_configurations" (
  "id"                         BIGSERIAL PRIMARY KEY,
  "school_id"                  BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "require_student_photo"      BOOLEAN DEFAULT true,
  "require_biometric_return"   BOOLEAN DEFAULT true,
  "require_gate_exit_confirm"  BOOLEAN DEFAULT true,
  "parent_escalation_mins"     SMALLINT DEFAULT 60,
  "late_return_threshold_mins" SMALLINT DEFAULT 15,
  "max_short_leave_hours"      SMALLINT DEFAULT 8,
  "max_long_leave_days"        SMALLINT DEFAULT 14,
  "sms_on_leave_approval"      BOOLEAN DEFAULT true,
  "sms_on_long_leave"          BOOLEAN DEFAULT true,
  "sms_on_medical_leave"       BOOLEAN DEFAULT true,
  "sms_on_missing_attendance"  BOOLEAN DEFAULT true,
  "sms_on_late_return"         BOOLEAN DEFAULT true,
  "created_at"                 TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                 TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boarding_configurations_school_id_key" UNIQUE ("school_id")
);

-- ── 12. Boarding alerts enhancement ──────────────────────────

ALTER TABLE "absence_alerts"
  ADD COLUMN IF NOT EXISTS "dormitory_id"        BIGINT REFERENCES "dormitories"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "boarding_session_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "escalation_sent_at"  TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "parent_sms_sent_at"  TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "patron_notified_at"  TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "dod_notified_at"     TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "absence_alerts_dormitory_id_idx" ON "absence_alerts"("dormitory_id");
