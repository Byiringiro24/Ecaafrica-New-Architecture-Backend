-- AlterTable
ALTER TABLE "students" ADD COLUMN     "student_school_id" BIGINT;

-- Backfill school-scoped student numbers for existing rows so new inserts can continue from the latest value.
WITH numbered_students AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY school_id ORDER BY created_at, id) AS student_sequence
    FROM "students"
)
UPDATE "students" AS s
SET "student_school_id" = numbered_students.student_sequence,
    "student_id_number" = CASE
        WHEN s."student_id_number" IS NULL OR s."student_id_number" = ''
            THEN s."school_id"::text || numbered_students.student_sequence::text
        ELSE s."student_id_number"
    END
FROM numbered_students
WHERE s.id = numbered_students.id;

-- CreateIndex
CREATE INDEX "students_student_school_id_idx" ON "students"("student_school_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_school_id_student_school_id_key" ON "students"("school_id", "student_school_id");