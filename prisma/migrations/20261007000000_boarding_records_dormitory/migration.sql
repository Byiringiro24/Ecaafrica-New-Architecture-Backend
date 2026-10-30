-- Add dormitory linkage to boarding attendance records so the runtime schema matches the Prisma model.

ALTER TABLE "boarding_attendance_records"
  ADD COLUMN IF NOT EXISTS "dormitory_id" BIGINT;

ALTER TABLE "boarding_attendance_records"
  ADD CONSTRAINT "boarding_attendance_records_dormitory_id_fkey"
    FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "boarding_attendance_records_dormitory_id_idx"
  ON "boarding_attendance_records" ("dormitory_id");
