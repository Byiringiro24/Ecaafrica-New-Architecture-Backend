export const SchoolType = {
  GOVERNMENT: "government",
  PRIVATE: "private",
  INTERNATIONAL: "international",
  TECHNICAL: "technical",
  SEMINARY: "seminary",
  OTHER: "other",
} as const;

export const SchoolStatus = {
  ACTIVE: "active",
  TRIAL: "trial",
  GRACE: "grace",
  SUSPENDED: "suspended",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export const BillingCycle = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
  TERM: "term",
  WEEKLY: "weekly",
  DAILY: "daily",
} as const;

export const SchoolSubscriptionStatus = {
  ACTIVE: "active",
  TRIAL: "trial",
  GRACE: "grace",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  PENDING: "pending",
} as const;

export const InvoiceStatus = {
  DRAFT: "draft",
  ISSUED: "issued",
  PAID: "paid",
  OVERDUE: "overdue",
  VOID: "void",
  REFUNDED: "refunded",
} as const;

export const PlatformUserRole = {
  PLATFORM_ADMIN: "platform_admin",
  SUPPORT: "support",
} as const;

export const PlatformUserAccessScope = {
  ALL: "all",
  ASSIGNED: "assigned",
} as const;

export const PlatformUserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  LOCKED: "locked",
} as const;

export const AnnouncementType = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
  MAINTENANCE: "maintenance",
  FEATURE: "feature",
} as const;

export const AnnouncementTargetScope = {
  ALL: "all",
  PLAN: "plan",
  PROVINCE: "province",
  SPECIFIC: "specific",
} as const;

export const AnnouncementStatus = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  SENT: "sent",
} as const;

export const SupportTicketCategory = {
  TECHNICAL: "technical",
  BILLING: "billing",
  FEATURE_REQUEST: "feature_request",
  OTHER: "other",
} as const;

export const SupportTicketPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export const SupportTicketStatus = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;

export const SupportTicketSenderType = {
  SCHOOL_USER: "school_user",
  PLATFORM_USER: "platform_user",
} as const;

export const UserRole = {
  SCHOOL_ADMIN: "school_admin",
  TEACHER: "teacher",
  STAFF: "staff",
  GATE_KEEPER: "gate_keeper",
  DIRECTOR_OF_DISCIPLINE: "director_of_discipline",
  PATRON: "patron",
  MATRON: "matron",
  FINANCE_OFFICER: "finance_officer",
  PARENT: "parent",
  STUDENT: "student",
} as const;

export const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  LOCKED: "locked",
  PENDING: "pending",
} as const;

export const HolidayType = {
  NATIONAL: "national",
  SCHOOL: "school",
  EXAM: "exam",
  OTHER: "other",
} as const;

export const Gender = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
} as const;

export const StudentType = {
  BOARDING: "boarding",
  DAY: "day",
} as const;

export const StudentStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  TRANSFERRED: "transferred",
  GRADUATED: "graduated",
  EXPELLED: "expelled",
} as const;

export const EnrollmentStatus = {
  ACTIVE: "active",
  TRANSFERRED: "transferred",
  DROPPED: "dropped",
} as const;

export const BiometricType = {
  FACE: "face",
  FINGERPRINT: "fingerprint",
  CARD_NFC: "card_nfc",
  CARD_QR: "card_qr",
} as const;

export const StaffContractType = {
  PERMANENT: "permanent",
  CONTRACT: "contract",
  PART_TIME: "part_time",
} as const;

export const EmploymentStatus = {
  ACTIVE: "active",
  ON_LEAVE: "on_leave",
  INACTIVE: "inactive",
} as const;

export const SalaryStatus = {
  PENDING: "pending",
  PAID: "paid",
  CANCELLED: "cancelled",
} as const;

export const AttendanceSessionType = {
  CLASS: "class",
  GATE: "gate",
  BOARDING_MORNING: "boarding_morning",
  BOARDING_EVENING: "boarding_evening",
} as const;

export const AttendanceStatus = {
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
  EXCUSED: "excused",
} as const;

export const ScanMethod = {
  MANUAL: "manual",
  NFC: "nfc",
  QR: "qr",
  FACE: "face",
  FINGERPRINT: "fingerprint",
} as const;

export const GateEventType = {
  ENTRY: "entry",
  EXIT: "exit",
} as const;

export const OfflineRecordType = {
  GATE_LOG: "gate_log",
  ATTENDANCE_RECORD: "attendance_record",
  BOARDING_ROLL: "boarding_roll",
} as const;

export const OfflineSyncStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  SYNCED: "synced",
  FAILED: "failed",
} as const;

export const DormGender = {
  MALE: "male",
  FEMALE: "female",
} as const;

export const BoardingSessionType = {
  MORNING: "morning",
  EVENING: "evening",
} as const;

export const BoardingRollStatus = {
  PRESENT: "present",
  ABSENT: "absent",
  ON_LEAVE: "on_leave",
} as const;

export const StudentLeaveType = {
  WEEKEND: "weekend",
  EMERGENCY: "emergency",
  MEDICAL: "medical",
  FAMILY: "family",
  OTHER: "other",
} as const;

export const StudentLeaveStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export const AbsenceAlertType = {
  GATE_EXIT_NO_RETURN: "gate_exit_no_return",
  BOARDING_ABSENT: "boarding_absent",
  CONSECUTIVE_ABSENT: "consecutive_absent",
  LEAVE_OVERDUE: "leave_overdue",
  UNAUTHORIZED_EXIT: "unauthorized_exit",
} as const;

export const AlertSeverity = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export const AlertStatus = {
  ACTIVE: "active",
  RESOLVED: "resolved",
} as const;

export const VisitorType = {
  PARENT_GUARDIAN: "parent_guardian",
  ORGANIZATION: "organization",
} as const;

export const VisitorPurpose = {
  PARENT_VISIT: "parent_visit",
  OFFICIAL_BUSINESS: "official_business",
  DELIVERY: "delivery",
  INSPECTION: "inspection",
  OTHER: "other",
} as const;

export const VisitorAppointmentStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;

export const FeeAssignmentStatus = {
  UNPAID: "unpaid",
  PARTIAL: "partial",
  PAID: "paid",
  WAIVED: "waived",
  OVERDUE: "overdue",
} as const;

export const PaymentMethod = {
  CASH: "cash",
  MTN_MOMO: "mtn_momo",
  AIRTEL_MONEY: "airtel_money",
  BANK_TRANSFER: "bank_transfer",
  CHEQUE: "cheque",
  OTHER: "other",
} as const;

export const ExamType = {
  CAT: "cat",
  MAIN_EXAM: "main_exam",
  MOCK: "mock",
  QUIZ: "quiz",
  ASSIGNMENT: "assignment",
} as const;

export const ExamStatus = {
  SCHEDULED: "scheduled",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const NotificationRecipientType = {
  PARENT: "parent",
  STUDENT: "student",
  STAFF: "staff",
  ADMIN: "admin",
  SCHOOL: "school",
} as const;

export const NotificationChannel = {
  SMS: "sms",
  EMAIL: "email",
  PUSH: "push",
  IN_APP: "in_app",
} as const;

export const NotificationLanguage = {
  EN: "en",
  KIN: "kin",
} as const;

export const NotificationStatus = {
  QUEUED: "queued",
  SENT: "sent",
  DELIVERED: "delivered",
  FAILED: "failed",
  RETRY: "retry",
} as const;

export const AuditActorType = {
  PLATFORM_USER: "platform_user",
  SCHOOL_USER: "school_user",
  SYSTEM: "system",
  API: "api",
} as const;

export const AuditSeverity = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;

export const SystemSettingType = {
  STRING: "string",
  INTEGER: "integer",
  BOOLEAN: "boolean",
  JSON: "json",
} as const;

export const DeviceType = {
  TABLET: "tablet",
  KIOSK: "kiosk",
  WEB: "web",
} as const;

export const DeviceMode = {
  GATE: "gate",
  BOARDING: "boarding",
  CLASSROOM: "classroom",
} as const;
