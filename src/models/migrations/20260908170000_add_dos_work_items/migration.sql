CREATE TABLE "dos_work_items" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'open',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "student_id" BIGINT,
    "payload" JSONB NOT NULL,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dos_work_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dos_work_items_school_id_type_idx" ON "dos_work_items"("school_id", "type");
CREATE INDEX "dos_work_items_school_id_status_idx" ON "dos_work_items"("school_id", "status");
CREATE INDEX "dos_work_items_school_id_student_id_idx" ON "dos_work_items"("school_id", "student_id");
CREATE INDEX "dos_work_items_created_at_idx" ON "dos_work_items"("created_at");

ALTER TABLE "dos_work_items" ADD CONSTRAINT "dos_work_items_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
