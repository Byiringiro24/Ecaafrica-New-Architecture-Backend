CREATE TABLE "subject_combinations" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(255),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "subject_combinations_school_id_code_key" UNIQUE ("school_id", "code")
);
CREATE INDEX "subject_combinations_school_id_idx" ON "subject_combinations"("school_id");
CREATE INDEX "subject_combinations_deleted_at_idx" ON "subject_combinations"("deleted_at");

CREATE TABLE "class_combinations" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "class_id" BIGINT NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "combination_id" BIGINT NOT NULL REFERENCES "subject_combinations"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_combinations_class_id_combination_id_key" UNIQUE ("class_id", "combination_id")
);
CREATE INDEX "class_combinations_school_id_idx" ON "class_combinations"("school_id");
CREATE INDEX "class_combinations_combination_id_idx" ON "class_combinations"("combination_id");

CREATE TABLE "combination_subjects" (
  "id" BIGSERIAL PRIMARY KEY,
  "school_id" BIGINT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "combination_id" BIGINT NOT NULL REFERENCES "subject_combinations"("id") ON DELETE CASCADE,
  "subject_id" BIGINT NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "combination_subjects_combination_id_subject_id_key" UNIQUE ("combination_id", "subject_id")
);
CREATE INDEX "combination_subjects_school_id_idx" ON "combination_subjects"("school_id");
CREATE INDEX "combination_subjects_subject_id_idx" ON "combination_subjects"("subject_id");
