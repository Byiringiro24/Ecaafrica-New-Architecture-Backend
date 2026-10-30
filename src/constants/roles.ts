export enum SchoolRole {
  SCHOOL_ADMIN = "school_admin",
  TEACHER = "teacher",
  STAFF = "staff",
  GATE_KEEPER = "gate_keeper",
  BOARDING_OFFICER = "boarding_officer",
  DIRECTOR_OF_DISCIPLINE = "director_of_discipline",
  DIRECTOR_OF_STUDIES = "director_of_studies",
  PATRON = "patron",
  MATRON = "matron",
  FINANCE_OFFICER = "finance_officer",
  PARENT = "parent",
  STUDENT = "student",
}

export enum PlatformRole {
  PLATFORM_ADMIN = "platform_admin",
  PLATFORM_SUPPORT = "platform_support",
}

export const SCHOOL_ROLES = [
  SchoolRole.SCHOOL_ADMIN,
  SchoolRole.TEACHER,
  SchoolRole.STAFF,
  SchoolRole.GATE_KEEPER,
  SchoolRole.DIRECTOR_OF_DISCIPLINE,
  SchoolRole.DIRECTOR_OF_STUDIES,
  SchoolRole.PATRON,
  SchoolRole.MATRON,
  SchoolRole.FINANCE_OFFICER,
  SchoolRole.PARENT,
  SchoolRole.STUDENT,
] as const;

/**
 * School roles that represent employees (as opposed to parents/students).
 */
export const STAFF_ROLES = [
  SchoolRole.SCHOOL_ADMIN,
  SchoolRole.TEACHER,
  SchoolRole.STAFF,
  SchoolRole.GATE_KEEPER,
  SchoolRole.DIRECTOR_OF_DISCIPLINE,
  SchoolRole.DIRECTOR_OF_STUDIES,
  SchoolRole.PATRON,
  SchoolRole.MATRON,
  SchoolRole.FINANCE_OFFICER
] as const;

/** Roles that have full boarding operations access. DOD is primary authority. */
export const BOARDING_ROLES = [
  SchoolRole.SCHOOL_ADMIN,
  SchoolRole.DIRECTOR_OF_DISCIPLINE,
  SchoolRole.PATRON,
  SchoolRole.MATRON,
] as const;

/** Only DOD (and school admin) can approve/reject leave */
export const LEAVE_APPROVAL_ROLES = [
  SchoolRole.SCHOOL_ADMIN,
  SchoolRole.DIRECTOR_OF_DISCIPLINE
] as const;

export const isStaffRole = (role?: string | null): boolean =>
  Boolean(role && (STAFF_ROLES as readonly string[]).includes(role));

export const PLATFORM_ROLES = [
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.PLATFORM_SUPPORT,
] as const;

export const ALL_ROLES = [...SCHOOL_ROLES, ...PLATFORM_ROLES] as const;
