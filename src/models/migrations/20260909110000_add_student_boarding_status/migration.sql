DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardingStatus') THEN
    CREATE TYPE "BoardingStatus" AS ENUM (
      'in_school', 'in_dormitory', 'on_short_leave', 'on_long_leave',
      'on_medical_leave', 'absent', 'returned', 'exit_pending',
      'exit_approved', 'outside_school'
    );
  END IF;
END $$;

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "boarding_status" "BoardingStatus" NOT NULL DEFAULT 'in_school';

CREATE INDEX IF NOT EXISTS "students_boarding_status_idx"
  ON "students"("boarding_status");
