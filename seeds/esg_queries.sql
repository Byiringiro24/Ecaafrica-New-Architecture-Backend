-- =============================================================================
-- ESG (school_id = 1) — handy queries for testing
-- =============================================================================
-- Not meant to be run end-to-end; copy the block you need.
-- School: ESG, id 1, uuid f53af939-7fa0-4b08-9a24-2b437ab7942b
-- Academic year 1 ("2026"), current term 7 ("Second Term")
-- Seeded students carry student_id_number 'ESG/2026/%'; seeded finance and
-- exam rows are tagged 'SEED %' / 'SEED-%'.
-- =============================================================================


-- ## STUDENTS ################################################################

-- Class list with guardian contact
SELECT s.student_id_number, s.first_name, s.last_name, s.gender, s.student_type,
       sec.full_name AS section, p.first_name || ' ' || p.last_name AS guardian,
       p.relationship, p.phone
FROM students s
JOIN student_section_enrollments se ON se.student_id = s.id AND se.status = 'active'
JOIN sections sec ON sec.id = se.section_id
LEFT JOIN student_parent_links l ON l.student_id = s.id AND l.is_primary
LEFT JOIN parents_guardians p ON p.id = l.parent_id
WHERE s.school_id = 1 AND s.status = 'active'
ORDER BY sec.full_name, s.last_name;

-- Headcount per section, split by day/boarding
SELECT sec.full_name AS section,
       count(*) FILTER (WHERE s.student_type = 'day')      AS day_scholars,
       count(*) FILTER (WHERE s.student_type = 'boarding') AS boarders,
       count(*)                                            AS total
FROM students s
JOIN student_section_enrollments se ON se.student_id = s.id AND se.status = 'active'
JOIN sections sec ON sec.id = se.section_id
WHERE s.school_id = 1 AND s.status = 'active'
GROUP BY sec.full_name ORDER BY sec.full_name;


-- ## GRADES ##################################################################

-- Report card for one student: average % and grade per subject, term 7.
-- Mirrors the app's scale (>=80 A, >=70 B, >=60 C, >=50 D, else F).
SELECT sub.name AS subject,
       round(avg(r.marks_obtained / e.max_marks * 100))            AS percent,
       CASE WHEN round(avg(r.marks_obtained / e.max_marks * 100)) >= 80 THEN 'A'
            WHEN round(avg(r.marks_obtained / e.max_marks * 100)) >= 70 THEN 'B'
            WHEN round(avg(r.marks_obtained / e.max_marks * 100)) >= 60 THEN 'C'
            WHEN round(avg(r.marks_obtained / e.max_marks * 100)) >= 50 THEN 'D'
            ELSE 'F' END                                           AS grade,
       string_agg(DISTINCT r.remarks, '; ')                        AS comments
FROM exam_results r
JOIN exams e     ON e.id = r.exam_id
JOIN subjects sub ON sub.id = e.subject_id
JOIN students s  ON s.id = r.student_id
WHERE s.school_id = 1
  AND s.student_id_number = 'ESG/2026/001'   -- <-- change student here
  AND e.term_id = 7
  AND r.is_absent = false
  AND r.published_at IS NOT NULL             -- published results only
GROUP BY sub.name ORDER BY sub.name;

-- Section ranking for a term (published exams only)
SELECT rank() OVER (ORDER BY avg(r.marks_obtained / e.max_marks * 100) DESC) AS position,
       s.student_id_number, s.first_name || ' ' || s.last_name AS student,
       round(avg(r.marks_obtained / e.max_marks * 100), 1) AS average_percent
FROM exam_results r
JOIN exams e    ON e.id = r.exam_id
JOIN students s ON s.id = r.student_id
JOIN student_section_enrollments se ON se.student_id = s.id AND se.status = 'active'
WHERE s.school_id = 1 AND se.section_id = 1   -- <-- S1 A; 10 = S1 B, 11 = S2 A
  AND e.term_id = 7 AND r.is_absent = false AND r.published_at IS NOT NULL
GROUP BY s.id, s.student_id_number, s.first_name, s.last_name
ORDER BY position;

-- Grade distribution per subject — spot subjects that need attention
SELECT sub.name AS subject,
       count(*) FILTER (WHERE r.grade = 'A') AS a,
       count(*) FILTER (WHERE r.grade = 'B') AS b,
       count(*) FILTER (WHERE r.grade = 'C') AS c,
       count(*) FILTER (WHERE r.grade = 'D') AS d,
       count(*) FILTER (WHERE r.grade = 'F') AS f,
       count(*) FILTER (WHERE r.is_absent)   AS absent
FROM exam_results r
JOIN exams e     ON e.id = r.exam_id
JOIN subjects sub ON sub.id = e.subject_id
WHERE e.school_id = 1 AND e.term_id = 7
GROUP BY sub.name ORDER BY sub.name;

-- Unpublished exams (the publish / unpublish admin flow acts on these)
SELECT e.id, e.name, sub.name AS subject, sec.full_name AS section,
       e.type, e.exam_date, e.max_marks, count(r.id) AS marks_entered
FROM exams e
JOIN subjects sub ON sub.id = e.subject_id
LEFT JOIN sections sec ON sec.id = e.section_id
LEFT JOIN exam_results r ON r.exam_id = e.id
WHERE e.school_id = 1 AND e.published_at IS NULL
GROUP BY e.id, e.name, sub.name, sec.full_name, e.type, e.exam_date, e.max_marks
ORDER BY sec.full_name, sub.name;


-- ## FINANCE #################################################################

-- Collection summary: billed vs collected vs outstanding, per fee item
SELECT fs.name AS fee_item, fs.amount, count(sfa.id) AS students_billed,
       sum(sfa.amount_due) AS billed, sum(sfa.amount_paid) AS collected,
       sum(sfa.balance) AS outstanding,
       round(sum(sfa.amount_paid) / nullif(sum(sfa.amount_due), 0) * 100, 1) AS percent_collected
FROM fee_structures fs
JOIN student_fee_assignments sfa ON sfa.fee_structure_id = fs.id
WHERE fs.school_id = 1
GROUP BY fs.name, fs.amount ORDER BY outstanding DESC;

-- Debtors list — who owes what, worst first
SELECT s.student_id_number, s.first_name || ' ' || s.last_name AS student,
       sec.full_name AS section, sum(sfa.balance) AS balance,
       count(*) FILTER (WHERE sfa.status = 'overdue') AS overdue_items,
       min(sfa.due_date) AS earliest_due
FROM student_fee_assignments sfa
JOIN students s ON s.id = sfa.student_id
LEFT JOIN student_section_enrollments se ON se.student_id = s.id AND se.status = 'active'
LEFT JOIN sections sec ON sec.id = se.section_id
WHERE sfa.school_id = 1 AND sfa.balance > 0
GROUP BY s.student_id_number, s.first_name, s.last_name, sec.full_name
ORDER BY balance DESC;

-- Daily collections (drives the finance dashboard chart)
SELECT date(t.paid_at) AS day, count(*) AS receipts, sum(t.amount) AS collected
FROM fee_transactions t
WHERE t.school_id = 1
GROUP BY date(t.paid_at) ORDER BY day;

-- Collections by payment method
SELECT t.payment_method, count(*) AS receipts, sum(t.amount) AS total
FROM fee_transactions t
WHERE t.school_id = 1
GROUP BY t.payment_method ORDER BY total DESC;

-- Expenses by category and status
SELECT category,
       sum(amount) FILTER (WHERE status = 'paid')     AS paid,
       sum(amount) FILTER (WHERE status = 'approved') AS approved,
       sum(amount) FILTER (WHERE status = 'pending')  AS pending,
       sum(amount) FILTER (WHERE status = 'rejected') AS rejected,
       sum(amount)                                    AS total
FROM expenses
WHERE school_id = 1 AND deleted_at IS NULL
GROUP BY category ORDER BY total DESC;

-- Income vs expenditure for the term
SELECT
  (SELECT coalesce(sum(amount), 0) FROM fee_transactions WHERE school_id = 1) AS income,
  (SELECT coalesce(sum(amount), 0) FROM expenses
    WHERE school_id = 1 AND status = 'paid' AND deleted_at IS NULL)           AS expenditure,
  (SELECT coalesce(sum(amount), 0) FROM fee_transactions WHERE school_id = 1)
  - (SELECT coalesce(sum(amount), 0) FROM expenses
      WHERE school_id = 1 AND status = 'paid' AND deleted_at IS NULL)         AS net;

-- Stock below reorder level
SELECT i.code, i.item_name, i.category, i.quantity, i.reorder_level,
       i.unit_cost, sup.name AS supplier
FROM inventory_items i
LEFT JOIN suppliers sup ON sup.id = i.supplier_id
WHERE i.school_id = 1 AND i.deleted_at IS NULL AND i.quantity <= i.reorder_level
ORDER BY i.quantity;

-- Payroll run with payslips
SELECT pr.month, pr.year, pr.status, pr.employee_count,
       pr.total_gross, pr.total_deductions, pr.total_net,
       u.name AS staff, ps.reference, ps.gross_salary, ps.net_salary
FROM payroll_runs pr
JOIN payslips ps ON ps.payroll_run_id = pr.id
JOIN staff_profiles sp ON sp.id = ps.staff_id
LEFT JOIN users u ON u.id = sp.user_id
WHERE pr.school_id = 1
ORDER BY pr.year, pr.month, ps.reference;

-- Invoice ageing
SELECT v.invoice_number, s.student_id_number,
       s.first_name || ' ' || s.last_name AS student,
       v.total, v.amount_paid, v.total - v.amount_paid AS balance,
       v.status, v.due_date, current_date - v.due_date AS days_overdue
FROM student_invoices v
JOIN students s ON s.id = v.student_id
WHERE v.school_id = 1 AND v.deleted_at IS NULL AND v.total > v.amount_paid
ORDER BY days_overdue DESC;


-- ## INTEGRITY CHECKS ########################################################
-- All four should return 0.

SELECT count(*) AS balance_mismatch
FROM student_fee_assignments
WHERE school_id = 1 AND balance <> amount_due - amount_paid;

SELECT count(*) AS receipts_not_matching_assignment
FROM student_fee_assignments sfa
LEFT JOIN (SELECT fee_assignment_id, sum(amount) s FROM fee_transactions GROUP BY 1) t
       ON t.fee_assignment_id = sfa.id
WHERE sfa.school_id = 1 AND coalesce(t.s, 0) <> sfa.amount_paid;

SELECT count(*) AS payroll_total_mismatch
FROM payroll_runs pr
JOIN (SELECT payroll_run_id, sum(net_salary) n, count(*) c
        FROM payslips GROUP BY 1) ps ON ps.payroll_run_id = pr.id
WHERE pr.school_id = 1 AND (pr.total_net <> ps.n OR pr.employee_count <> ps.c);

SELECT count(*) AS marks_over_max
FROM exam_results r JOIN exams e ON e.id = r.exam_id
WHERE e.school_id = 1 AND r.marks_obtained > e.max_marks;
