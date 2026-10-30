-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('pending', 'approved', 'paid', 'rejected');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('requested', 'ordered', 'received', 'invoiced', 'cancelled');

-- CreateEnum
CREATE TYPE "StudentInvoiceStatus" AS ENUM ('draft', 'pending', 'partially_paid', 'paid', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('draft', 'submitted', 'approved', 'paid');

-- CreateTable
CREATE TABLE "expenses" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "reference" VARCHAR(30) NOT NULL,
    "expense_date" DATE NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "vendor" VARCHAR(255),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "document_url" VARCHAR(500),
    "status" "ExpenseStatus" NOT NULL DEFAULT 'pending',
    "approved_by" BIGINT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "payment_method" "PaymentMethod",
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "address" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "supplier_id" BIGINT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "status" "POStatus" NOT NULL DEFAULT 'requested',
    "invoice_url" VARCHAR(500),
    "notes" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_invoices" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "invoice_number" VARCHAR(30) NOT NULL,
    "student_id" BIGINT NOT NULL,
    "academic_year_id" BIGINT,
    "term_id" BIGINT,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previous_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "late_charges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "status" "StudentInvoiceStatus" NOT NULL DEFAULT 'draft',
    "document_url" VARCHAR(500),
    "notes" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "student_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_invoice_items" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "fee_structure_id" BIGINT,
    "label" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "year" SMALLINT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'draft',
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "submitted_at" TIMESTAMP(3),
    "approved_by" BIGINT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "payroll_run_id" BIGINT NOT NULL,
    "staff_id" BIGINT NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pension" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loan_recovery" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'draft',
    "paid_at" TIMESTAMP(3),
    "payment_method" "PaymentMethod",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_school_id_idx" ON "expenses"("school_id");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "expenses_created_at_idx" ON "expenses"("created_at");

-- CreateIndex
CREATE INDEX "expenses_deleted_at_idx" ON "expenses"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_school_id_reference_key" ON "expenses"("school_id", "reference");

-- CreateIndex
CREATE INDEX "suppliers_school_id_idx" ON "suppliers"("school_id");

-- CreateIndex
CREATE INDEX "suppliers_is_active_idx" ON "suppliers"("is_active");

-- CreateIndex
CREATE INDEX "suppliers_category_idx" ON "suppliers"("category");

-- CreateIndex
CREATE INDEX "suppliers_created_at_idx" ON "suppliers"("created_at");

-- CreateIndex
CREATE INDEX "suppliers_deleted_at_idx" ON "suppliers"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_school_id_code_key" ON "suppliers"("school_id", "code");

-- CreateIndex
CREATE INDEX "inventory_items_school_id_idx" ON "inventory_items"("school_id");

-- CreateIndex
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "inventory_items_supplier_id_idx" ON "inventory_items"("supplier_id");

-- CreateIndex
CREATE INDEX "inventory_items_created_at_idx" ON "inventory_items"("created_at");

-- CreateIndex
CREATE INDEX "inventory_items_deleted_at_idx" ON "inventory_items"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_school_id_code_key" ON "inventory_items"("school_id", "code");

-- CreateIndex
CREATE INDEX "student_invoices_school_id_idx" ON "student_invoices"("school_id");

-- CreateIndex
CREATE INDEX "student_invoices_student_id_idx" ON "student_invoices"("student_id");

-- CreateIndex
CREATE INDEX "student_invoices_status_idx" ON "student_invoices"("status");

-- CreateIndex
CREATE INDEX "student_invoices_due_date_idx" ON "student_invoices"("due_date");

-- CreateIndex
CREATE INDEX "student_invoices_issue_date_idx" ON "student_invoices"("issue_date");

-- CreateIndex
CREATE INDEX "student_invoices_created_at_idx" ON "student_invoices"("created_at");

-- CreateIndex
CREATE INDEX "student_invoices_deleted_at_idx" ON "student_invoices"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_invoices_school_id_invoice_number_key" ON "student_invoices"("school_id", "invoice_number");

-- CreateIndex
CREATE INDEX "student_invoice_items_invoice_id_idx" ON "student_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "student_invoice_items_fee_structure_id_idx" ON "student_invoice_items"("fee_structure_id");

-- CreateIndex
CREATE INDEX "payroll_runs_school_id_idx" ON "payroll_runs"("school_id");

-- CreateIndex
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

-- CreateIndex
CREATE INDEX "payroll_runs_created_at_idx" ON "payroll_runs"("created_at");

-- CreateIndex
CREATE INDEX "payroll_runs_deleted_at_idx" ON "payroll_runs"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_school_id_month_year_key" ON "payroll_runs"("school_id", "month", "year");

-- CreateIndex
CREATE INDEX "payslips_school_id_idx" ON "payslips"("school_id");

-- CreateIndex
CREATE INDEX "payslips_payroll_run_id_idx" ON "payslips"("payroll_run_id");

-- CreateIndex
CREATE INDEX "payslips_staff_id_idx" ON "payslips"("staff_id");

-- CreateIndex
CREATE INDEX "payslips_status_idx" ON "payslips"("status");

-- CreateIndex
CREATE INDEX "payslips_created_at_idx" ON "payslips"("created_at");

-- CreateIndex
CREATE INDEX "payslips_deleted_at_idx" ON "payslips"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_run_id_staff_id_key" ON "payslips"("payroll_run_id", "staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_school_id_reference_key" ON "payslips"("school_id", "reference");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoice_items" ADD CONSTRAINT "student_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "student_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoice_items" ADD CONSTRAINT "student_invoice_items_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

