-- Make the classroom attendance session natural key enforceable in the
-- migration directory used by src/models/schema.prisma.
--
-- Older deployments may already contain duplicate sessions because session
-- creation used to be a read-then-insert operation. Consolidate those rows
-- before creating the index so the migration is safe on existing databases.
-- The lowest session id is retained. If duplicate sessions contain the same
-- student, the record from the lowest session/record id is retained.

CREATE TEMP TABLE _attendance_session_natural_key_map ON COMMIT DROP AS
SELECT
  s.id AS duplicate_id,
  MIN(s.id) OVER (
    PARTITION BY
      s.school_id,
      s.section_id,
      s.session_date,
      s.session_type,
      COALESCE(s.period_id, 0),
      COALESCE(s.subject_id, 0),
      COALESCE(s.teacher_id, 0)
  ) AS keep_id
FROM attendance_sessions s;

WITH ranked_records AS (
  SELECT
    ar.id,
    ROW_NUMBER() OVER (
      PARTITION BY session_map.keep_id, ar.student_id
      ORDER BY ar.session_id, ar.id
    ) AS record_rank
  FROM attendance_records ar
  JOIN _attendance_session_natural_key_map session_map
    ON session_map.duplicate_id = ar.session_id
)
DELETE FROM attendance_records ar
USING ranked_records duplicate_record
WHERE ar.id = duplicate_record.id
  AND duplicate_record.record_rank > 1;

UPDATE attendance_records ar
SET session_id = session_map.keep_id
FROM _attendance_session_natural_key_map session_map
WHERE ar.session_id = session_map.duplicate_id
  AND session_map.duplicate_id <> session_map.keep_id;

DELETE FROM attendance_sessions s
USING _attendance_session_natural_key_map session_map
WHERE s.id = session_map.duplicate_id
  AND session_map.duplicate_id <> session_map.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_natural_key
ON attendance_sessions (
  school_id,
  section_id,
  session_date,
  session_type,
  COALESCE(period_id, 0),
  COALESCE(subject_id, 0),
  COALESCE(teacher_id, 0)
);
