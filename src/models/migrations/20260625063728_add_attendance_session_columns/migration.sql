-- AlterTable
ALTER TABLE "gate_logs" ADD COLUMN     "attendance_status" "AttendanceStatus",
ADD COLUMN     "session_name" VARCHAR(100),
ADD COLUMN     "status_label" VARCHAR(100);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" BIGSERIAL NOT NULL,
    "device_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_windows" (
    "id" BIGSERIAL NOT NULL,
    "session_id" BIGINT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_sessions_school_id_idx" ON "device_sessions"("school_id");

-- CreateIndex
CREATE INDEX "device_sessions_device_id_idx" ON "device_sessions"("device_id");

-- CreateIndex
CREATE INDEX "device_sessions_created_at_idx" ON "device_sessions"("created_at");

-- CreateIndex
CREATE INDEX "device_sessions_deleted_at_idx" ON "device_sessions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_device_id_name_key" ON "device_sessions"("device_id", "name");

-- CreateIndex
CREATE INDEX "attendance_windows_session_id_idx" ON "attendance_windows"("session_id");

-- CreateIndex
CREATE INDEX "attendance_windows_created_at_idx" ON "attendance_windows"("created_at");

-- CreateIndex
CREATE INDEX "gate_logs_session_name_idx" ON "gate_logs"("session_name");

-- CreateIndex
CREATE INDEX "gate_logs_attendance_status_idx" ON "gate_logs"("attendance_status");

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_windows" ADD CONSTRAINT "attendance_windows_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "device_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
