-- CreateEnum
CREATE TYPE "TabletStatus" AS ENUM ('online', 'offline', 'error', 'maintenance');

-- CreateTable
CREATE TABLE "tablets" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "ip" VARCHAR(50) NOT NULL,
    "port" SMALLINT NOT NULL DEFAULT 5000,
    "url" VARCHAR(255) NOT NULL,
    "status" "TabletStatus" NOT NULL DEFAULT 'offline',
    "last_health_check" TIMESTAMP(3),
    "health_check_interval" SMALLINT NOT NULL DEFAULT 60,
    "firmware_version" VARCHAR(50),
    "os_info" VARCHAR(100),
    "location" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tablets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tablets_uuid_key" ON "tablets"("uuid");

-- CreateIndex
CREATE INDEX "tablets_school_id_idx" ON "tablets"("school_id");

-- CreateIndex
CREATE INDEX "tablets_status_idx" ON "tablets"("status");

-- CreateIndex
CREATE INDEX "tablets_is_active_idx" ON "tablets"("is_active");

-- CreateIndex
CREATE INDEX "tablets_last_health_check_idx" ON "tablets"("last_health_check");

-- CreateIndex
CREATE INDEX "tablets_created_at_idx" ON "tablets"("created_at");

-- CreateIndex
CREATE INDEX "tablets_deleted_at_idx" ON "tablets"("deleted_at");

-- AddForeignKey
ALTER TABLE "tablets" ADD CONSTRAINT "tablets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
