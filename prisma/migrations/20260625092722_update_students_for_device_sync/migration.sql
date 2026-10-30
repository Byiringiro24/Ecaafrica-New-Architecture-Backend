-- AlterTable - Add device synchronization fields to students
ALTER TABLE "students"
    ADD COLUMN "device_user_id" VARCHAR(50),
    ADD COLUMN "last_device_sync" TIMESTAMP(3),
    ADD COLUMN "device_sync_status" VARCHAR(20);

-- CreateIndex
CREATE INDEX "students_device_user_id_idx" ON "students"("device_user_id");

-- CreateIndex
CREATE INDEX "students_device_sync_status_idx" ON "students"("device_sync_status");
