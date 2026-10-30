CREATE TABLE "exam_types" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grading_roles" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "min_percentage" DECIMAL(5,2) NOT NULL,
    "max_percentage" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grading_roles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "exams" ADD COLUMN "exam_type_id" BIGINT;

CREATE UNIQUE INDEX "exam_types_school_id_name_key" ON "exam_types"("school_id", "name");
CREATE INDEX "exam_types_school_id_idx" ON "exam_types"("school_id");
CREATE INDEX "exam_types_is_active_idx" ON "exam_types"("is_active");
CREATE UNIQUE INDEX "grading_roles_school_id_code_key" ON "grading_roles"("school_id", "code");
CREATE INDEX "grading_roles_school_id_idx" ON "grading_roles"("school_id");
CREATE INDEX "grading_roles_is_active_idx" ON "grading_roles"("is_active");
CREATE INDEX "grading_roles_min_percentage_idx" ON "grading_roles"("min_percentage");
CREATE INDEX "exams_exam_type_id_idx" ON "exams"("exam_type_id");

ALTER TABLE "exam_types" ADD CONSTRAINT "exam_types_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grading_roles" ADD CONSTRAINT "grading_roles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_exam_type_id_fkey" FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
