-- Add a unique constraint on attendance_sessions so the database itself
-- enforces uniqueness. This replaces the application-level advisory lock
-- that was serialising ALL session creates school-wide (blocking concurrency).
--
-- Two teachers in different classes can now create sessions simultaneously
-- with zero contention. Two requests for the exact same session will race
-- at the DB level; the loser gets a unique violation which the service
-- handles with ON CONFLICT DO NOTHING — returning the winner's row instead.
--
-- The constraint treats NULL period_id / subject_id / teacher_id as
-- distinct values per SQL semantics, which is wrong for our use-case
-- (NULL period means "no period" — not "any period"). We use COALESCE(x, 0)
-- in a partial unique index instead of a Prisma @@unique so NULLs compare
-- as equal.

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_natural_key
ON attendance_sessions (
    school_id,
    section_id,
    session_date,
    session_type,
    COALESCE(period_id,  0),
    COALESCE(subject_id, 0),
    COALESCE(teacher_id, 0)
);
