-- CreateEnum
CREATE TYPE "TabletStatus" AS ENUM ('online', 'offline', 'error', 'maintenance');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "connection_error" TEXT,
ADD COLUMN     "device_logs_count" INTEGER DEFAULT 0,
ADD COLUMN     "device_serial" VARCHAR(100),
ADD COLUMN     "device_users_count" INTEGER DEFAULT 0,
ADD COLUMN     "is_connected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_connection_at" TIMESTAMP(3),
ADD COLUMN     "license_number" INTEGER,
ADD COLUMN     "product_code" VARCHAR(50),
ADD COLUMN     "product_name" VARCHAR(100),
ADD COLUMN     "tablet_id" BIGINT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "device_sync_status" VARCHAR(20),
ADD COLUMN     "device_user_id" VARCHAR(50),
ADD COLUMN     "last_device_sync" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tablets" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "uuid" UUID NOT NULL,
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

-- CreateIndex
CREATE INDEX "devices_tablet_id_idx" ON "devices"("tablet_id");

-- CreateIndex
CREATE INDEX "devices_is_connected_idx" ON "devices"("is_connected");

-- CreateIndex
CREATE INDEX "devices_last_connection_at_idx" ON "devices"("last_connection_at");

-- CreateIndex
CREATE INDEX "students_device_user_id_idx" ON "students"("device_user_id");

-- CreateIndex
CREATE INDEX "students_device_sync_status_idx" ON "students"("device_sync_status");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_tablet_id_fkey" FOREIGN KEY ("tablet_id") REFERENCES "tablets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tablets" ADD CONSTRAINT "tablets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
