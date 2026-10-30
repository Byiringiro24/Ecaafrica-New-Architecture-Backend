-- AlterTable - Add tablet integration fields to devices
ALTER TABLE "devices" 
    ADD COLUMN "tablet_id" BIGINT,
    ADD COLUMN "device_serial" VARCHAR(100),
    ADD COLUMN "product_name" VARCHAR(100),
    ADD COLUMN "product_code" VARCHAR(50),
    ADD COLUMN "license_number" INTEGER,
    ADD COLUMN "is_connected" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "last_connection_at" TIMESTAMP(3),
    ADD COLUMN "connection_error" TEXT,
    ADD COLUMN "device_users_count" INTEGER DEFAULT 0,
    ADD COLUMN "device_logs_count" INTEGER DEFAULT 0;

-- CreateIndex
CREATE INDEX "devices_tablet_id_idx" ON "devices"("tablet_id");

-- CreateIndex
CREATE INDEX "devices_is_connected_idx" ON "devices"("is_connected");

-- CreateIndex
CREATE INDEX "devices_last_connection_at_idx" ON "devices"("last_connection_at");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_tablet_id_fkey" FOREIGN KEY ("tablet_id") REFERENCES "tablets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
