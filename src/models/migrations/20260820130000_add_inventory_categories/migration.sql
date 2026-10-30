CREATE TABLE "inventory_categories" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_categories_school_id_name_key" ON "inventory_categories"("school_id", "name");
CREATE INDEX "inventory_categories_school_id_idx" ON "inventory_categories"("school_id");
CREATE INDEX "inventory_categories_is_active_idx" ON "inventory_categories"("is_active");

ALTER TABLE "inventory_categories"
ADD CONSTRAINT "inventory_categories_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
