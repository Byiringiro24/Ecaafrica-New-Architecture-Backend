-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('government', 'private', 'international', 'technical', 'seminary', 'other');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('active', 'trial', 'grace', 'suspended', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual', 'term', 'weekly', 'daily');

-- CreateEnum
CREATE TYPE "SchoolSubscriptionStatus" AS ENUM ('active', 'trial', 'grace', 'expired', 'cancelled', 'pending');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'paid', 'overdue', 'void', 'refunded');

-- CreateEnum
CREATE TYPE "PlatformUserRole" AS ENUM ('platform_admin', 'support');

-- CreateEnum
CREATE TYPE "PlatformUserAccessScope" AS ENUM ('all', 'assigned');

-- CreateEnum
CREATE TYPE "PlatformUserStatus" AS ENUM ('active', 'inactive', 'locked');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('info', 'warning', 'critical', 'maintenance', 'feature');

-- CreateEnum
CREATE TYPE "AnnouncementTargetScope" AS ENUM ('all', 'plan', 'province', 'specific');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('draft', 'scheduled', 'sent');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('technical', 'billing', 'feature_request', 'other');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "SupportTicketSenderType" AS ENUM ('school_user', 'platform_user');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('school_admin', 'teacher', 'staff', 'parent', 'student');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'locked', 'pending');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('national', 'school', 'exam', 'other');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "StudentType" AS ENUM ('boarding', 'day');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('active', 'inactive', 'transferred', 'graduated', 'expelled');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'transferred', 'dropped');

-- CreateEnum
CREATE TYPE "BiometricType" AS ENUM ('face', 'fingerprint', 'card_nfc', 'card_qr');

-- CreateEnum
CREATE TYPE "StaffContractType" AS ENUM ('permanent', 'contract', 'part_time');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'on_leave', 'inactive');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('pending', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "AttendanceSessionType" AS ENUM ('class', 'gate', 'boarding_morning', 'boarding_evening');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late', 'excused');

-- CreateEnum
CREATE TYPE "ScanMethod" AS ENUM ('manual', 'nfc', 'qr', 'face', 'fingerprint');

-- CreateEnum
CREATE TYPE "GateEventType" AS ENUM ('entry', 'exit');

-- CreateEnum
CREATE TYPE "OfflineRecordType" AS ENUM ('gate_log', 'attendance_record', 'boarding_roll');

-- CreateEnum
CREATE TYPE "OfflineSyncStatus" AS ENUM ('pending', 'processing', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "DormGender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "BoardingSessionType" AS ENUM ('morning', 'evening');

-- CreateEnum
CREATE TYPE "BoardingRollStatus" AS ENUM ('present', 'absent', 'on_leave');

-- CreateEnum
CREATE TYPE "StudentLeaveType" AS ENUM ('weekend', 'emergency', 'medical', 'family', 'other');

-- CreateEnum
CREATE TYPE "StudentLeaveStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "AbsenceAlertType" AS ENUM ('gate_exit_no_return', 'boarding_absent', 'consecutive_absent', 'leave_overdue', 'unauthorized_exit');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('active', 'resolved');

-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('parent_guardian', 'organization');

-- CreateEnum
CREATE TYPE "VisitorPurpose" AS ENUM ('parent_visit', 'official_business', 'delivery', 'inspection', 'other');

-- CreateEnum
CREATE TYPE "VisitorAppointmentStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "FeeAssignmentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'waived', 'overdue');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'mtn_momo', 'airtel_money', 'bank_transfer', 'cheque', 'other');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('cat', 'main_exam', 'mock', 'quiz', 'assignment');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('parent', 'student', 'staff', 'admin', 'school');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'email', 'push', 'in_app');

-- CreateEnum
CREATE TYPE "NotificationLanguage" AS ENUM ('en', 'kin');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'retry');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('platform_user', 'school_user', 'system', 'api');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "SystemSettingType" AS ENUM ('string', 'integer', 'boolean', 'json');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('tablet', 'kiosk', 'web');

-- CreateEnum
CREATE TYPE "DeviceMode" AS ENUM ('gate', 'boarding', 'classroom');

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price_monthly" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price_annual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "student_limit" INTEGER NOT NULL DEFAULT 0,
    "staff_limit" INTEGER NOT NULL DEFAULT 0,
    "sms_bundle" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" BIGSERIAL NOT NULL,
    "uuid" CHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "school_type" "SchoolType" NOT NULL DEFAULT 'government',
    "province" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "sector" VARCHAR(100),
    "logo_url" VARCHAR(500),
    "website" VARCHAR(255),
    "principal_name" VARCHAR(255),
    "principal_phone" VARCHAR(20),
    "principal_email" VARCHAR(255),
    "school_phone" VARCHAR(20),
    "school_email" VARCHAR(255),
    "subscription_plan_id" BIGINT,
    "status" "SchoolStatus" NOT NULL DEFAULT 'trial',
    "trial_ends_at" TIMESTAMP(3),
    "grace_ends_at" TIMESTAMP(3),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Africa/Kigali',
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "has_boarding" BOOLEAN NOT NULL DEFAULT false,
    "has_biometrics" BOOLEAN NOT NULL DEFAULT false,
    "has_gate" BOOLEAN NOT NULL DEFAULT false,
    "has_visitor_mgmt" BOOLEAN NOT NULL DEFAULT false,
    "has_exam_system" BOOLEAN NOT NULL DEFAULT false,
    "has_salary_mgmt" BOOLEAN NOT NULL DEFAULT false,
    "has_parent_app" BOOLEAN NOT NULL DEFAULT false,
    "has_bulk_sms" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "status" "SchoolSubscriptionStatus" NOT NULL DEFAULT 'pending',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "grace_ends_at" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" BIGSERIAL NOT NULL,
    "invoice_number" VARCHAR(30) NOT NULL,
    "school_id" BIGINT NOT NULL,
    "subscription_id" BIGINT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "paid_at" TIMESTAMP(3),
    "payment_method" VARCHAR(50),
    "payment_ref" VARCHAR(100),
    "notes" TEXT,
    "pdf_url" VARCHAR(500),
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_users" (
    "id" BIGSERIAL NOT NULL,
    "uuid" CHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "PlatformUserRole" NOT NULL DEFAULT 'support',
    "access_scope" "PlatformUserAccessScope" NOT NULL DEFAULT 'all',
    "permissions" JSONB,
    "status" "PlatformUserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_school_assignments" (
    "id" BIGSERIAL NOT NULL,
    "platform_user_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_user_school_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'info',
    "target_scope" "AnnouncementTargetScope" NOT NULL DEFAULT 'all',
    "target_values" JSONB,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "send_inapp" BOOLEAN NOT NULL DEFAULT true,
    "send_email" BOOLEAN NOT NULL DEFAULT false,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" BIGSERIAL NOT NULL,
    "announcement_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" BIGSERIAL NOT NULL,
    "ticket_number" VARCHAR(20) NOT NULL,
    "school_id" BIGINT NOT NULL,
    "opened_by" BIGINT,
    "assigned_to" BIGINT,
    "subject" VARCHAR(255) NOT NULL,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'technical',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'medium',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" BIGINT NOT NULL,
    "sender_type" "SupportTicketSenderType" NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "uuid" CHAR(36) NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "avatar_url" VARCHAR(500),
    "last_login_at" TIMESTAMP(3),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "permissions" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "platform_user_id" BIGINT,
    "school_id" BIGINT,
    "token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "academic_year_id" BIGINT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "academic_year_id" BIGINT,
    "name" VARCHAR(20) NOT NULL,
    "level" SMALLINT NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "class_id" BIGINT NOT NULL,
    "name" VARCHAR(10) NOT NULL,
    "full_name" VARCHAR(20) NOT NULL,
    "class_teacher_id" BIGINT,
    "capacity" SMALLINT NOT NULL DEFAULT 40,
    "room" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20),
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_section_subjects" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "term_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teacher_section_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_periods" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "is_break" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "timetable_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "period_id" BIGINT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "room" VARCHAR(50),
    "term_id" BIGINT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "type" "HolidayType" NOT NULL DEFAULT 'school',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" BIGSERIAL NOT NULL,
    "uuid" CHAR(36) NOT NULL,
    "school_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "student_id_number" VARCHAR(30),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "other_names" VARCHAR(100),
    "combination" VARCHAR(20),
    "date_of_birth" DATE,
    "gender" "Gender",
    "national_id" VARCHAR(30),
    "nationality" VARCHAR(50) NOT NULL DEFAULT 'Rwandan',
    "religion" VARCHAR(50),
    "blood_group" VARCHAR(5),
    "photo_url" VARCHAR(500),
    "address" TEXT,
    "previous_school" VARCHAR(255),
    "admission_date" DATE,
    "student_type" "StudentType" NOT NULL DEFAULT 'day',
    "status" "StudentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_section_enrollments" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "term_id" BIGINT,
    "academic_year_id" BIGINT NOT NULL,
    "enrolled_at" DATE NOT NULL,
    "left_at" DATE,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "student_section_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents_guardians" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "phone_alt" VARCHAR(20),
    "email" VARCHAR(255),
    "national_id" VARCHAR(30),
    "relationship" VARCHAR(50) NOT NULL,
    "address" TEXT,
    "occupation" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parents_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_parent_links" (
    "id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "parent_id" BIGINT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "student_parent_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_enrollments" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "type" "BiometricType" NOT NULL,
    "template_hash" VARCHAR(500),
    "card_uid" VARCHAR(100),
    "enrolled_by" BIGINT,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "biometric_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "staff_id_number" VARCHAR(30),
    "gender" "Gender",
    "department" VARCHAR(100),
    "contract_type" "StaffContractType",
    "join_date" DATE,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'active',
    "subjects" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leave_balances" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "staff_id" BIGINT NOT NULL,
    "academic_year_id" BIGINT NOT NULL,
    "annual_days" SMALLINT NOT NULL DEFAULT 21,
    "sick_days" SMALLINT NOT NULL DEFAULT 10,
    "emergency_days" SMALLINT NOT NULL DEFAULT 3,
    "annual_used" SMALLINT NOT NULL DEFAULT 0,
    "sick_used" SMALLINT NOT NULL DEFAULT 0,
    "emergency_used" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "staff_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_records" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "staff_id" BIGINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "year" SMALLINT NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(12,2) NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "payment_method" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "subject_id" BIGINT,
    "teacher_id" BIGINT,
    "period_id" BIGINT,
    "session_date" DATE NOT NULL,
    "session_type" "AttendanceSessionType" NOT NULL DEFAULT 'class',
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "session_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'absent',
    "scan_method" "ScanMethod" NOT NULL DEFAULT 'manual',
    "scanned_at" TIMESTAMP(3),
    "notes" VARCHAR(255),
    "marked_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_logs" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT,
    "visitor_id" BIGINT,
    "user_id" BIGINT,
    "event_type" "GateEventType" NOT NULL,
    "scan_method" "ScanMethod" NOT NULL DEFAULT 'manual',
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_id" VARCHAR(50),
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" VARCHAR(255),
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_queue" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "device_id" VARCHAR(50) NOT NULL,
    "record_type" "OfflineRecordType" NOT NULL,
    "payload" JSONB NOT NULL,
    "local_id" VARCHAR(100) NOT NULL,
    "status" "OfflineSyncStatus" NOT NULL DEFAULT 'pending',
    "retry_count" SMALLINT NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dormitories" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "gender" "DormGender" NOT NULL DEFAULT 'male',
    "capacity" SMALLINT NOT NULL DEFAULT 60,
    "supervisor_id" BIGINT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dormitories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dorm_rooms" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "dormitory_id" BIGINT NOT NULL,
    "room_number" VARCHAR(20) NOT NULL,
    "capacity" SMALLINT NOT NULL DEFAULT 6,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dorm_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_dorm_assignments" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "dormitory_id" BIGINT NOT NULL,
    "room_id" BIGINT,
    "bed_number" VARCHAR(10),
    "academic_year_id" BIGINT NOT NULL,
    "assigned_at" DATE NOT NULL,
    "left_at" DATE,

    CONSTRAINT "student_dorm_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boarding_roll_calls" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "dormitory_id" BIGINT NOT NULL,
    "roll_date" DATE NOT NULL,
    "session_type" "BoardingSessionType" NOT NULL,
    "conducted_by" BIGINT,
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boarding_roll_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boarding_roll_call_records" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "roll_call_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "status" "BoardingRollStatus" NOT NULL DEFAULT 'present',
    "notes" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boarding_roll_call_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_leave_requests" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "parent_id" BIGINT,
    "leave_type" "StudentLeaveType" NOT NULL DEFAULT 'weekend',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "status" "StudentLeaveStatus" NOT NULL DEFAULT 'pending',
    "approved_by" BIGINT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "exited_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "is_unauthorized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absence_alerts" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "alert_type" "AbsenceAlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'medium',
    "status" "AlertStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "resolved_by" BIGINT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absence_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "national_id" VARCHAR(30),
    "organization" VARCHAR(255),
    "visitor_type" "VisitorType" NOT NULL DEFAULT 'organization',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_appointments" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "visitor_id" BIGINT NOT NULL,
    "student_id" BIGINT,
    "host_id" BIGINT,
    "purpose" "VisitorPurpose" NOT NULL DEFAULT 'other',
    "appointment_at" TIMESTAMP(3),
    "expected_duration_min" SMALLINT,
    "notes" TEXT,
    "status" "VisitorAppointmentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_visits" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "visitor_id" BIGINT NOT NULL,
    "appointment_id" BIGINT,
    "student_id" BIGINT,
    "host_id" BIGINT,
    "checked_in_by" BIGINT,
    "checked_out_by" BIGINT,
    "purpose" VARCHAR(100),
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_out_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "notes" TEXT,
    "badge_printed" BOOLEAN NOT NULL DEFAULT false,
    "sms_sent_host" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "visitor_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structures" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "academic_year_id" BIGINT NOT NULL,
    "term_id" BIGINT,
    "class_id" BIGINT,
    "name" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "due_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fee_assignments" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "fee_structure_id" BIGINT NOT NULL,
    "amount_due" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FeeAssignmentStatus" NOT NULL DEFAULT 'unpaid',
    "due_date" DATE,
    "waiver_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_fee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_transactions" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "fee_assignment_id" BIGINT,
    "receipt_number" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "payment_ref" VARCHAR(100),
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" BIGINT,
    "notes" TEXT,
    "receipt_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "section_id" BIGINT,
    "subject_id" BIGINT NOT NULL,
    "teacher_id" BIGINT,
    "term_id" BIGINT,
    "name" VARCHAR(255) NOT NULL,
    "type" "ExamType" NOT NULL DEFAULT 'cat',
    "exam_date" DATE,
    "start_time" TIME,
    "duration_min" SMALLINT,
    "max_marks" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "pass_mark" DECIMAL(6,2) NOT NULL DEFAULT 50,
    "status" "ExamStatus" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "exam_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "marks_obtained" DECIMAL(6,2),
    "grade" VARCHAR(5),
    "grade_label" VARCHAR(30),
    "is_absent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" VARCHAR(255),
    "entered_by" BIGINT,
    "entered_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_providers" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(30) NOT NULL,
    "api_key_masked" VARCHAR(100),
    "sender_id" VARCHAR(20),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" SMALLINT NOT NULL DEFAULT 1,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "trigger_type" VARCHAR(50) NOT NULL,
    "body_en" TEXT NOT NULL,
    "body_kin" TEXT,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "template_id" BIGINT,
    "recipient_type" "NotificationRecipientType" NOT NULL,
    "recipient_id" BIGINT,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "channel" "NotificationChannel" NOT NULL DEFAULT 'sms',
    "trigger_type" VARCHAR(50),
    "body_en" TEXT,
    "body_kin" TEXT,
    "language_sent" "NotificationLanguage",
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "provider_id" BIGINT,
    "provider_ref" VARCHAR(100),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "retry_count" SMALLINT NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT,
    "actor_type" "AuditActorType" NOT NULL DEFAULT 'school_user',
    "actor_id" BIGINT,
    "actor_name" VARCHAR(255),
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" BIGINT,
    "resource_name" VARCHAR(255),
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "severity" "AuditSeverity" NOT NULL DEFAULT 'info',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" BIGSERIAL NOT NULL,
    "thread_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "sender_id" BIGINT,
    "body" TEXT NOT NULL,
    "body_kin" TEXT,
    "is_sms" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" BIGSERIAL NOT NULL,
    "key_name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_beta" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT,
    "key_name" VARCHAR(100) NOT NULL,
    "value" TEXT,
    "type" "SystemSettingType" NOT NULL DEFAULT 'string',
    "updated_by" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" BIGSERIAL NOT NULL,
    "school_id" BIGINT NOT NULL,
    "device_uid" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "DeviceType" NOT NULL DEFAULT 'tablet',
    "location" VARCHAR(100),
    "mode" "DeviceMode" NOT NULL DEFAULT 'gate',
    "pin_hash" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "firmware_version" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_plans_created_at_idx" ON "subscription_plans"("created_at");

-- CreateIndex
CREATE INDEX "subscription_plans_updated_at_idx" ON "subscription_plans"("updated_at");

-- CreateIndex
CREATE INDEX "subscription_plans_deleted_at_idx" ON "subscription_plans"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "schools_uuid_key" ON "schools"("uuid");

-- CreateIndex
CREATE INDEX "schools_status_idx" ON "schools"("status");

-- CreateIndex
CREATE INDEX "schools_province_idx" ON "schools"("province");

-- CreateIndex
CREATE INDEX "schools_trial_ends_at_idx" ON "schools"("trial_ends_at");

-- CreateIndex
CREATE INDEX "schools_grace_ends_at_idx" ON "schools"("grace_ends_at");

-- CreateIndex
CREATE INDEX "schools_created_at_idx" ON "schools"("created_at");

-- CreateIndex
CREATE INDEX "schools_updated_at_idx" ON "schools"("updated_at");

-- CreateIndex
CREATE INDEX "schools_deleted_at_idx" ON "schools"("deleted_at");

-- CreateIndex
CREATE INDEX "school_subscriptions_school_id_idx" ON "school_subscriptions"("school_id");

-- CreateIndex
CREATE INDEX "school_subscriptions_status_idx" ON "school_subscriptions"("status");

-- CreateIndex
CREATE INDEX "school_subscriptions_starts_at_idx" ON "school_subscriptions"("starts_at");

-- CreateIndex
CREATE INDEX "school_subscriptions_ends_at_idx" ON "school_subscriptions"("ends_at");

-- CreateIndex
CREATE INDEX "school_subscriptions_trial_ends_at_idx" ON "school_subscriptions"("trial_ends_at");

-- CreateIndex
CREATE INDEX "school_subscriptions_grace_ends_at_idx" ON "school_subscriptions"("grace_ends_at");

-- CreateIndex
CREATE INDEX "school_subscriptions_cancelled_at_idx" ON "school_subscriptions"("cancelled_at");

-- CreateIndex
CREATE INDEX "school_subscriptions_created_at_idx" ON "school_subscriptions"("created_at");

-- CreateIndex
CREATE INDEX "school_subscriptions_updated_at_idx" ON "school_subscriptions"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_school_id_idx" ON "invoices"("school_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_period_start_idx" ON "invoices"("period_start");

-- CreateIndex
CREATE INDEX "invoices_period_end_idx" ON "invoices"("period_end");

-- CreateIndex
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoices_paid_at_idx" ON "invoices"("paid_at");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoices_updated_at_idx" ON "invoices"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_uuid_key" ON "platform_users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE INDEX "platform_users_status_idx" ON "platform_users"("status");

-- CreateIndex
CREATE INDEX "platform_users_last_login_at_idx" ON "platform_users"("last_login_at");

-- CreateIndex
CREATE INDEX "platform_users_created_at_idx" ON "platform_users"("created_at");

-- CreateIndex
CREATE INDEX "platform_users_updated_at_idx" ON "platform_users"("updated_at");

-- CreateIndex
CREATE INDEX "platform_users_deleted_at_idx" ON "platform_users"("deleted_at");

-- CreateIndex
CREATE INDEX "platform_user_school_assignments_school_id_idx" ON "platform_user_school_assignments"("school_id");

-- CreateIndex
CREATE INDEX "platform_user_school_assignments_created_at_idx" ON "platform_user_school_assignments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_school_assignments_platform_user_id_school_id_key" ON "platform_user_school_assignments"("platform_user_id", "school_id");

-- CreateIndex
CREATE INDEX "announcements_status_idx" ON "announcements"("status");

-- CreateIndex
CREATE INDEX "announcements_scheduled_at_idx" ON "announcements"("scheduled_at");

-- CreateIndex
CREATE INDEX "announcements_sent_at_idx" ON "announcements"("sent_at");

-- CreateIndex
CREATE INDEX "announcements_created_at_idx" ON "announcements"("created_at");

-- CreateIndex
CREATE INDEX "announcements_updated_at_idx" ON "announcements"("updated_at");

-- CreateIndex
CREATE INDEX "announcement_reads_school_id_idx" ON "announcement_reads"("school_id");

-- CreateIndex
CREATE INDEX "announcement_reads_read_at_idx" ON "announcement_reads"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_school_id_key" ON "announcement_reads"("announcement_id", "school_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_school_id_idx" ON "support_tickets"("school_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_resolved_at_idx" ON "support_tickets"("resolved_at");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE INDEX "support_tickets_updated_at_idx" ON "support_tickets"("updated_at");

-- CreateIndex
CREATE INDEX "support_ticket_messages_created_at_idx" ON "support_ticket_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE INDEX "users_school_id_idx" ON "users"("school_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_updated_at_idx" ON "users"("updated_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_school_id_email_key" ON "users"("school_id", "email");

-- CreateIndex
CREATE INDEX "roles_school_id_idx" ON "roles"("school_id");

-- CreateIndex
CREATE INDEX "roles_created_at_idx" ON "roles"("created_at");

-- CreateIndex
CREATE INDEX "roles_updated_at_idx" ON "roles"("updated_at");

-- CreateIndex
CREATE INDEX "roles_deleted_at_idx" ON "roles"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_school_id_slug_key" ON "roles"("school_id", "slug");

-- CreateIndex
CREATE INDEX "user_roles_school_id_idx" ON "user_roles"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_platform_user_id_idx" ON "sessions"("platform_user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_revoked_at_idx" ON "sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "sessions_created_at_idx" ON "sessions"("created_at");

-- CreateIndex
CREATE INDEX "academic_years_school_id_idx" ON "academic_years"("school_id");

-- CreateIndex
CREATE INDEX "academic_years_start_date_idx" ON "academic_years"("start_date");

-- CreateIndex
CREATE INDEX "academic_years_end_date_idx" ON "academic_years"("end_date");

-- CreateIndex
CREATE INDEX "academic_years_created_at_idx" ON "academic_years"("created_at");

-- CreateIndex
CREATE INDEX "academic_years_deleted_at_idx" ON "academic_years"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_school_id_name_key" ON "academic_years"("school_id", "name");

-- CreateIndex
CREATE INDEX "terms_school_id_idx" ON "terms"("school_id");

-- CreateIndex
CREATE INDEX "terms_start_date_idx" ON "terms"("start_date");

-- CreateIndex
CREATE INDEX "terms_end_date_idx" ON "terms"("end_date");

-- CreateIndex
CREATE INDEX "terms_created_at_idx" ON "terms"("created_at");

-- CreateIndex
CREATE INDEX "terms_deleted_at_idx" ON "terms"("deleted_at");

-- CreateIndex
CREATE INDEX "classes_school_id_idx" ON "classes"("school_id");

-- CreateIndex
CREATE INDEX "classes_created_at_idx" ON "classes"("created_at");

-- CreateIndex
CREATE INDEX "classes_deleted_at_idx" ON "classes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "classes_school_id_name_academic_year_id_key" ON "classes"("school_id", "name", "academic_year_id");

-- CreateIndex
CREATE INDEX "sections_school_id_idx" ON "sections"("school_id");

-- CreateIndex
CREATE INDEX "sections_created_at_idx" ON "sections"("created_at");

-- CreateIndex
CREATE INDEX "sections_deleted_at_idx" ON "sections"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sections_school_id_class_id_name_key" ON "sections"("school_id", "class_id", "name");

-- CreateIndex
CREATE INDEX "subjects_school_id_idx" ON "subjects"("school_id");

-- CreateIndex
CREATE INDEX "subjects_created_at_idx" ON "subjects"("created_at");

-- CreateIndex
CREATE INDEX "subjects_deleted_at_idx" ON "subjects"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_school_id_name_key" ON "subjects"("school_id", "name");

-- CreateIndex
CREATE INDEX "teacher_section_subjects_school_id_idx" ON "teacher_section_subjects"("school_id");

-- CreateIndex
CREATE INDEX "teacher_section_subjects_created_at_idx" ON "teacher_section_subjects"("created_at");

-- CreateIndex
CREATE INDEX "teacher_section_subjects_deleted_at_idx" ON "teacher_section_subjects"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_section_subjects_teacher_id_section_id_subject_id_t_key" ON "teacher_section_subjects"("teacher_id", "section_id", "subject_id", "term_id");

-- CreateIndex
CREATE INDEX "timetable_periods_school_id_idx" ON "timetable_periods"("school_id");

-- CreateIndex
CREATE INDEX "timetable_periods_deleted_at_idx" ON "timetable_periods"("deleted_at");

-- CreateIndex
CREATE INDEX "timetable_slots_school_id_idx" ON "timetable_slots"("school_id");

-- CreateIndex
CREATE INDEX "timetable_slots_deleted_at_idx" ON "timetable_slots"("deleted_at");

-- CreateIndex
CREATE INDEX "holidays_school_id_idx" ON "holidays"("school_id");

-- CreateIndex
CREATE INDEX "holidays_start_date_idx" ON "holidays"("start_date");

-- CreateIndex
CREATE INDEX "holidays_end_date_idx" ON "holidays"("end_date");

-- CreateIndex
CREATE INDEX "holidays_created_at_idx" ON "holidays"("created_at");

-- CreateIndex
CREATE INDEX "holidays_deleted_at_idx" ON "holidays"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "students_uuid_key" ON "students"("uuid");

-- CreateIndex
CREATE INDEX "students_school_id_idx" ON "students"("school_id");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE INDEX "students_student_type_idx" ON "students"("student_type");

-- CreateIndex
CREATE INDEX "students_date_of_birth_idx" ON "students"("date_of_birth");

-- CreateIndex
CREATE INDEX "students_admission_date_idx" ON "students"("admission_date");

-- CreateIndex
CREATE INDEX "students_created_at_idx" ON "students"("created_at");

-- CreateIndex
CREATE INDEX "students_updated_at_idx" ON "students"("updated_at");

-- CreateIndex
CREATE INDEX "students_deleted_at_idx" ON "students"("deleted_at");

-- CreateIndex
CREATE INDEX "student_section_enrollments_school_id_idx" ON "student_section_enrollments"("school_id");

-- CreateIndex
CREATE INDEX "student_section_enrollments_status_idx" ON "student_section_enrollments"("status");

-- CreateIndex
CREATE INDEX "student_section_enrollments_enrolled_at_idx" ON "student_section_enrollments"("enrolled_at");

-- CreateIndex
CREATE INDEX "student_section_enrollments_left_at_idx" ON "student_section_enrollments"("left_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_section_enrollments_student_id_section_id_academic__key" ON "student_section_enrollments"("student_id", "section_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "parents_guardians_school_id_idx" ON "parents_guardians"("school_id");

-- CreateIndex
CREATE INDEX "parents_guardians_created_at_idx" ON "parents_guardians"("created_at");

-- CreateIndex
CREATE INDEX "parents_guardians_updated_at_idx" ON "parents_guardians"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_parent_links_student_id_parent_id_key" ON "student_parent_links"("student_id", "parent_id");

-- CreateIndex
CREATE INDEX "biometric_enrollments_school_id_idx" ON "biometric_enrollments"("school_id");

-- CreateIndex
CREATE INDEX "biometric_enrollments_student_id_idx" ON "biometric_enrollments"("student_id");

-- CreateIndex
CREATE INDEX "biometric_enrollments_card_uid_idx" ON "biometric_enrollments"("card_uid");

-- CreateIndex
CREATE INDEX "biometric_enrollments_enrolled_at_idx" ON "biometric_enrollments"("enrolled_at");

-- CreateIndex
CREATE INDEX "staff_profiles_school_id_idx" ON "staff_profiles"("school_id");

-- CreateIndex
CREATE INDEX "staff_profiles_employment_status_idx" ON "staff_profiles"("employment_status");

-- CreateIndex
CREATE INDEX "staff_profiles_department_idx" ON "staff_profiles"("department");

-- CreateIndex
CREATE INDEX "staff_profiles_join_date_idx" ON "staff_profiles"("join_date");

-- CreateIndex
CREATE INDEX "staff_profiles_created_at_idx" ON "staff_profiles"("created_at");

-- CreateIndex
CREATE INDEX "staff_profiles_updated_at_idx" ON "staff_profiles"("updated_at");

-- CreateIndex
CREATE INDEX "staff_profiles_deleted_at_idx" ON "staff_profiles"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_school_id_staff_id_number_key" ON "staff_profiles"("school_id", "staff_id_number");

-- CreateIndex
CREATE INDEX "staff_leave_balances_school_id_idx" ON "staff_leave_balances"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_leave_balances_staff_id_academic_year_id_key" ON "staff_leave_balances"("staff_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "salary_records_school_id_idx" ON "salary_records"("school_id");

-- CreateIndex
CREATE INDEX "salary_records_status_idx" ON "salary_records"("status");

-- CreateIndex
CREATE INDEX "salary_records_paid_at_idx" ON "salary_records"("paid_at");

-- CreateIndex
CREATE INDEX "salary_records_created_at_idx" ON "salary_records"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "salary_records_staff_id_month_year_key" ON "salary_records"("staff_id", "month", "year");

-- CreateIndex
CREATE INDEX "attendance_sessions_school_id_session_date_idx" ON "attendance_sessions"("school_id", "session_date");

-- CreateIndex
CREATE INDEX "attendance_sessions_section_id_idx" ON "attendance_sessions"("section_id");

-- CreateIndex
CREATE INDEX "attendance_sessions_started_at_idx" ON "attendance_sessions"("started_at");

-- CreateIndex
CREATE INDEX "attendance_sessions_submitted_at_idx" ON "attendance_sessions"("submitted_at");

-- CreateIndex
CREATE INDEX "attendance_sessions_created_at_idx" ON "attendance_sessions"("created_at");

-- CreateIndex
CREATE INDEX "attendance_records_student_id_idx" ON "attendance_records"("student_id");

-- CreateIndex
CREATE INDEX "attendance_records_session_id_idx" ON "attendance_records"("session_id");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE INDEX "attendance_records_school_id_scanned_at_idx" ON "attendance_records"("school_id", "scanned_at");

-- CreateIndex
CREATE INDEX "attendance_records_created_at_idx" ON "attendance_records"("created_at");

-- CreateIndex
CREATE INDEX "attendance_records_updated_at_idx" ON "attendance_records"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key" ON "attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "gate_logs_school_id_scanned_at_idx" ON "gate_logs"("school_id", "scanned_at");

-- CreateIndex
CREATE INDEX "gate_logs_student_id_idx" ON "gate_logs"("student_id");

-- CreateIndex
CREATE INDEX "gate_logs_is_flagged_idx" ON "gate_logs"("is_flagged");

-- CreateIndex
CREATE INDEX "gate_logs_synced_at_idx" ON "gate_logs"("synced_at");

-- CreateIndex
CREATE INDEX "gate_logs_created_at_idx" ON "gate_logs"("created_at");

-- CreateIndex
CREATE INDEX "offline_sync_queue_status_idx" ON "offline_sync_queue"("status");

-- CreateIndex
CREATE INDEX "offline_sync_queue_school_id_idx" ON "offline_sync_queue"("school_id");

-- CreateIndex
CREATE INDEX "offline_sync_queue_synced_at_idx" ON "offline_sync_queue"("synced_at");

-- CreateIndex
CREATE INDEX "offline_sync_queue_created_at_idx" ON "offline_sync_queue"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_sync_queue_device_id_local_id_key" ON "offline_sync_queue"("device_id", "local_id");

-- CreateIndex
CREATE INDEX "dormitories_school_id_idx" ON "dormitories"("school_id");

-- CreateIndex
CREATE INDEX "dormitories_created_at_idx" ON "dormitories"("created_at");

-- CreateIndex
CREATE INDEX "dorm_rooms_school_id_idx" ON "dorm_rooms"("school_id");

-- CreateIndex
CREATE INDEX "dorm_rooms_created_at_idx" ON "dorm_rooms"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "dorm_rooms_dormitory_id_room_number_key" ON "dorm_rooms"("dormitory_id", "room_number");

-- CreateIndex
CREATE INDEX "student_dorm_assignments_school_id_idx" ON "student_dorm_assignments"("school_id");

-- CreateIndex
CREATE INDEX "student_dorm_assignments_assigned_at_idx" ON "student_dorm_assignments"("assigned_at");

-- CreateIndex
CREATE INDEX "student_dorm_assignments_left_at_idx" ON "student_dorm_assignments"("left_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_dorm_assignments_student_id_academic_year_id_key" ON "student_dorm_assignments"("student_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "boarding_roll_calls_school_id_idx" ON "boarding_roll_calls"("school_id");

-- CreateIndex
CREATE INDEX "boarding_roll_calls_roll_date_idx" ON "boarding_roll_calls"("roll_date");

-- CreateIndex
CREATE INDEX "boarding_roll_calls_submitted_at_idx" ON "boarding_roll_calls"("submitted_at");

-- CreateIndex
CREATE INDEX "boarding_roll_calls_created_at_idx" ON "boarding_roll_calls"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "boarding_roll_calls_dormitory_id_roll_date_session_type_key" ON "boarding_roll_calls"("dormitory_id", "roll_date", "session_type");

-- CreateIndex
CREATE INDEX "boarding_roll_call_records_school_id_idx" ON "boarding_roll_call_records"("school_id");

-- CreateIndex
CREATE INDEX "boarding_roll_call_records_created_at_idx" ON "boarding_roll_call_records"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "boarding_roll_call_records_roll_call_id_student_id_key" ON "boarding_roll_call_records"("roll_call_id", "student_id");

-- CreateIndex
CREATE INDEX "student_leave_requests_status_idx" ON "student_leave_requests"("status");

-- CreateIndex
CREATE INDEX "student_leave_requests_student_id_idx" ON "student_leave_requests"("student_id");

-- CreateIndex
CREATE INDEX "student_leave_requests_school_id_idx" ON "student_leave_requests"("school_id");

-- CreateIndex
CREATE INDEX "student_leave_requests_start_date_idx" ON "student_leave_requests"("start_date");

-- CreateIndex
CREATE INDEX "student_leave_requests_end_date_idx" ON "student_leave_requests"("end_date");

-- CreateIndex
CREATE INDEX "student_leave_requests_approved_at_idx" ON "student_leave_requests"("approved_at");

-- CreateIndex
CREATE INDEX "student_leave_requests_exited_at_idx" ON "student_leave_requests"("exited_at");

-- CreateIndex
CREATE INDEX "student_leave_requests_returned_at_idx" ON "student_leave_requests"("returned_at");

-- CreateIndex
CREATE INDEX "student_leave_requests_created_at_idx" ON "student_leave_requests"("created_at");

-- CreateIndex
CREATE INDEX "student_leave_requests_updated_at_idx" ON "student_leave_requests"("updated_at");

-- CreateIndex
CREATE INDEX "absence_alerts_status_idx" ON "absence_alerts"("status");

-- CreateIndex
CREATE INDEX "absence_alerts_student_id_idx" ON "absence_alerts"("student_id");

-- CreateIndex
CREATE INDEX "absence_alerts_school_id_idx" ON "absence_alerts"("school_id");

-- CreateIndex
CREATE INDEX "absence_alerts_resolved_at_idx" ON "absence_alerts"("resolved_at");

-- CreateIndex
CREATE INDEX "absence_alerts_created_at_idx" ON "absence_alerts"("created_at");

-- CreateIndex
CREATE INDEX "visitors_school_id_idx" ON "visitors"("school_id");

-- CreateIndex
CREATE INDEX "visitors_created_at_idx" ON "visitors"("created_at");

-- CreateIndex
CREATE INDEX "visitor_appointments_student_id_idx" ON "visitor_appointments"("student_id");

-- CreateIndex
CREATE INDEX "visitor_appointments_status_idx" ON "visitor_appointments"("status");

-- CreateIndex
CREATE INDEX "visitor_appointments_school_id_idx" ON "visitor_appointments"("school_id");

-- CreateIndex
CREATE INDEX "visitor_appointments_appointment_at_idx" ON "visitor_appointments"("appointment_at");

-- CreateIndex
CREATE INDEX "visitor_appointments_created_at_idx" ON "visitor_appointments"("created_at");

-- CreateIndex
CREATE INDEX "visitor_visits_school_id_checked_in_at_idx" ON "visitor_visits"("school_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "visitor_visits_visitor_id_idx" ON "visitor_visits"("visitor_id");

-- CreateIndex
CREATE INDEX "visitor_visits_student_id_idx" ON "visitor_visits"("student_id");

-- CreateIndex
CREATE INDEX "visitor_visits_expected_out_at_idx" ON "visitor_visits"("expected_out_at");

-- CreateIndex
CREATE INDEX "visitor_visits_checked_out_at_idx" ON "visitor_visits"("checked_out_at");

-- CreateIndex
CREATE INDEX "fee_structures_school_id_idx" ON "fee_structures"("school_id");

-- CreateIndex
CREATE INDEX "fee_structures_due_date_idx" ON "fee_structures"("due_date");

-- CreateIndex
CREATE INDEX "fee_structures_created_at_idx" ON "fee_structures"("created_at");

-- CreateIndex
CREATE INDEX "fee_structures_updated_at_idx" ON "fee_structures"("updated_at");

-- CreateIndex
CREATE INDEX "student_fee_assignments_student_id_idx" ON "student_fee_assignments"("student_id");

-- CreateIndex
CREATE INDEX "student_fee_assignments_status_idx" ON "student_fee_assignments"("status");

-- CreateIndex
CREATE INDEX "student_fee_assignments_school_id_idx" ON "student_fee_assignments"("school_id");

-- CreateIndex
CREATE INDEX "student_fee_assignments_due_date_idx" ON "student_fee_assignments"("due_date");

-- CreateIndex
CREATE INDEX "student_fee_assignments_created_at_idx" ON "student_fee_assignments"("created_at");

-- CreateIndex
CREATE INDEX "student_fee_assignments_updated_at_idx" ON "student_fee_assignments"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "fee_transactions_receipt_number_key" ON "fee_transactions"("receipt_number");

-- CreateIndex
CREATE INDEX "fee_transactions_student_id_idx" ON "fee_transactions"("student_id");

-- CreateIndex
CREATE INDEX "fee_transactions_paid_at_idx" ON "fee_transactions"("paid_at");

-- CreateIndex
CREATE INDEX "fee_transactions_school_id_idx" ON "fee_transactions"("school_id");

-- CreateIndex
CREATE INDEX "fee_transactions_created_at_idx" ON "fee_transactions"("created_at");

-- CreateIndex
CREATE INDEX "exams_school_id_idx" ON "exams"("school_id");

-- CreateIndex
CREATE INDEX "exams_status_idx" ON "exams"("status");

-- CreateIndex
CREATE INDEX "exams_exam_date_idx" ON "exams"("exam_date");

-- CreateIndex
CREATE INDEX "exams_created_at_idx" ON "exams"("created_at");

-- CreateIndex
CREATE INDEX "exams_updated_at_idx" ON "exams"("updated_at");

-- CreateIndex
CREATE INDEX "exam_results_student_id_idx" ON "exam_results"("student_id");

-- CreateIndex
CREATE INDEX "exam_results_exam_id_idx" ON "exam_results"("exam_id");

-- CreateIndex
CREATE INDEX "exam_results_school_id_idx" ON "exam_results"("school_id");

-- CreateIndex
CREATE INDEX "exam_results_entered_at_idx" ON "exam_results"("entered_at");

-- CreateIndex
CREATE INDEX "exam_results_published_at_idx" ON "exam_results"("published_at");

-- CreateIndex
CREATE INDEX "exam_results_created_at_idx" ON "exam_results"("created_at");

-- CreateIndex
CREATE INDEX "exam_results_updated_at_idx" ON "exam_results"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "exam_results_exam_id_student_id_key" ON "exam_results"("exam_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_providers_slug_key" ON "sms_providers"("slug");

-- CreateIndex
CREATE INDEX "sms_providers_is_active_idx" ON "sms_providers"("is_active");

-- CreateIndex
CREATE INDEX "sms_providers_created_at_idx" ON "sms_providers"("created_at");

-- CreateIndex
CREATE INDEX "sms_providers_updated_at_idx" ON "sms_providers"("updated_at");

-- CreateIndex
CREATE INDEX "notification_templates_school_id_idx" ON "notification_templates"("school_id");

-- CreateIndex
CREATE INDEX "notification_templates_is_active_idx" ON "notification_templates"("is_active");

-- CreateIndex
CREATE INDEX "notification_templates_created_at_idx" ON "notification_templates"("created_at");

-- CreateIndex
CREATE INDEX "notification_templates_updated_at_idx" ON "notification_templates"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_school_id_slug_key" ON "notification_templates"("school_id", "slug");

-- CreateIndex
CREATE INDEX "notification_logs_school_id_idx" ON "notification_logs"("school_id");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "notification_logs_recipient_type_recipient_id_idx" ON "notification_logs"("recipient_type", "recipient_id");

-- CreateIndex
CREATE INDEX "notification_logs_sent_at_idx" ON "notification_logs"("sent_at");

-- CreateIndex
CREATE INDEX "notification_logs_delivered_at_idx" ON "notification_logs"("delivered_at");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_school_id_idx" ON "audit_logs"("school_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_type_actor_id_idx" ON "audit_logs"("actor_type", "actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "messages_thread_id_idx" ON "messages"("thread_id");

-- CreateIndex
CREATE INDEX "messages_school_id_idx" ON "messages"("school_id");

-- CreateIndex
CREATE INDEX "messages_read_at_idx" ON "messages"("read_at");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_name_key" ON "feature_flags"("key_name");

-- CreateIndex
CREATE INDEX "feature_flags_updated_at_idx" ON "feature_flags"("updated_at");

-- CreateIndex
CREATE INDEX "system_settings_school_id_idx" ON "system_settings"("school_id");

-- CreateIndex
CREATE INDEX "system_settings_updated_at_idx" ON "system_settings"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_school_id_key_name_key" ON "system_settings"("school_id", "key_name");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_uid_key" ON "devices"("device_uid");

-- CreateIndex
CREATE INDEX "devices_school_id_idx" ON "devices"("school_id");

-- CreateIndex
CREATE INDEX "devices_is_active_idx" ON "devices"("is_active");

-- CreateIndex
CREATE INDEX "devices_last_seen_at_idx" ON "devices"("last_seen_at");

-- CreateIndex
CREATE INDEX "devices_created_at_idx" ON "devices"("created_at");

-- CreateIndex
CREATE INDEX "devices_updated_at_idx" ON "devices"("updated_at");

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_subscriptions" ADD CONSTRAINT "school_subscriptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_subscriptions" ADD CONSTRAINT "school_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "school_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_school_assignments" ADD CONSTRAINT "platform_user_school_assignments_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_school_assignments" ADD CONSTRAINT "platform_user_school_assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_teacher_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_section_subjects" ADD CONSTRAINT "teacher_section_subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_section_subjects" ADD CONSTRAINT "teacher_section_subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_section_subjects" ADD CONSTRAINT "teacher_section_subjects_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_section_subjects" ADD CONSTRAINT "teacher_section_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_section_subjects" ADD CONSTRAINT "teacher_section_subjects_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "timetable_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_section_enrollments" ADD CONSTRAINT "student_section_enrollments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_section_enrollments" ADD CONSTRAINT "student_section_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_section_enrollments" ADD CONSTRAINT "student_section_enrollments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_section_enrollments" ADD CONSTRAINT "student_section_enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents_guardians" ADD CONSTRAINT "parents_guardians_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents_guardians" ADD CONSTRAINT "parents_guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parent_links" ADD CONSTRAINT "student_parent_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parent_links" ADD CONSTRAINT "student_parent_links_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents_guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_enrollments" ADD CONSTRAINT "biometric_enrollments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_enrollments" ADD CONSTRAINT "biometric_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_balances" ADD CONSTRAINT "staff_leave_balances_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_balances" ADD CONSTRAINT "staff_leave_balances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_balances" ADD CONSTRAINT "staff_leave_balances_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "timetable_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_logs" ADD CONSTRAINT "gate_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_logs" ADD CONSTRAINT "gate_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dormitories" ADD CONSTRAINT "dormitories_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dormitories" ADD CONSTRAINT "dormitories_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dorm_rooms" ADD CONSTRAINT "dorm_rooms_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dorm_rooms" ADD CONSTRAINT "dorm_rooms_dormitory_id_fkey" FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dorm_assignments" ADD CONSTRAINT "student_dorm_assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dorm_assignments" ADD CONSTRAINT "student_dorm_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dorm_assignments" ADD CONSTRAINT "student_dorm_assignments_dormitory_id_fkey" FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dorm_assignments" ADD CONSTRAINT "student_dorm_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "dorm_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dorm_assignments" ADD CONSTRAINT "student_dorm_assignments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarding_roll_calls" ADD CONSTRAINT "boarding_roll_calls_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarding_roll_calls" ADD CONSTRAINT "boarding_roll_calls_dormitory_id_fkey" FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarding_roll_calls" ADD CONSTRAINT "boarding_roll_calls_conducted_by_fkey" FOREIGN KEY ("conducted_by") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarding_roll_call_records" ADD CONSTRAINT "boarding_roll_call_records_roll_call_id_fkey" FOREIGN KEY ("roll_call_id") REFERENCES "boarding_roll_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarding_roll_call_records" ADD CONSTRAINT "boarding_roll_call_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents_guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_alerts" ADD CONSTRAINT "absence_alerts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_alerts" ADD CONSTRAINT "absence_alerts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_alerts" ADD CONSTRAINT "absence_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_appointments" ADD CONSTRAINT "visitor_appointments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_appointments" ADD CONSTRAINT "visitor_appointments_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_appointments" ADD CONSTRAINT "visitor_appointments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_appointments" ADD CONSTRAINT "visitor_appointments_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "visitor_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_fee_assignment_id_fkey" FOREIGN KEY ("fee_assignment_id") REFERENCES "student_fee_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "sms_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
