-- AlterTable
ALTER TABLE "device_sessions" ADD COLUMN "send_sms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notification_template_id" BIGINT;

-- CreateIndex
CREATE INDEX "device_sessions_notification_template_id_idx" ON "device_sessions"("notification_template_id");

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_notification_template_id_fkey" FOREIGN KEY ("notification_template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
