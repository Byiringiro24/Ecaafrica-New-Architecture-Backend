-- =============================================================================
-- ESG (school_id = 1) — exams, marks and grades
-- =============================================================================
-- Run AFTER esg_test_data.sql.
--
--   psql "$DATABASE_URL" -f seeds/esg_grades.sql
--
-- Re-runnable: deletes exams named 'SEED %' (results cascade) then rebuilds.
-- Grades follow the app's own scale (exam-result.service.ts computeGrade):
--   >=80 A, >=70 B, >=60 C, >=50 D, else F.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schools
    WHERE id = 1 AND uuid = 'f53af939-7fa0-4b08-9a24-2b437ab7942b'
  ) THEN
    RAISE EXCEPTION 'school_id 1 is not ESG — aborting';
  END IF;
END $$;

DELETE FROM exams WHERE school_id = 1 AND name LIKE 'SEED %';

-- ---------------------------------------------------------------------------
-- 1. Exams — 6 core subjects x 3 sections x 2 assessments (CAT + main exam)
-- ---------------------------------------------------------------------------
-- The CAT is published, the main exam is left unpublished so the publish /
-- unpublish admin flow has something to act on.
INSERT INTO exams (
  school_id, section_id, subject_id, teacher_id, term_id,
  name, type, exam_date, start_time, duration_min,
  max_marks, pass_mark, status, published_by, published_at,
  created_at, updated_at
)
SELECT
  1,
  sec.id,
  sub.id,
  -- alternate the two seeded teachers (users 3 and 4)
  CASE WHEN sub.id % 2 = 0 THEN 3 ELSE 4 END,
  7,
  'SEED ' || a.label || ' - ' || sub.name || ' (' || sec.full_name || ')',
  a.kind::"ExamType",
  a.exam_date,
  time '08:30',
  a.duration,
  a.max_marks,
  a.max_marks / 2,
  'completed'::"ExamStatus",
  CASE WHEN a.published THEN 2 ELSE NULL END,
  CASE WHEN a.published THEN now() ELSE NULL END,
  now(), now()
FROM sections sec
CROSS JOIN LATERAL (
  SELECT id, name FROM subjects
  WHERE school_id = 1
    AND name IN ('Mathematics','English','Biology','Chemistry','Kinyarwanda','Physics')
) sub
CROSS JOIN (
  VALUES
    ('CAT 1',     'cat',       date '2026-03-10', 60,  30::numeric, true),
    ('Main Exam', 'main_exam', date '2026-05-18', 120, 100::numeric, false)
) AS a(label, kind, exam_date, duration, max_marks, published)
WHERE sec.school_id = 1 AND sec.id IN (1, 10, 11);

-- ---------------------------------------------------------------------------
-- 2. Results — one row per active enrolled student per exam
-- ---------------------------------------------------------------------------
-- Marks are deterministic (derived from student + subject id) so the same
-- student keeps a stable profile across subjects: some strong, some weak.
INSERT INTO exam_results (
  school_id, exam_id, student_id,
  marks_obtained, grade, grade_label, is_absent, remarks,
  entered_by, entered_at, published_at, created_at, updated_at
)
SELECT
  1,
  e.id,
  s.id,
  m.marks,
  CASE WHEN m.absent THEN NULL
       WHEN m.pct >= 80 THEN 'A'
       WHEN m.pct >= 70 THEN 'B'
       WHEN m.pct >= 60 THEN 'C'
       WHEN m.pct >= 50 THEN 'D'
       ELSE 'F' END,
  CASE WHEN m.absent THEN NULL
       WHEN m.pct >= 80 THEN 'Excellent'
       WHEN m.pct >= 70 THEN 'Very good'
       WHEN m.pct >= 60 THEN 'Good'
       WHEN m.pct >= 50 THEN 'Satisfactory'
       ELSE 'Needs improvement' END,
  m.absent,
  CASE WHEN m.absent THEN 'Absent - sick leave'
       WHEN m.pct >= 80 THEN 'Keep it up'
       WHEN m.pct < 50  THEN 'Must attend remedial sessions'
       ELSE NULL END,
  e.teacher_id,
  e.exam_date + interval '2 day',
  e.published_at,
  now(), now()
FROM exams e
JOIN student_section_enrollments se
  ON se.section_id = e.section_id
 AND se.school_id = 1
 AND se.status = 'active'
JOIN students s
  ON s.id = se.student_id
 AND s.status = 'active'
 AND s.student_id_number LIKE 'ESG/2026/%'
CROSS JOIN LATERAL (
  SELECT
    absent,
    CASE WHEN absent THEN NULL ELSE round(e.max_marks * pct / 100, 2) END AS marks,
    pct
  FROM (
    SELECT
      -- ~2% of entries absent, spread across students and subjects
      ((s.id * 7 + e.subject_id * 13 + e.id) % 47) = 0 AS absent,
      -- 30..95 percent. Two independent modulo streams are averaged so the
      -- spread is triangular rather than flat — a flat one puts as many
      -- learners in A as in F, which makes report cards look wrong.
      (30 + (((s.id * 17 + e.subject_id * 29) % 66)
           + ((s.id * 41 + e.subject_id * 11) % 66)) / 2)::numeric AS pct
  ) raw
) m
WHERE e.school_id = 1 AND e.name LIKE 'SEED %'
ON CONFLICT (exam_id, student_id) DO NOTHING;

COMMIT;
