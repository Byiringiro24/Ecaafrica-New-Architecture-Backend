-- CreateTable
CREATE TABLE "school_levels" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_levels_school_id_label_key" ON "school_levels"("school_id", "label");

-- CreateIndex
CREATE INDEX "school_levels_school_id_idx" ON "school_levels"("school_id");

-- CreateIndex
CREATE INDEX "school_levels_sort_order_idx" ON "school_levels"("sort_order");

-- CreateIndex
CREATE INDEX "school_levels_created_at_idx" ON "school_levels"("created_at");

-- CreateIndex
CREATE INDEX "school_levels_deleted_at_idx" ON "school_levels"("deleted_at");

-- AddForeignKey
ALTER TABLE "school_levels"
ADD CONSTRAINT "school_levels_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;