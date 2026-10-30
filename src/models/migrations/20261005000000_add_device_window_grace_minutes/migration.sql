ALTER TABLE "attendance_windows"
  ADD COLUMN IF NOT EXISTS "grace_minutes" SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "attendance_windows_grace_minutes_idx"
  ON "attendance_windows"("grace_minutes");
