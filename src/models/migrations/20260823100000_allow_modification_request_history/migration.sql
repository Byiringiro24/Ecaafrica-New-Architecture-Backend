DROP INDEX IF EXISTS "exam_modification_requests_exam_id_teacher_id_status_key";

CREATE UNIQUE INDEX "exam_modification_requests_pending_key"
ON "exam_modification_requests"("exam_id", "teacher_id")
WHERE "status" = 'pending';
