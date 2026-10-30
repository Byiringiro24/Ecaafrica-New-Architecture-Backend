import { PlatformRole, SchoolRole } from "./roles";

export const PERMISSIONS = {
  school: {
    view: "school:view",
    manage: "school:manage",
  },
  users: {
    view: "users:view",
    invite: "users:invite",
    manage: "users:manage",
    roles: "users:roles:manage",
  },
  roles: {
    view: "roles:view",
    manage: "roles:manage",
  },
  classes: {
    view: "classes:view",
    manage: "classes:manage",
  },
  subjects: {
    view: "subjects:view",
    manage: "subjects:manage",
  },
  students: {
    view: "students:view",
    manage: "students:manage",
    enroll: "students:enroll",
  },
  parents: {
    view: "parents:view",
    manage: "parents:manage",
  },
  staff: {
    view: "staff:view",
    manage: "staff:manage",
  },
  attendance: {
    view: "attendance:view",
    manage: "attendance:manage",
  },
  gate: {
    view: "gate:view",
    manage: "gate:manage",
  },
  boarding: {
    view: "boarding:view",
    manage: "boarding:manage",
    approve_leave: "boarding:approve_leave",
    configure: "boarding:configure"
  },
  dining: {
    view: "dining:view",
    manage: "dining:manage"
  },
  fees: {
    view: "fees:view",
    manage: "fees:manage",
  },
  exams: {
    view: "exams:view",
    manage: "exams:manage",
  },
  notifications: {
    view: "notifications:view",
    manage: "notifications:manage",
  },
  reports: {
    view: "reports:view",
    export: "reports:export",
  },
  settings: {
    view: "settings:view",
    manage: "settings:manage",
  },
  devices: {
    view: "devices:view",
    manage: "devices:manage",
  },
  audit: {
    view: "audit:view",
  },
  billing: {
    view: "billing:view",
    manage: "billing:manage",
  },
  platform: {
    view: "platform:view",
    manage: "platform:manage",
  },
  support: {
    view: "support:view",
    manage: "support:manage",
  },
} as const;

export type PermissionKey = {
  [
    K in keyof typeof PERMISSIONS
  ]: (typeof PERMISSIONS)[K][keyof (typeof PERMISSIONS)[K]];
}[keyof typeof PERMISSIONS];

export const ROLE_MODULE_PERMISSIONS = {
  [SchoolRole.SCHOOL_ADMIN]: {
    school: [PERMISSIONS.school.view, PERMISSIONS.school.manage],
    users: [
      PERMISSIONS.users.view,
      PERMISSIONS.users.invite,
      PERMISSIONS.users.manage,
      PERMISSIONS.users.roles,
    ],
    roles: [PERMISSIONS.roles.view, PERMISSIONS.roles.manage],
    classes: [PERMISSIONS.classes.view, PERMISSIONS.classes.manage],
    subjects: [PERMISSIONS.subjects.view, PERMISSIONS.subjects.manage],
    students: [
      PERMISSIONS.students.view,
      PERMISSIONS.students.manage,
      PERMISSIONS.students.enroll,
    ],
    parents: [PERMISSIONS.parents.view, PERMISSIONS.parents.manage],
    staff: [PERMISSIONS.staff.view, PERMISSIONS.staff.manage],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    gate: [PERMISSIONS.gate.view, PERMISSIONS.gate.manage],
    boarding: [PERMISSIONS.boarding.view, PERMISSIONS.boarding.manage],
    fees: [PERMISSIONS.fees.view, PERMISSIONS.fees.manage],
    exams: [PERMISSIONS.exams.view, PERMISSIONS.exams.manage],
    notifications: [
      PERMISSIONS.notifications.view,
      PERMISSIONS.notifications.manage,
    ],
    reports: [PERMISSIONS.reports.view, PERMISSIONS.reports.export],
    settings: [PERMISSIONS.settings.view, PERMISSIONS.settings.manage],
    devices: [PERMISSIONS.devices.view, PERMISSIONS.devices.manage],
    audit: [PERMISSIONS.audit.view],
  },
  [SchoolRole.TEACHER]: {
    classes: [PERMISSIONS.classes.view, PERMISSIONS.classes.manage],
    subjects: [PERMISSIONS.subjects.view],
    students: [PERMISSIONS.students.view],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    exams: [PERMISSIONS.exams.view, PERMISSIONS.exams.manage],
    reports: [PERMISSIONS.reports.view],
    notifications: [PERMISSIONS.notifications.view],
  },
  [SchoolRole.STAFF]: {
    students: [PERMISSIONS.students.view, PERMISSIONS.students.manage],
    attendance: [PERMISSIONS.attendance.view],
    gate: [PERMISSIONS.gate.view, PERMISSIONS.gate.manage],
    boarding: [PERMISSIONS.boarding.view, PERMISSIONS.boarding.manage],
    fees: [PERMISSIONS.fees.view],
    notifications: [PERMISSIONS.notifications.view],
  },
  [SchoolRole.GATE_KEEPER]: {
    students: [PERMISSIONS.students.view],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    gate: [PERMISSIONS.gate.view, PERMISSIONS.gate.manage],
    boarding: [PERMISSIONS.boarding.view],
    devices: [PERMISSIONS.devices.view],
    notifications: [PERMISSIONS.notifications.view],
  },
  [SchoolRole.BOARDING_OFFICER]: {
    students: [PERMISSIONS.students.view, PERMISSIONS.students.manage],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    gate: [PERMISSIONS.gate.view, PERMISSIONS.gate.manage],
    boarding: [
      PERMISSIONS.boarding.view,
      PERMISSIONS.boarding.manage,
      PERMISSIONS.boarding.approve_leave,
      PERMISSIONS.boarding.configure
    ],
    dining: [PERMISSIONS.dining.view, PERMISSIONS.dining.manage],
    reports: [PERMISSIONS.reports.view, PERMISSIONS.reports.export],
    notifications: [PERMISSIONS.notifications.view, PERMISSIONS.notifications.manage],
    settings: [PERMISSIONS.settings.view]
  },
  [SchoolRole.DIRECTOR_OF_DISCIPLINE]: {
    students: [PERMISSIONS.students.view, PERMISSIONS.students.manage],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    gate: [PERMISSIONS.gate.view, PERMISSIONS.gate.manage],
    boarding: [
      PERMISSIONS.boarding.view,
      PERMISSIONS.boarding.manage,
      PERMISSIONS.boarding.approve_leave,
      PERMISSIONS.boarding.configure
    ],
    dining: [PERMISSIONS.dining.view, PERMISSIONS.dining.manage],
    reports: [PERMISSIONS.reports.view, PERMISSIONS.reports.export],
    notifications: [PERMISSIONS.notifications.view, PERMISSIONS.notifications.manage],
    settings: [PERMISSIONS.settings.view]
  },
  [SchoolRole.DIRECTOR_OF_STUDIES]: {
    classes: [PERMISSIONS.classes.view, PERMISSIONS.classes.manage],
    subjects: [PERMISSIONS.subjects.view, PERMISSIONS.subjects.manage],
    students: [PERMISSIONS.students.view, PERMISSIONS.students.manage],
    staff: [PERMISSIONS.staff.view],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    exams: [PERMISSIONS.exams.view, PERMISSIONS.exams.manage],
    reports: [PERMISSIONS.reports.view, PERMISSIONS.reports.export],
    notifications: [PERMISSIONS.notifications.view, PERMISSIONS.notifications.manage],
    settings: [PERMISSIONS.settings.view]
  },
  [SchoolRole.PATRON]: {
    students: [PERMISSIONS.students.view],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    boarding: [PERMISSIONS.boarding.view, PERMISSIONS.boarding.manage],
    dining: [PERMISSIONS.dining.view, PERMISSIONS.dining.manage],
    reports: [PERMISSIONS.reports.view],
    notifications: [PERMISSIONS.notifications.view]
  },
  [SchoolRole.MATRON]: {
    students: [PERMISSIONS.students.view],
    attendance: [PERMISSIONS.attendance.view, PERMISSIONS.attendance.manage],
    boarding: [PERMISSIONS.boarding.view, PERMISSIONS.boarding.manage],
    dining: [PERMISSIONS.dining.view, PERMISSIONS.dining.manage],
    reports: [PERMISSIONS.reports.view],
    notifications: [PERMISSIONS.notifications.view]
  },
  [SchoolRole.FINANCE_OFFICER]: {
    students: [PERMISSIONS.students.view],
    fees: [PERMISSIONS.fees.view, PERMISSIONS.fees.manage],
    reports: [PERMISSIONS.reports.view, PERMISSIONS.reports.export],
    notifications: [PERMISSIONS.notifications.view],
  },
  [SchoolRole.PARENT]: {
    students: [PERMISSIONS.students.view],
    attendance: [PERMISSIONS.attendance.view],
    fees: [PERMISSIONS.fees.view],
    reports: [PERMISSIONS.reports.view],
    notifications: [PERMISSIONS.notifications.view],
  },
  [SchoolRole.STUDENT]: {
    attendance: [PERMISSIONS.attendance.view],
    exams: [PERMISSIONS.exams.view],
    reports: [PERMISSIONS.reports.view],
    notifications: [PERMISSIONS.notifications.view],
  },
  [PlatformRole.PLATFORM_ADMIN]: {
    platform: [PERMISSIONS.platform.view, PERMISSIONS.platform.manage],
    support: [PERMISSIONS.support.view, PERMISSIONS.support.manage],
    billing: [PERMISSIONS.billing.view, PERMISSIONS.billing.manage],
    reports: [PERMISSIONS.reports.view, PERMISSIONS.reports.export],
    school: [PERMISSIONS.school.view, PERMISSIONS.school.manage],
    users: [PERMISSIONS.users.view, PERMISSIONS.users.manage],
    audit: [PERMISSIONS.audit.view],
  },
  [PlatformRole.PLATFORM_SUPPORT]: {
    platform: [PERMISSIONS.platform.view],
    support: [PERMISSIONS.support.view, PERMISSIONS.support.manage],
    school: [PERMISSIONS.school.view],
    users: [PERMISSIONS.users.view],
    reports: [PERMISSIONS.reports.view],
  },
} as const satisfies Record<
  SchoolRole | PlatformRole,
  Record<string, readonly PermissionKey[]>
>;

const flattenPermissions = (
  modules: Record<string, readonly PermissionKey[]>,
) => Object.values(modules).flat();

export const ROLE_PERMISSIONS = {
  [SchoolRole.SCHOOL_ADMIN]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.SCHOOL_ADMIN],
  ),
  [SchoolRole.TEACHER]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.TEACHER],
  ),
  [SchoolRole.STAFF]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.STAFF],
  ),
  [SchoolRole.GATE_KEEPER]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.GATE_KEEPER],
  ),
  [SchoolRole.BOARDING_OFFICER]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.BOARDING_OFFICER],
  ),
  [SchoolRole.DIRECTOR_OF_DISCIPLINE]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.DIRECTOR_OF_DISCIPLINE],
  ),
  [SchoolRole.DIRECTOR_OF_STUDIES]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.DIRECTOR_OF_STUDIES]
  ),
  [SchoolRole.PATRON]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.PATRON]
  ),
  [SchoolRole.MATRON]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.MATRON]
  ),
  [SchoolRole.FINANCE_OFFICER]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.FINANCE_OFFICER],
  ),
  [SchoolRole.PARENT]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.PARENT],
  ),
  [SchoolRole.STUDENT]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[SchoolRole.STUDENT],
  ),
  [PlatformRole.PLATFORM_ADMIN]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[PlatformRole.PLATFORM_ADMIN],
  ),
  [PlatformRole.PLATFORM_SUPPORT]: flattenPermissions(
    ROLE_MODULE_PERMISSIONS[PlatformRole.PLATFORM_SUPPORT],
  ),
} as const satisfies Record<SchoolRole | PlatformRole, PermissionKey[]>;