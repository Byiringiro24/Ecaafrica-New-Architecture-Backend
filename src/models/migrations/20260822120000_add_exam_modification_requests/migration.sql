CREATE TYPE "ExamModificationRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "exam_modification_requests" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "exam_id" BIGINT NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "ExamModificationRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_modification_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_modification_requests_school_id_status_idx" ON "exam_modification_requests"("school_id", "status");
CREATE INDEX "exam_modification_requests_exam_id_idx" ON "exam_modification_requests"("exam_id");
CREATE UNIQUE INDEX "exam_modification_requests_exam_id_teacher_id_status_key" ON "exam_modification_requests"("exam_id", "teacher_id", "status");
ALTER TABLE "exam_modification_requests" ADD CONSTRAINT "exam_modification_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_modification_requests" ADD CONSTRAINT "exam_modification_requests_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_modification_requests" ADD CONSTRAINT "exam_modification_requests_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
