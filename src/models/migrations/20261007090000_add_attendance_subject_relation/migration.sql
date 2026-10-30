-- Preserve the subject associated with each classroom attendance session.
ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
