ALTER TABLE "dining_sessions" ADD COLUMN IF NOT EXISTS "gender_group" VARCHAR(20);

CREATE TABLE IF NOT EXISTS "dining_teacher_assignments" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "teacher_id" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "gender_group" VARCHAR(20) NOT NULL CHECK ("gender_group" IN ('boys', 'girls')),
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "assigned_by" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dining_teacher_assignments_unique" UNIQUE ("school_id", "teacher_id", "gender_group", "start_date", "end_date")
);
CREATE INDEX IF NOT EXISTS "dining_teacher_assignments_scope_idx" ON "dining_teacher_assignments" ("school_id", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "dining_teacher_assignments_teacher_idx" ON "dining_teacher_assignments" ("teacher_id", "start_date", "end_date");
