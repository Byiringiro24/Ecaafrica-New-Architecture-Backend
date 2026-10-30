CREATE TABLE "attendance_sms_mappings" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "scope_key" VARCHAR(100) NOT NULL DEFAULT 'global',
    "template_id" BIGINT,
    "send_sms" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sms_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_sms_mappings_school_source_event_scope_key"
  ON "attendance_sms_mappings"("school_id", "source_type", "event_type", "scope_key");
CREATE INDEX "attendance_sms_mappings_school_id_idx"
  ON "attendance_sms_mappings"("school_id");
CREATE INDEX "attendance_sms_mappings_source_event_idx"
  ON "attendance_sms_mappings"("source_type", "event_type");
CREATE INDEX "attendance_sms_mappings_template_id_idx"
  ON "attendance_sms_mappings"("template_id");

ALTER TABLE "attendance_sms_mappings"
  ADD CONSTRAINT "attendance_sms_mappings_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_sms_mappings"
  ADD CONSTRAINT "attendance_sms_mappings_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Register the complete attendance SMS catalog as global, platform-owned templates.
-- School users only select these records; they cannot create or edit message text.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-school-entry-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'School entry SMS', 'attendance-school-entry-sms', 'school_entry', 'Education Care\nAttendance: ${student_name} has arrived at school at ${time}.\nDate: ${date}', '{"student_name":"","time":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-school-exit-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'School exit SMS', 'attendance-school-exit-sms', 'school_exit', 'Education Care\nAttendance: ${student_name} has left school at ${time}.\nDate: ${date}', '{"student_name":"","time":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-class-entry-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Class present SMS', 'attendance-class-entry-sms', 'class_entry', 'Education Care\nAttendance: ${student_name} is present in class at ${time}.\nDate: ${date}', '{"student_name":"","time":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-class-late-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Class late SMS', 'attendance-class-late-sms', 'class_late', 'Education Care\nAttendance: ${student_name} arrived late to class at ${time}.\nDate: ${date}', '{"student_name":"","time":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-class-absent-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Class absent SMS', 'attendance-class-absent-sms', 'class_absent', 'Education Care\nAttendance alert: ${student_name} was absent from class.\nDate: ${date}', '{"student_name":"","time":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-class-excused-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Class excused SMS', 'attendance-class-excused-sms', 'class_excused', 'Education Care\nAttendance: ${student_name} was excused from class.\nDate: ${date}', '{"student_name":"","time":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-dormitory-morning-present-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Dormitory morning present SMS', 'attendance-dormitory-morning-present-sms', 'dormitory_morning_present', 'Education Care\nBoarding attendance: ${student_name} was present during the morning dormitory roll call.\nDate: ${date}', '{"student_name":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-dormitory-morning-absent-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Dormitory morning absent SMS', 'attendance-dormitory-morning-absent-sms', 'dormitory_morning_absent', 'Education Care\nBoarding attendance alert: ${student_name} was absent from the morning dormitory roll call.\nDate: ${date}', '{"student_name":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-dormitory-morning-on-leave-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Dormitory morning on leave SMS', 'attendance-dormitory-morning-on-leave-sms', 'dormitory_morning_on_leave', 'Education Care\nBoarding attendance: ${student_name} was recorded on leave during the morning roll call.\nDate: ${date}', '{"student_name":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-dormitory-evening-present-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Dormitory evening present SMS', 'attendance-dormitory-evening-present-sms', 'dormitory_evening_present', 'Education Care\nBoarding attendance: ${student_name} was present during the evening dormitory roll call.\nDate: ${date}', '{"student_name":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-dormitory-evening-absent-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Dormitory evening absent SMS', 'attendance-dormitory-evening-absent-sms', 'dormitory_evening_absent', 'Education Care\nBoarding attendance alert: ${student_name} was absent from the evening dormitory roll call.\nDate: ${date}', '{"student_name":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-dormitory-evening-on-leave-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Dormitory evening on leave SMS', 'attendance-dormitory-evening-on-leave-sms', 'dormitory_evening_on_leave', 'Education Care\nBoarding attendance: ${student_name} was recorded on leave during the evening roll call.\nDate: ${date}', '{"student_name":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-device-late-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Attendance device late SMS', 'attendance-device-late-sms', 'device_late', 'Education Care\nAttendance alert: ${student_name} was recorded late at ${time}.\nDate: ${date}', '{"student_name":"","time":"","date":""}', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "notification_templates" WHERE "school_id" IS NULL AND "slug" = 'attendance-device-absent-sms') THEN
    INSERT INTO "notification_templates" ("school_id", "name", "slug", "trigger_type", "body_en", "variables", "is_active")
    VALUES (NULL, 'Attendance device absent SMS', 'attendance-device-absent-sms', 'device_absent', 'Education Care\nAttendance alert: ${student_name} was not recorded during the configured attendance window.\nDate: ${date}', '{"student_name":"","date":""}', true);
  END IF;
END $$;
