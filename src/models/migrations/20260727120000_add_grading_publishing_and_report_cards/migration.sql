-- AlterTable
ALTER TABLE "exams" ADD COLUMN "published_by" BIGINT;
ALTER TABLE "exams" ADD COLUMN "published_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "exams_published_at_idx" ON "exams"("published_at");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "report_cards" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "term_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "prepared_by" BIGINT,
    "issued_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_cards_school_id_idx" ON "report_cards"("school_id");

-- CreateIndex
CREATE INDEX "report_cards_term_id_idx" ON "report_cards"("term_id");

-- CreateIndex
CREATE INDEX "report_cards_issued_on_idx" ON "report_cards"("issued_on");

-- CreateIndex
CREATE INDEX "report_cards_created_at_idx" ON "report_cards"("created_at");

-- CreateIndex
CREATE INDEX "report_cards_deleted_at_idx" ON "report_cards"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_cards_student_id_term_id_key" ON "report_cards"("student_id", "term_id");

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
