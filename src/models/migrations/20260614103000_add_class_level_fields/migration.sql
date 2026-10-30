-- AlterTable
ALTER TABLE "classes"
ADD COLUMN "level_id" BIGINT,
ADD COLUMN "level_label" VARCHAR(100);

-- CreateIndex
CREATE INDEX "classes_level_id_idx" ON "classes"("level_id");

-- AddForeignKey
ALTER TABLE "classes"
ADD CONSTRAINT "classes_level_id_fkey"
FOREIGN KEY ("level_id") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;