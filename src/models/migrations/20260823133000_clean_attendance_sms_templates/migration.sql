-- Clean legacy template content that was stored with literal \n sequences or
-- HTML entities. Keep every attendance message in one predictable format.
UPDATE "notification_templates"
SET "body_en" = replace(
  replace(replace(replace("body_en", E'\\n', E'\n'), '&#x20;', ' '), '&nbsp;', ' '),
  E'\\r', E'\n'
)
WHERE "trigger_type" IN (
  'school_entry', 'school_exit', 'class_entry', 'class_late', 'class_absent', 'class_excused',
  'dormitory_morning_present', 'dormitory_morning_absent', 'dormitory_morning_on_leave',
  'dormitory_evening_present', 'dormitory_evening_absent', 'dormitory_evening_on_leave',
  'device_late', 'device_absent'
);

UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance: Your child, ${student_name}, has arrived safely at school.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'school_entry';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance: Your child, ${student_name}, has left school safely.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'school_exit';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance: ${student_name} is present in class.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'class_entry';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance: ${student_name} arrived late to class.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'class_late';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance alert: ${student_name} was absent from class.\nDate: ${date}\nTime: ${time}\nPlease follow up with the school.' WHERE "trigger_type" = 'class_absent';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance: ${student_name} was excused from class.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'class_excused';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nBoarding attendance: ${student_name} was present during the morning dormitory roll call.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'dormitory_morning_present';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nBoarding attendance alert: ${student_name} was absent from the morning dormitory roll call.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'dormitory_morning_absent';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nBoarding attendance: ${student_name} was recorded on leave during the morning roll call.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'dormitory_morning_on_leave';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nBoarding attendance: ${student_name} was present during the evening dormitory roll call.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'dormitory_evening_present';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nBoarding attendance alert: ${student_name} was absent from the evening dormitory roll call.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'dormitory_evening_absent';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nBoarding attendance: ${student_name} was recorded on leave during the evening roll call.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'dormitory_evening_on_leave';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance alert: ${student_name} was recorded late.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'device_late';
UPDATE "notification_templates" SET "body_en" = E'Education Care\nAttendance alert: ${student_name} was not recorded during the configured attendance window.\nDate: ${date}\nTime: ${time}' WHERE "trigger_type" = 'device_absent';
