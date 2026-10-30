-- =============================================================================
-- ESG (school_id = 1, uuid f53af939-7fa0-4b08-9a24-2b437ab7942b) test dataset
-- =============================================================================
-- Rwandan students, grades/subjects and finance records for manual testing.
--
--   psql "$DATABASE_URL" -f seeds/esg_test_data.sql
--
-- Re-runnable: every row it creates is tagged (student_id_number 'ESG/2026/%',
-- exam names 'SEED %', references 'SEED-%'), and the script deletes its own
-- tagged rows before inserting. Pre-existing data (students 1 and 17, the two
-- original fee structures, EXP-2026-0001) is never touched.
-- =============================================================================

BEGIN;

-- Fail loudly if pointed at a database where ESG is not school 1.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schools
    WHERE id = 1 AND uuid = 'f53af939-7fa0-4b08-9a24-2b437ab7942b'
  ) THEN
    RAISE EXCEPTION 'school_id 1 is not ESG (f53af939-7fa0-4b08-9a24-2b437ab7942b) — aborting';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 0. Clear previously seeded rows (children cascade from students/exams)
-- ---------------------------------------------------------------------------
DELETE FROM payslips        WHERE school_id = 1 AND reference LIKE 'SEED-%';
DELETE FROM payroll_runs    WHERE school_id = 1 AND notes = 'SEED payroll';
DELETE FROM inventory_items WHERE school_id = 1 AND code LIKE 'SEED-%';
DELETE FROM suppliers       WHERE school_id = 1 AND code LIKE 'SEED-%';
DELETE FROM expenses        WHERE school_id = 1 AND reference LIKE 'SEED-%';
DELETE FROM student_invoices WHERE school_id = 1 AND invoice_number LIKE 'SEED-%';
DELETE FROM exams           WHERE school_id = 1 AND name LIKE 'SEED %';
DELETE FROM students        WHERE school_id = 1 AND student_id_number LIKE 'ESG/2026/%';
DELETE FROM fee_structures  WHERE school_id = 1 AND name LIKE 'SEED %';
DELETE FROM parents_guardians WHERE school_id = 1 AND national_id LIKE 'SEED%';

-- ---------------------------------------------------------------------------
-- 1. Subjects — Rwandan O-level curriculum (5 already exist)
-- ---------------------------------------------------------------------------
INSERT INTO subjects (school_id, name, code, description, created_at)
VALUES
  (1, 'Kinyarwanda',      'KIN', 'Kinyarwanda language and literature', now()),
  (1, 'Physics',          'PHY', 'Physics',                             now()),
  (1, 'Geography',        'GEO', 'Geography and environment',           now()),
  (1, 'Entrepreneurship', 'ENT', 'Entrepreneurship',                    now()),
  (1, 'ICT',              'ICT', 'Information and communication tech',  now()),
  (1, 'Kiswahili',        'KIS', 'Kiswahili language',                  now())
ON CONFLICT (school_id, name) DO NOTHING;

-- Backfill codes on the 5 pre-existing subjects so reports have short labels.
UPDATE subjects SET code = 'MAT' WHERE school_id = 1 AND name = 'Mathematics' AND code IS NULL;
UPDATE subjects SET code = 'ENG' WHERE school_id = 1 AND name = 'English'     AND code IS NULL;
UPDATE subjects SET code = 'BIO' WHERE school_id = 1 AND name = 'Biology'     AND code IS NULL;
UPDATE subjects SET code = 'CHE' WHERE school_id = 1 AND name = 'Chemistry'   AND code IS NULL;
UPDATE subjects SET code = 'HIS' WHERE school_id = 1 AND name = 'History'     AND code IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Students — 40 Rwandan learners across S1 A, S1 B, S2 A
-- ---------------------------------------------------------------------------
-- Section split: rn 1-15 -> S1 A (id 1), 16-28 -> S1 B (id 10), 29-40 -> S2 A (id 11)
-- student_school_id 100-139 keeps clear of the existing 1 and 2.
WITH names(rn, first_name, last_name, gender) AS (
  VALUES
    ( 1, 'Aline',     'Uwase',          'female'), ( 2, 'Eric',      'Mugisha',        'male'),
    ( 3, 'Divine',    'Iradukunda',     'female'), ( 4, 'Patrick',   'Niyonshuti',     'male'),
    ( 5, 'Claudine',  'Uwimana',        'female'), ( 6, 'Jean Paul', 'Habimana',       'male'),
    ( 7, 'Olivier',   'Nshimiyimana',   'male'),   ( 8, 'Josiane',   'Mukamana',       'female'),
    ( 9, 'Kevin',     'Ishimwe',        'male'),   (10, 'Sandrine',  'Byiringiro',     'female'),
    (11, 'Ange',      'Umutoni',        'female'), (12, 'Emmanuel',  'Gatete',         'male'),
    (13, 'Peace',     'Keza',           'female'), (14, 'Fabrice',   'Munyaneza',      'male'),
    (15, 'Chantal',   'Uwera',          'female'), (16, 'Yves',      'Rwigema',        'male'),
    (17, 'Nadine',    'Mutesi',         'female'), (18, 'Thierry',   'Nkurunziza',     'male'),
    (19, 'Ineza',     'Mukandayisenga', 'female'), (20, 'Alexis',    'Bizimana',       'male'),
    (21, 'Solange',   'Uwamahoro',      'female'), (22, 'Innocent',  'Hakizimana',     'male'),
    (23, 'Aurore',    'Umuhoza',        'female'), (24, 'Samuel',    'Ndayisaba',      'male'),
    (25, 'Teta',      'Iribagiza',      'female'), (26, 'Bruno',     'Ntwari',         'male'),
    (27, 'Gloria',    'Mukashema',      'female'), (28, 'Didier',    'Gasana',         'male'),
    (29, 'Kwizera',   'Muhirwa',        'male'),   (30, 'Shema',     'Rugamba',        'male'),
    (31, 'Liliane',   'Nyiransabimana', 'female'), (32, 'Manzi',     'Cyusa',          'male'),
    (33, 'Ganza',     'Rwema',          'male'),   (34, 'Mahoro',    'Uwineza',        'female'),
    (35, 'Doreen',    'Rukundo',        'female'), (36, 'Isimbi',    'Kalisa',         'female'),
    (37, 'Muhire',    'Nsengiyumva',    'male'),   (38, 'Josephine', 'Nyirahabimana',  'female'),
    (39, 'Christian', 'Uwitonze',       'male'),   (40, 'Belise',    'Rugero',         'female')
)
INSERT INTO students (
  uuid, school_id, student_school_id, student_id_number,
  first_name, last_name, date_of_birth, gender, nationality, national_id,
  address, admission_date, student_type, status, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  1,
  99 + rn,
  'ESG/2026/' || lpad(rn::text, 3, '0'),
  first_name,
  last_name,
  -- S1 cohort born 2011, S2 cohort born 2010
  (CASE WHEN rn <= 28 THEN date '2011-01-05' ELSE date '2010-01-05' END
     + ((rn * 9) % 330) * interval '1 day')::date,
  gender::"Gender",
  'Rwandan',
  '1' || (CASE WHEN rn <= 28 THEN '2011' ELSE '2010' END) || lpad((rn * 137)::text, 11, '0'),
  (ARRAY['Kigali, Gasabo','Kigali, Kicukiro','Kigali, Nyarugenge','Huye, Southern',
         'Musanze, Northern','Rubavu, Western','Nyagatare, Eastern','Muhanga, Southern'])[1 + (rn % 8)],
  date '2026-01-12',
  -- every 4th learner boards
  (CASE WHEN rn % 4 = 0 THEN 'boarding' ELSE 'day' END)::"StudentType",
  -- two inactive learners so status filters have something to hide
  (CASE WHEN rn IN (26, 38) THEN 'inactive' ELSE 'active' END)::"StudentStatus",
  now(), now()
FROM names;

-- ---------------------------------------------------------------------------
-- 3. Section enrolments (academic year 1, term 7)
-- ---------------------------------------------------------------------------
INSERT INTO student_section_enrollments (
  school_id, student_id, section_id, term_id, academic_year_id,
  enrolled_at, status
)
SELECT
  1,
  s.id,
  CASE
    WHEN s.student_school_id - 99 <= 15 THEN 1   -- S1 A
    WHEN s.student_school_id - 99 <= 28 THEN 10  -- S1 B
    ELSE 11                                      -- S2 A
  END,
  7,
  1,
  date '2026-01-12',
  (CASE WHEN s.status = 'inactive' THEN 'dropped' ELSE 'active' END)::"EnrollmentStatus"
FROM students s
WHERE s.school_id = 1 AND s.student_id_number LIKE 'ESG/2026/%'
ON CONFLICT (student_id, section_id, academic_year_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Parents / guardians — one primary guardian per learner
-- ---------------------------------------------------------------------------
WITH inserted_parents AS (
  INSERT INTO parents_guardians (
    school_id, first_name, last_name, phone, phone_alt, email,
    national_id, relationship, address, occupation, created_at, updated_at
  )
  SELECT
    1,
    (ARRAY['Emmanuel','Beatrice','Vincent','Jeanne','Theoneste','Immaculee',
           'Callixte','Espérance','Straton','Vestine'])[1 + ((s.student_school_id - 99) % 10)],
    s.last_name,
    '+2507' || lpad(((s.student_school_id - 99) * 811 % 90000000 + 10000000)::text, 8, '0'),
    NULL,
    'parent' || (s.student_school_id - 99) || '@esg.test',
    'SEED' || lpad((s.student_school_id - 99)::text, 12, '0'),
    -- odd positions in the name array are male, even are female
    CASE WHEN (1 + ((s.student_school_id - 99) % 10)) % 2 = 0 THEN 'Mother' ELSE 'Father' END,
    s.address,
    (ARRAY['Farmer','Teacher','Trader','Nurse','Driver','Civil servant',
           'Mechanic','Tailor'])[1 + ((s.student_school_id - 99) % 8)],
    now(), now()
  FROM students s
  WHERE s.school_id = 1 AND s.student_id_number LIKE 'ESG/2026/%'
  RETURNING id, national_id
)
INSERT INTO student_parent_links (student_id, parent_id, is_primary)
SELECT s.id, p.id, true
FROM inserted_parents p
JOIN students s
  ON s.school_id = 1
 AND s.student_id_number = 'ESG/2026/' || lpad(ltrim(right(p.national_id, 12), '0'), 3, '0')
ON CONFLICT (student_id, parent_id) DO NOTHING;

COMMIT;
