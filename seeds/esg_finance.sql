-- =============================================================================
-- ESG (school_id = 1) — finance test data
-- =============================================================================
-- Run AFTER esg_test_data.sql.
--
--   psql "$DATABASE_URL" -f seeds/esg_finance.sql
--
-- Covers: fee structures, per-student assignments, payments (paid / partial /
-- unpaid / overdue), invoices, expenses, suppliers, inventory and a payroll run.
-- All rows are tagged 'SEED %' / 'SEED-%' and removed on re-run. Existing rows
-- (fee_structures 1 and 4, EXP-2026-0001, INV-2026-0001) are left alone.
-- Currency is RWF throughout; amounts are realistic Rwandan day/boarding fees.
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

DELETE FROM payslips         WHERE school_id = 1 AND reference LIKE 'SEED-%';
DELETE FROM payroll_runs     WHERE school_id = 1 AND notes = 'SEED payroll';
DELETE FROM inventory_items  WHERE school_id = 1 AND code LIKE 'SEED-%';
DELETE FROM suppliers        WHERE school_id = 1 AND code LIKE 'SEED-%';
DELETE FROM expenses         WHERE school_id = 1 AND reference LIKE 'SEED-%';
DELETE FROM student_invoices WHERE school_id = 1 AND invoice_number LIKE 'SEED-%';
DELETE FROM fee_transactions WHERE school_id = 1 AND receipt_number LIKE 'SEED-%';
DELETE FROM student_fee_assignments sfa
 USING fee_structures fs
 WHERE sfa.fee_structure_id = fs.id AND fs.school_id = 1 AND fs.name LIKE 'SEED %';
DELETE FROM fee_structures   WHERE school_id = 1 AND name LIKE 'SEED %';

-- ---------------------------------------------------------------------------
-- 1. Fee structures (academic year 1, term 7)
-- ---------------------------------------------------------------------------
INSERT INTO fee_structures (
  school_id, academic_year_id, term_id, class_id,
  name, amount, currency, is_mandatory, due_date, created_at, updated_at
)
VALUES
  (1, 1, 7, 1,    'SEED S1 Tuition - Term 2',   85000.00, 'RWF', true,  date '2026-02-15', now(), now()),
  (1, 1, 7, 18,   'SEED S2 Tuition - Term 2',   92000.00, 'RWF', true,  date '2026-02-15', now(), now()),
  (1, 1, 7, NULL, 'SEED Boarding Fee - Term 2', 60000.00, 'RWF', false, date '2026-02-28', now(), now()),
  (1, 1, 7, NULL, 'SEED School Uniform',        18000.00, 'RWF', false, date '2026-02-01', now(), now()),
  (1, 1, 7, NULL, 'SEED Exam Fee',               5000.00, 'RWF', true,  date '2026-04-30', now(), now());

-- ---------------------------------------------------------------------------
-- 2. Assign tuition to every active seeded student, boarding to boarders
-- ---------------------------------------------------------------------------
-- Payment profile is deterministic per student: 45% fully paid, 25% partial,
-- 20% unpaid, 10% overdue (due date in the past and nothing paid).
WITH targets AS (
  SELECT
    s.id AS student_id,
    s.student_school_id - 99 AS rn,
    s.student_type,
    se.section_id,
    fs.id AS fee_structure_id,
    -- Bucket off a stable ordinal, NOT fs.id: the ids change on every re-run
    -- (rows are deleted and re-inserted), which would reshuffle who has paid.
    dense_rank() OVER (ORDER BY fs.name) AS fee_seq,
    fs.amount,
    fs.due_date
  FROM students s
  JOIN student_section_enrollments se
    ON se.student_id = s.id AND se.status = 'active'
  JOIN sections sec ON sec.id = se.section_id
  JOIN fee_structures fs
    ON fs.school_id = 1
   AND fs.name LIKE 'SEED %'
   AND (
        -- class tuition matched to the learner's class
        (fs.class_id = sec.class_id AND fs.name LIKE 'SEED S% Tuition%')
        -- boarding fee only for boarders
     OR (fs.name = 'SEED Boarding Fee - Term 2' AND s.student_type = 'boarding')
        -- exam fee for everyone
     OR (fs.name = 'SEED Exam Fee')
   )
  WHERE s.school_id = 1
    AND s.student_id_number LIKE 'ESG/2026/%'
    AND s.status = 'active'
)
INSERT INTO student_fee_assignments (
  school_id, student_id, fee_structure_id,
  amount_due, amount_paid, balance, status, due_date, created_at, updated_at
)
SELECT
  1,
  t.student_id,
  t.fee_structure_id,
  t.amount,
  p.paid,
  t.amount - p.paid,
  p.status::"FeeAssignmentStatus",
  CASE WHEN p.bucket = 3 THEN date '2026-02-15' ELSE t.due_date END,
  now(), now()
FROM targets t
CROSS JOIN LATERAL (
  SELECT
    bucket,
    CASE bucket
      WHEN 0 THEN t.amount                        -- paid in full
      WHEN 1 THEN round(t.amount * 0.4, 2)        -- partial
      ELSE 0                                      -- unpaid / overdue
    END AS paid,
    CASE bucket
      WHEN 0 THEN 'paid'
      WHEN 1 THEN 'partial'
      WHEN 2 THEN 'unpaid'
      ELSE 'overdue'
    END AS status
  FROM (SELECT CASE
                 WHEN (t.rn * 3 + t.fee_seq) % 20 < 9 THEN 0
                 WHEN (t.rn * 3 + t.fee_seq) % 20 < 14 THEN 1
                 WHEN (t.rn * 3 + t.fee_seq) % 20 < 18 THEN 2
                 ELSE 3
               END AS bucket) b
) p;

-- ---------------------------------------------------------------------------
-- 3. Receipts for everything that has been paid
-- ---------------------------------------------------------------------------
INSERT INTO fee_transactions (
  school_id, student_id, fee_assignment_id, receipt_number,
  amount, currency, payment_method, payment_ref, paid_at,
  received_by, notes, created_at
)
SELECT
  1,
  sfa.student_id,
  sfa.id,
  'SEED-RCP-' || lpad(sfa.id::text, 6, '0'),
  sfa.amount_paid,
  'RWF',
  (ARRAY['cash','mtn_momo','airtel_money','bank_transfer','cheque'])
    [1 + (sfa.id % 5)]::"PaymentMethod",
  CASE WHEN (sfa.id % 5) IN (1, 2)
       THEN 'TXN' || lpad((sfa.id * 7919 % 1000000000)::text, 10, '0')
       ELSE NULL END,
  -- payments trickle in across Feb and Mar 2026
  (date '2026-02-01' + ((sfa.id * 13) % 55) * interval '1 day')::timestamp + interval '9 hour',
  33,                                   -- received by the Finance Manager
  CASE WHEN sfa.status = 'partial' THEN 'Part payment - balance pending' ELSE NULL END,
  now()
FROM student_fee_assignments sfa
JOIN fee_structures fs ON fs.id = sfa.fee_structure_id
WHERE fs.school_id = 1 AND fs.name LIKE 'SEED %' AND sfa.amount_paid > 0;

-- ---------------------------------------------------------------------------
-- 4. Student invoices (term 2) with line items
-- ---------------------------------------------------------------------------
WITH inv AS (
  INSERT INTO student_invoices (
    school_id, invoice_number, student_id, academic_year_id, term_id,
    issue_date, due_date, subtotal, discount, previous_balance, late_charges,
    total, amount_paid, currency, status, notes, created_by, created_at, updated_at
  )
  SELECT
    1,
    'SEED-INV-' || lpad((s.student_school_id - 99)::text, 4, '0'),
    s.id,
    1,
    7,
    date '2026-01-20',
    date '2026-02-15',
    agg.subtotal,
    CASE WHEN (s.student_school_id - 99) % 11 = 0 THEN 10000.00 ELSE 0.00 END,
    0.00,
    CASE WHEN agg.balance > 0 AND (s.student_school_id - 99) % 7 = 0 THEN 2500.00 ELSE 0.00 END,
    agg.subtotal
      - CASE WHEN (s.student_school_id - 99) % 11 = 0 THEN 10000.00 ELSE 0.00 END
      + CASE WHEN agg.balance > 0 AND (s.student_school_id - 99) % 7 = 0 THEN 2500.00 ELSE 0.00 END,
    agg.paid,
    'RWF',
    CASE
      WHEN agg.paid >= agg.subtotal THEN 'paid'
      WHEN agg.paid > 0            THEN 'partially_paid'
      ELSE 'pending'
    END::"StudentInvoiceStatus",
    'Term 2 consolidated invoice',
    33,
    now(), now()
  FROM students s
  JOIN LATERAL (
    SELECT
      sum(sfa.amount_due) AS subtotal,
      sum(sfa.amount_paid) AS paid,
      sum(sfa.balance) AS balance
    FROM student_fee_assignments sfa
    JOIN fee_structures fs ON fs.id = sfa.fee_structure_id
    WHERE sfa.student_id = s.id AND fs.school_id = 1 AND fs.name LIKE 'SEED %'
  ) agg ON agg.subtotal IS NOT NULL
  WHERE s.school_id = 1
    AND s.student_id_number LIKE 'ESG/2026/%'
    AND s.status = 'active'
  RETURNING id, student_id
)
INSERT INTO student_invoice_items (invoice_id, fee_structure_id, label, amount, created_at)
SELECT inv.id, fs.id, fs.name, sfa.amount_due, now()
FROM inv
JOIN student_fee_assignments sfa ON sfa.student_id = inv.student_id
JOIN fee_structures fs ON fs.id = sfa.fee_structure_id
WHERE fs.school_id = 1 AND fs.name LIKE 'SEED %';

-- ---------------------------------------------------------------------------
-- 5. Suppliers
-- ---------------------------------------------------------------------------
INSERT INTO suppliers (
  school_id, code, name, category, contact_person, phone, email,
  address, balance, is_active, created_at, updated_at
)
VALUES
  (1, 'SEED-SUP-001', 'Kigali Stationery Ltd',   'Stationery', 'Jean Bosco Habyarimana', '+250788123001', 'sales@kigalistationery.rw', 'KN 4 Ave, Nyarugenge, Kigali',  450000.00, true,  now(), now()),
  (1, 'SEED-SUP-002', 'Rwanda Foods Supply',     'Catering',   'Marie Claire Uwera',     '+250788123002', 'orders@rwandafoods.rw',     'KK 15 Rd, Kicukiro, Kigali',  1250000.00, true,  now(), now()),
  (1, 'SEED-SUP-003', 'Musanze Furniture Works', 'Furniture',  'Aloys Nzeyimana',        '+250788123003', 'info@musanzefurniture.rw',  'Musanze, Northern Province',        0.00, true,  now(), now()),
  (1, 'SEED-SUP-004', 'Bralirwa Distributors',   'Utilities',  'Patrick Rutayisire',     '+250788123004', 'accounts@bralirwadist.rw',  'Gisenyi, Rubavu',              320000.00, true,  now(), now()),
  (1, 'SEED-SUP-005', 'Old Vendor Co',           'Stationery', 'Former Contact',         '+250788123005', NULL,                        'Huye, Southern Province',           0.00, false, now(), now());

-- ---------------------------------------------------------------------------
-- 6. Inventory
-- ---------------------------------------------------------------------------
INSERT INTO inventory_items (
  school_id, code, item_name, category, supplier_id, quantity, unit_cost,
  currency, reorder_level, status, notes, created_by, created_at, updated_at
)
SELECT
  1, v.code, v.item_name, v.category,
  (SELECT id FROM suppliers WHERE school_id = 1 AND code = v.supplier_code),
  v.quantity, v.unit_cost, 'RWF', v.reorder_level, v.status::"POStatus",
  v.notes, 33, now(), now()
FROM (
  VALUES
    ('SEED-ITM-001', 'Exercise books (96p)',   'Stationery', 'SEED-SUP-001', 1200,    350.00, 300, 'received', NULL),
    ('SEED-ITM-002', 'Chalk boxes',            'Stationery', 'SEED-SUP-001',   40,   2500.00,  20, 'received', NULL),
    ('SEED-ITM-003', 'Student desks',          'Furniture',  'SEED-SUP-003',   25,  45000.00,  10, 'ordered',  'For new S2 stream'),
    ('SEED-ITM-004', 'Laboratory beakers',     'Laboratory', 'SEED-SUP-001',    8,   8500.00,  15, 'received', 'Below reorder level'),
    ('SEED-ITM-005', 'Rice (50kg sacks)',      'Catering',   'SEED-SUP-002',   30,  55000.00,  12, 'invoiced', NULL),
    ('SEED-ITM-006', 'Beans (50kg sacks)',     'Catering',   'SEED-SUP-002',    6,  48000.00,  10, 'received', 'Below reorder level'),
    ('SEED-ITM-007', 'Whiteboard markers',     'Stationery', 'SEED-SUP-001',  150,    800.00,  50, 'received', NULL),
    ('SEED-ITM-008', 'Football kits',          'Sports',     'SEED-SUP-003',    2,  35000.00,   5, 'requested','Awaiting approval')
) AS v(code, item_name, category, supplier_code, quantity, unit_cost, reorder_level, status, notes);

-- ---------------------------------------------------------------------------
-- 7. Expenses — spread across categories and statuses
-- ---------------------------------------------------------------------------
INSERT INTO expenses (
  school_id, reference, expense_date, category, description, vendor,
  amount, currency, status, approved_by, approved_at, rejection_reason,
  paid_at, payment_method, created_by, created_at, updated_at
)
SELECT
  1,
  'SEED-EXP-' || lpad(v.n::text, 4, '0'),
  v.expense_date,
  v.category,
  v.description,
  v.vendor,
  v.amount,
  'RWF',
  v.status::"ExpenseStatus",
  CASE WHEN v.status IN ('approved','paid','rejected') THEN 2 ELSE NULL END,
  CASE WHEN v.status IN ('approved','paid','rejected')
       THEN v.expense_date::timestamp + interval '1 day' ELSE NULL END,
  CASE WHEN v.status = 'rejected' THEN 'Outside approved term budget' ELSE NULL END,
  CASE WHEN v.status = 'paid' THEN v.expense_date::timestamp + interval '3 day' ELSE NULL END,
  CASE WHEN v.status = 'paid' THEN v.method::"PaymentMethod" ELSE NULL END,
  33,
  now(), now()
FROM (
  VALUES
    ( 1, date '2026-01-15', 'Utilities',   'EUCL electricity - January',        'EUCL',                     185000.00, 'paid',     'bank_transfer'),
    ( 2, date '2026-01-18', 'Utilities',   'WASAC water - January',             'WASAC',                     92000.00, 'paid',     'bank_transfer'),
    ( 3, date '2026-01-22', 'Catering',    'Rice and beans - term stock',       'Rwanda Foods Supply',      1650000.00, 'paid',     'cheque'),
    ( 4, date '2026-02-02', 'Stationery',  'Exercise books and chalk',          'Kigali Stationery Ltd',     420000.00, 'paid',     'mtn_momo'),
    ( 5, date '2026-02-10', 'Transport',   'School bus fuel - February',        'SP Rwanda',                 240000.00, 'paid',     'cash'),
    ( 6, date '2026-02-14', 'Maintenance', 'Classroom roof repairs',            'Musanze Furniture Works',   380000.00, 'approved', NULL),
    ( 7, date '2026-02-20', 'Utilities',   'EUCL electricity - February',       'EUCL',                      176000.00, 'paid',     'bank_transfer'),
    ( 8, date '2026-03-01', 'Sports',      'Inter-school tournament fees',      'Rwanda Schools Sports',      75000.00, 'pending',  NULL),
    ( 9, date '2026-03-05', 'Laboratory',  'Chemistry reagents restock',        'Kigali Stationery Ltd',     310000.00, 'approved', NULL),
    (10, date '2026-03-11', 'Transport',   'Staff field trip allowance',        'Internal',                  150000.00, 'rejected', NULL),
    (11, date '2026-03-18', 'Catering',    'Cooking gas refill',                'Bralirwa Distributors',      88000.00, 'paid',     'mtn_momo'),
    (12, date '2026-04-02', 'Maintenance', 'Water tank cleaning',               'WASAC',                      45000.00, 'pending',  NULL),
    (13, date '2026-04-09', 'Stationery',  'Printer toner and paper',           'Kigali Stationery Ltd',     135000.00, 'approved', NULL),
    (14, date '2026-04-15', 'Utilities',   'Internet subscription - Q2',        'Liquid Telecom',            270000.00, 'paid',     'bank_transfer'),
    (15, date '2026-05-06', 'Furniture',   'Student desks - S2 stream',         'Musanze Furniture Works',  1125000.00, 'pending',  NULL)
) AS v(n, expense_date, category, description, vendor, amount, status, method);

-- ---------------------------------------------------------------------------
-- 8. Payroll — one approved run for March 2026 covering the 3 staff profiles
-- ---------------------------------------------------------------------------
INSERT INTO payroll_runs (
  school_id, month, year, status, total_gross, total_deductions, total_net,
  employee_count, currency, submitted_at, approved_by, approved_at, paid_at,
  notes, created_at, updated_at
)
VALUES (
  1, 3, 2026, 'paid'::"PayrollRunStatus", 0, 0, 0, 0, 'RWF',
  timestamp '2026-03-25 10:00', 2, timestamp '2026-03-26 09:00',
  timestamp '2026-03-28 14:00', 'SEED payroll', now(), now()
);

INSERT INTO payslips (
  school_id, payroll_run_id, staff_id, reference,
  basic_salary, allowances, overtime, bonus, gross_salary,
  tax, pension, loan_recovery, other_deductions, total_deductions, net_salary,
  currency, status, paid_at, payment_method, created_at, updated_at
)
SELECT
  1,
  run.id,
  sp.id,
  'SEED-PS-2026-03-' || lpad(sp.id::text, 3, '0'),
  b.basic,
  b.allowances,
  b.overtime,
  b.bonus,
  b.basic + b.allowances + b.overtime + b.bonus,
  -- PAYE 30%, RSSB pension 3% employee share
  round((b.basic + b.allowances + b.overtime + b.bonus) * 0.30, 2),
  round(b.basic * 0.03, 2),
  b.loan,
  0,
  round((b.basic + b.allowances + b.overtime + b.bonus) * 0.30, 2)
    + round(b.basic * 0.03, 2) + b.loan,
  (b.basic + b.allowances + b.overtime + b.bonus)
    - round((b.basic + b.allowances + b.overtime + b.bonus) * 0.30, 2)
    - round(b.basic * 0.03, 2) - b.loan,
  'RWF',
  'paid'::"PayrollRunStatus",
  timestamp '2026-03-28 14:00',
  'bank_transfer'::"PaymentMethod",
  now(), now()
FROM (SELECT id FROM payroll_runs WHERE school_id = 1 AND notes = 'SEED payroll') run
CROSS JOIN staff_profiles sp
CROSS JOIN LATERAL (
  SELECT
    coalesce(sp.basic_salary, 300000.00) AS basic,
    50000.00 AS allowances,
    CASE WHEN sp.department = 'Teaching' THEN 25000.00 ELSE 0.00 END AS overtime,
    CASE WHEN sp.id % 2 = 0 THEN 40000.00 ELSE 0.00 END AS bonus,
    CASE WHEN sp.id % 3 = 0 THEN 30000.00 ELSE 0.00 END AS loan
) b
WHERE sp.school_id = 1 AND sp.deleted_at IS NULL;

-- Roll the payslip totals up onto the run. This must be a separate statement:
-- inside a data-modifying CTE the UPDATE reads a snapshot taken before the
-- INSERT, so it would match zero rows and leave the totals at 0.
UPDATE payroll_runs pr
SET total_gross      = agg.gross,
    total_deductions = agg.deductions,
    total_net        = agg.net,
    employee_count   = agg.headcount
FROM (
  SELECT payroll_run_id,
         sum(gross_salary)     AS gross,
         sum(total_deductions) AS deductions,
         sum(net_salary)       AS net,
         count(*)              AS headcount
  FROM payslips
  WHERE school_id = 1 AND reference LIKE 'SEED-PS-%'
  GROUP BY payroll_run_id
) agg
WHERE pr.id = agg.payroll_run_id;

COMMIT;
