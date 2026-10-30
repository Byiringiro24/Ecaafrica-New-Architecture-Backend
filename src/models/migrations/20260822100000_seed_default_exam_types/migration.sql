-- Keep the teacher Create Exam type list database-backed for every school.
-- The unique constraint makes this safe for schools that already have one of
-- these types configured by an administrator.
INSERT INTO "exam_types" ("school_id", "name", "description")
SELECT s."id", defaults."name", defaults."description"
FROM "schools" s
CROSS JOIN (
    VALUES
        ('CAT', 'Continuous assessment test'),
        ('Main Exam', 'Main examination'),
        ('Mock', 'Mock examination'),
        ('Quiz', 'Quiz'),
        ('Assignment', 'Assignment'),
        ('Exam Mid term', 'Mid-term examination')
) AS defaults("name", "description")
ON CONFLICT ("school_id", "name") DO NOTHING;
