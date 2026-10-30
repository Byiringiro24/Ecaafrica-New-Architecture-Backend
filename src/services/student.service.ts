import { v4 as uuidv4 } from "uuid";
import type {
  Prisma,
  students,
  student_section_enrollments,
  parents_guardians,
  biometric_enrollments,
  Gender,
  StudentType,
  StudentStatus
} from "@prisma/client";
import { EnrollmentStatus, UserRole } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AuditActorType } from "../constants/enums";
import { AppError } from "../middleware/errorHandler";
import { logAction } from "./audit.service";
import { studentImportRowSchema } from "../validators/student.validator";
import fs from "fs/promises";

type StudentCreateInput = {
  user_id?: string | number | bigint;
  student_id_number?: string;
  first_name: string;
  last_name: string;
  other_names?: string;
  combination?: string;
  date_of_birth?: string | Date;
  gender?: string;
  national_id?: string;
  nationality?: string;
  religion?: string;
  blood_group?: string;
  photo_url?: string;
  address?: string;
  previous_school?: string;
  admission_date?: string | Date;
  enrollment_year?: number;
  student_type?: string;
  status?: string;
};

type StudentImportInput = Omit<StudentCreateInput, "student_id_number"> & {
  student_id_number: string;
  parent_first_name?: string;
  parent_last_name?: string;
  parent_relationship?: string;
  parent_phone?: string;
  parent_phone_alt?: string;
  parent_email?: string;
  parent_national_id?: string;
  parent_address?: string;
  parent_occupation?: string;
};

type StudentUpdateInput = Partial<StudentCreateInput>;

type StudentFilters = {
  status?: string;
  student_type?: string;
  include_deleted?: boolean;
  section_id?: string;
  student_school_id?: string;
  dormitory_ids?: bigint[];
  gender?: Gender;
};

type EnrollmentCreateInput = {
  section_id: string | number | bigint;
  academic_year_id: string | number | bigint;
  term_id?: string | number | bigint;
  enrolled_at?: string | Date;
  left_at?: string | Date;
  status?: string;
};

type EnrollmentFilters = {
  status?: string;
  academic_year_id?: string | number | bigint;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const toAuditJsonObject = (
  input: Record<string, unknown>
): Prisma.InputJsonObject => {
  const entries: [string, Prisma.InputJsonValue][] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    if (typeof value === "bigint") {
      entries.push([key, value.toString()]);
      continue;
    }

    if (value instanceof Date) {
      entries.push([key, value.toISOString()]);
      continue;
    }

    entries.push([key, value as Prisma.InputJsonValue]);
  }

  return Object.fromEntries(entries) as Prisma.InputJsonObject;
};

const resolveAdmissionDate = (input: {
  admission_date?: string | Date;
  enrollment_year?: number;
}) => {
  if (input.admission_date) {
    return toDateValue(input.admission_date);
  }

  if (input.enrollment_year) {
    return new Date(`${input.enrollment_year}-01-01`);
  }

  return undefined;
};

const buildStudentIdNumber = (
  schoolId: string | number | bigint,
  studentSchoolId: bigint,
  config?: { prefix?: string; padding?: number }
) => {
  const prefix = config?.prefix?.trim() || toBigInt(schoolId).toString();
  const padding = Math.max(0, Math.min(12, Number(config?.padding ?? 0)));
  const sequence = studentSchoolId.toString().padStart(padding, "0");
  return `${prefix}${sequence}`;
};

const getStudentIdGenerationConfig = async (tx: Prisma.TransactionClient, schoolId: bigint) => {
  const setting = await tx.system_settings.findFirst({
    where: { school_id: schoolId, key_name: "student_id_generation" },
    select: { value: true, type: true }
  });
  if (!setting?.value) return undefined;
  try {
    const parsed = setting.type === "json" ? JSON.parse(setting.value) : undefined;
    if (!parsed || typeof parsed !== "object") return undefined;
    return {
      prefix: typeof parsed.prefix === "string" ? parsed.prefix : undefined,
      padding: Number.isFinite(Number(parsed.padding)) ? Number(parsed.padding) : undefined
    };
  } catch {
    return undefined;
  }
};

const allocateStudentNumber = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint
) => {
  const schoolBigInt = toBigInt(schoolId);

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${schoolBigInt})`;

  const latest = await tx.students.findFirst({
    where: {
      school_id: schoolBigInt,
      deleted_at: null,
      student_school_id: { not: null }
    },
    orderBy: { student_school_id: "desc" },
    select: { student_school_id: true }
  });

  const studentSchoolId = (latest?.student_school_id ?? 0n) + 1n;
  const config = await getStudentIdGenerationConfig(tx, schoolBigInt);

  return {
    student_school_id: studentSchoolId,
    student_id_number: buildStudentIdNumber(schoolBigInt, studentSchoolId, config)
  };
};

export const resolveNextDeviceUserId = (deviceUserIds: Array<string | null | undefined>) => {
  const validNumbers = deviceUserIds
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 9999999 && String(value).length <= 7);

  if (!validNumbers.length) return "1000";
  return String(Math.max(...validNumbers) + 1);
};

/**
 * Compute a unique device_user_id for a student within a school.
 * Device IDs are generated as a sequential numeric sequence and must not be derived
 * from the school student number, because the student ID number is not the device ID.
 *
 * Must be called inside a transaction or with an advisory lock to avoid races.
 */
const allocateDeviceUserId = async (
  tx: Prisma.TransactionClient,
  schoolId: bigint,
  studentIdNumber: string,
  excludeStudentId?: bigint
): Promise<string> => {
  const existingStudents = await tx.students.findMany({
    where: {
      school_id: schoolId,
      device_user_id: { not: null },
      deleted_at: null,
      ...(excludeStudentId ? { NOT: { id: excludeStudentId } } : {}),
    },
    select: { device_user_id: true },
  });

  let next = resolveNextDeviceUserId(existingStudents.map((student) => student.device_user_id));

  while (
    await tx.students.findFirst({
      where: {
        school_id: schoolId,
        device_user_id: next,
        deleted_at: null,
        ...(excludeStudentId ? { NOT: { id: excludeStudentId } } : {}),
      },
      select: { id: true },
    })
  ) {
    next = String(Number(next) + 1);
    if (Number(next) > 9999999) {
      throw new AppError("bad_request", "No available device user ID slots remaining in this school", 400);
    }
  }

  return next;
};

const formatStudent = (record: students) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  user_id: record.user_id ? record.user_id.toString() : null
});

const formatEnrollment = (record: student_section_enrollments) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  section_id: record.section_id.toString(),
  academic_year_id: record.academic_year_id.toString(),
  term_id: record.term_id ? record.term_id.toString() : null
});

const formatParent = (record: parents_guardians) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  user_id: record.user_id ? record.user_id.toString() : null
});

const formatBiometric = (record: biometric_enrollments) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  enrolled_by: record.enrolled_by ? record.enrolled_by.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "first_name", "last_name"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.studentsOrderByWithRelationInput;
  }

  return { created_at: "desc" } as Prisma.studentsOrderByWithRelationInput;
};

const assertStudentUser = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  userId: string | number | bigint
) => {
  const user = await tx.users.findFirst({
    where: {
      id: toBigInt(userId),
      school_id: toBigInt(schoolId),
      role: UserRole.student,
      deleted_at: null
    }
  });

  if (!user) {
    throw new AppError("not_found", "Student user not found", 404);
  }

  return user;
};

const assertStudent = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await tx.students.findFirst({
    where: {
      id: toBigInt(studentId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  return student;
};

const assertSection = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  sectionId: string | number | bigint
) => {
  const section = await tx.sections.findFirst({
    where: {
      id: toBigInt(sectionId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!section) {
    throw new AppError("not_found", "Section not found", 404);
  }

  return section;
};

const assertAcademicYear = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  academicYearId: string | number | bigint
) => {
  const academicYear = await tx.academic_years.findFirst({
    where: {
      id: toBigInt(academicYearId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!academicYear) {
    throw new AppError("not_found", "Academic year not found", 404);
  }

  return academicYear;
};

const assertTerm = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  termId: string | number | bigint
) => {
  const term = await tx.terms.findFirst({
    where: {
      id: toBigInt(termId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!term) {
    throw new AppError("not_found", "Term not found", 404);
  }

  return term;
};

const normalizeCsvValue = (value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseCsvLine = (line: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
};

const parseCsv = (content: string) => {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase().replace(/\s+/g, "_")
  );

  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
};

export const createStudent = async (
  schoolId: string | number | bigint,
  input: StudentCreateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    if (input.user_id) {
      await assertStudentUser(tx, schoolId, input.user_id);
    }

    const identifiers = await allocateStudentNumber(tx, schoolId);
    const studentIdNumber = input.student_id_number?.trim() || identifiers.student_id_number;

    const existingStudentId = await tx.students.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        student_id_number: studentIdNumber,
        deleted_at: null
      }
    });
    if (existingStudentId) {
      throw new AppError("conflict", "Student ID Number already exists", 409);
    }

    // Auto-assign a unique device_user_id (FK623 numeric, max 7 digits)
    const deviceUserId = await allocateDeviceUserId(tx, toBigInt(schoolId), studentIdNumber);

    const created = await tx.students.create({
      data: {
        uuid: uuidv4(),
        school_id: toBigInt(schoolId),
        user_id: input.user_id ? toBigInt(input.user_id) : undefined,
        student_school_id: identifiers.student_school_id,
        student_id_number: studentIdNumber,
        device_user_id: deviceUserId,
        first_name: input.first_name,
        last_name: input.last_name,
        other_names: input.other_names ?? undefined,
        combination: input.combination ?? undefined,
        date_of_birth: input.date_of_birth
          ? toDateValue(input.date_of_birth)
          : undefined,
        gender: input.gender ? (input.gender as Gender) : undefined,
        national_id: input.national_id ?? undefined,
        nationality: input.nationality ?? undefined,
        religion: input.religion ?? undefined,
        blood_group: input.blood_group ?? undefined,
        photo_url: input.photo_url ?? undefined,
        address: input.address ?? undefined,
        previous_school: input.previous_school ?? undefined,
        admission_date: resolveAdmissionDate(input),
        student_type: input.student_type
          ? (input.student_type as StudentType)
          : undefined,
        status: input.status ? (input.status as StudentStatus) : undefined
      }
    });

    return formatStudent(created);
  });

  void logAction(null, AuditActorType.SYSTEM, "create", "students", result.id, {
    schoolId,
    resourceName: `${result.first_name} ${result.last_name}`,
    newValues: toAuditJsonObject({
      student_school_id: result.student_school_id,
      student_id_number: result.student_id_number,
      status: result.status
    })
  });

  return result;
};

export const findAllStudents = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: StudentFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.studentsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.status) where.status = filters.status as StudentStatus;
  if (filters.student_type) {
    where.student_type = filters.student_type as StudentType;
  }
  if (filters.section_id) {
    where.student_section_enrollments = {
      some: { section_id: toBigInt(filters.section_id), school_id: toBigInt(schoolId) }
    };
  }
  if (filters.student_school_id) {
    where.student_school_id = toBigInt(filters.student_school_id);
  }
  if (filters.gender) where.gender = filters.gender;
  if (filters.dormitory_ids) {
    where.student_dorm_assignments = {
      some: {
        school_id: toBigInt(schoolId),
        dormitory_id: { in: filters.dormitory_ids },
        left_at: null,
      },
    };
  }

  if (q) {
    const numericSchoolId = /^\d+$/.test(q) ? BigInt(q) : undefined;
    where.OR = [
      { first_name: { contains: q, mode: "insensitive" } },
      { last_name: { contains: q, mode: "insensitive" } },
      { other_names: { contains: q, mode: "insensitive" } },
      { student_id_number: { contains: q, mode: "insensitive" } },
      { national_id: { contains: q, mode: "insensitive" } },
      ...(numericSchoolId !== undefined ? [{ student_school_id: numericSchoolId }] : [])
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.students.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student_parent_links: {
          include: {
            parent: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                phone: true,
                phone_alt: true,
                email: true,
                national_id: true,
                relationship: true,
                address: true,
                occupation: true
              }
            }
          },
          orderBy: { is_primary: "desc" },
          take: 1
        },
        student_section_enrollments: {
          where: { status: EnrollmentStatus.active },
          include: {
            section: { select: { id: true, name: true, full_name: true, class_id: true } }
          },
          orderBy: { enrolled_at: "desc" },
          take: 1
        }
      }
    }),
    prisma.students.count({ where })
  ]);

  return {
    data: items.map((item) => {
      const { student_parent_links, student_section_enrollments, ...studentData } = item;
      return {
        ...formatStudent(studentData as Parameters<typeof formatStudent>[0]),
        primary_parent: student_parent_links[0]?.parent
          ? {
              ...student_parent_links[0].parent,
              id: student_parent_links[0].parent.id.toString()
            }
          : null,
        current_section: student_section_enrollments[0]?.section
          ? {
              id: student_section_enrollments[0].section.id.toString(),
              name: student_section_enrollments[0].section.name,
              full_name: student_section_enrollments[0].section.full_name,
              class_id: student_section_enrollments[0].section.class_id.toString()
            }
          : null
      };
    }),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findStudentById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid student id", 400);
  }

  const student = await prisma.students.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  return formatStudent(student);
};

export const getStudentWithDetails = async (
  schoolId: string | number | bigint,
  id: string,
  scope: Pick<StudentFilters, "dormitory_ids" | "gender"> = {},
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid student id", 400);
  }

  const student = await prisma.students.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null,
      ...(scope.gender ? { gender: scope.gender } : {}),
      ...(scope.dormitory_ids
        ? {
            student_dorm_assignments: {
              some: {
                school_id: toBigInt(schoolId),
                dormitory_id: { in: scope.dormitory_ids },
                left_at: null,
              },
            },
          }
        : {}),
    },
    include: {
      student_section_enrollments: {
        include: {
          section: {
            select: {
              id: true,
              name: true,
              full_name: true,
              class_id: true
            }
          },
          academic_year: {
            select: {
              id: true,
              name: true,
              start_date: true,
              end_date: true
            }
          }
        }
      },
      student_parent_links: {
        include: {
          parent: true
        }
      },
      biometric_enrollments: true
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  return {
    ...formatStudent(student),
    enrollments: student.student_section_enrollments.map((enrollment) => ({
      ...formatEnrollment(enrollment),
      section: enrollment.section
        ? {
            id: enrollment.section.id.toString(),
            name: enrollment.section.name,
            full_name: enrollment.section.full_name,
            class_id: enrollment.section.class_id.toString()
          }
        : null,
      academic_year: enrollment.academic_year
        ? {
            id: enrollment.academic_year.id.toString(),
            name: enrollment.academic_year.name,
            start_date: enrollment.academic_year.start_date,
            end_date: enrollment.academic_year.end_date
          }
        : null
    })),
    parents: student.student_parent_links.map((link) => ({
      id: link.id.toString(),
      is_primary: link.is_primary,
      parent: formatParent(link.parent)
    })),
    biometrics: student.biometric_enrollments.map((record) => formatBiometric(record))
  };
};

export const updateStudent = async (
  schoolId: string | number | bigint,
  id: string,
  input: StudentUpdateInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid student id", 400);
    }

    const existing = await tx.students.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Student not found", 404);
    }

    if (input.user_id) {
      await assertStudentUser(tx, schoolId, input.user_id);
    }

    if (input.student_id_number !== undefined) {
      const studentIdNumber = input.student_id_number.trim();
      const duplicate = await tx.students.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          student_id_number: studentIdNumber,
          deleted_at: null,
          NOT: { id: existing.id }
        }
      });
      if (duplicate) {
        throw new AppError("conflict", "Student ID Number already exists", 409);
      }
    }

    const admissionDate = resolveAdmissionDate({
      admission_date:
        input.admission_date !== undefined
          ? input.admission_date
          : existing.admission_date ?? undefined,
      enrollment_year: input.enrollment_year
    });

    const data: Prisma.studentsUpdateInput = {};
    if (input.student_id_number !== undefined) {
      data.student_id_number = input.student_id_number.trim() || null;
    }
    if (input.user_id !== undefined) {
      data.user = input.user_id
        ? { connect: { id: toBigInt(input.user_id) } }
        : { disconnect: true };
    }
    if (input.first_name !== undefined) data.first_name = input.first_name;
    if (input.last_name !== undefined) data.last_name = input.last_name;
    if (input.other_names !== undefined) data.other_names = input.other_names;
    if (input.combination !== undefined) data.combination = input.combination;
    if (input.date_of_birth !== undefined) {
      data.date_of_birth = input.date_of_birth
        ? toDateValue(input.date_of_birth)
        : null;
    }
    if (input.gender !== undefined) {
      data.gender = input.gender ? (input.gender as Gender) : null;
    }
    if (input.national_id !== undefined) data.national_id = input.national_id;
    if (input.nationality !== undefined) data.nationality = input.nationality;
    if (input.religion !== undefined) data.religion = input.religion;
    if (input.blood_group !== undefined) data.blood_group = input.blood_group;
    if (input.photo_url !== undefined) data.photo_url = input.photo_url;
    if (input.address !== undefined) data.address = input.address;
    if (input.previous_school !== undefined) {
      data.previous_school = input.previous_school;
    }
    if (input.admission_date !== undefined || input.enrollment_year !== undefined) {
      data.admission_date = admissionDate ?? null;
    }
    if (input.student_type !== undefined) {
      data.student_type = input.student_type
        ? (input.student_type as StudentType)
        : undefined;
    }
    if (input.status !== undefined) {
      data.status = input.status ? (input.status as StudentStatus) : undefined;
    }

    const updated = await tx.students.update({
      where: { id: existing.id },
      data
    });

    return formatStudent(updated);
  });

  void logAction(null, AuditActorType.SYSTEM, "update", "students", result.id, {
    schoolId,
    resourceName: `${result.first_name} ${result.last_name}`,
    newValues: toAuditJsonObject(input as Record<string, unknown>)
  });

  return result;
};

export const updateVisitorAccess = async (
  schoolId: string | number | bigint,
  id: string,
  blocked: boolean
) => {
  if (!/^\d+$/.test(id)) throw new AppError("bad_request", "Invalid student id", 400);
  const student = await prisma.students.findFirst({
    where: { id: toBigInt(id), school_id: toBigInt(schoolId), deleted_at: null }
  });
  if (!student) throw new AppError("not_found", "Student not found", 404);
  // The `visitor_access_restricted` column was removed from the Prisma schema.
  // Keep API stable by no-oping the DB update and returning the current student.
  // If visitor access restriction is required again, reintroduce the column
  // in the schema and use a proper update here.
  return formatStudent(student);
};

export const softDeleteStudent = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid student id", 400);
    }

    const existing = await tx.students.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Student not found", 404);
    }

    const deleted = await tx.students.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatStudent(deleted);
  });

export const bulkImportFromCSV = async (
  schoolId: string | number | bigint,
  file: Express.Multer.File,
  enrollment?: Pick<EnrollmentCreateInput, "section_id" | "academic_year_id" | "term_id">
) => {
  const content = await fs.readFile(file.path, "utf8");
  const { headers, rows } = parseCsv(content);

  if (headers.length === 0 || rows.length === 0) {
    throw new AppError("bad_request", "CSV file is empty", 400);
  }

  const errors: string[] = [];
  const records: StudentImportInput[] = [];

  rows.forEach((row, index) => {
    const record: Record<string, string | undefined> = {};

    headers.forEach((header, headerIndex) => {
      record[header] = normalizeCsvValue(row[headerIndex]);
    });

    const parsed = studentImportRowSchema.safeParse(record);
    if (!parsed.success) {
      const rowErrors = parsed.error.errors.map((issue) => issue.message).join("; ");
      errors.push(`Row ${index + 2}: ${rowErrors}`);
      return;
    }

    records.push(parsed.data as StudentImportInput);
  });

  if (errors.length > 0) {
    throw new AppError("bad_request", "CSV validation failed", 400, errors);
  }

  const createdCount = await prisma.$transaction(async (tx) => {
    let sectionId: bigint | undefined;
    let academicYearId: bigint | undefined;
    let termId: bigint | undefined;

    if (enrollment) {
      const section = await assertSection(tx, schoolId, enrollment.section_id);
      await assertAcademicYear(tx, schoolId, enrollment.academic_year_id);

      if (enrollment.term_id) {
        await assertTerm(tx, schoolId, enrollment.term_id);
      }

      sectionId = section.id;
      academicYearId = toBigInt(enrollment.academic_year_id);
      termId = enrollment.term_id ? toBigInt(enrollment.term_id) : undefined;
    }

    const startingStudentNumber = await allocateStudentNumber(tx, schoolId);
    let nextStudentSchoolId = startingStudentNumber.student_school_id;
    const importedStudentIds = new Set<string>();

    let count = 0;
    for (const record of records) {
      const studentIdNumber = record.student_id_number.trim();
      if (importedStudentIds.has(studentIdNumber)) {
        throw new AppError("conflict", `Student ID Number already exists in the import: ${studentIdNumber}`, 409);
      }
      importedStudentIds.add(studentIdNumber);

      const existingStudent = await tx.students.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          student_id_number: studentIdNumber,
          deleted_at: null
        }
      });
      if (existingStudent) {
        throw new AppError("conflict", `Student ID Number already exists: ${studentIdNumber}`, 409);
      }

      const studentSchoolId = nextStudentSchoolId;
      nextStudentSchoolId += 1n;

      // Auto-assign unique device_user_id before insert
      const deviceUserId = await allocateDeviceUserId(tx, toBigInt(schoolId), studentIdNumber);

      const student = await tx.students.create({
        data: {
          uuid: uuidv4(),
          school_id: toBigInt(schoolId),
          student_school_id: studentSchoolId,
          student_id_number: studentIdNumber,
          device_user_id: deviceUserId,
          first_name: record.first_name,
          last_name: record.last_name,
          other_names: record.other_names ?? undefined,
          combination: record.combination ?? undefined,
          date_of_birth: record.date_of_birth
            ? toDateValue(record.date_of_birth)
            : undefined,
          gender: record.gender ? (record.gender as Gender) : undefined,
          national_id: record.national_id ?? undefined,
          nationality: record.nationality ?? undefined,
          religion: record.religion ?? undefined,
          blood_group: record.blood_group ?? undefined,
          photo_url: record.photo_url ?? undefined,
          address: record.address ?? undefined,
          previous_school: record.previous_school ?? undefined,
          admission_date: resolveAdmissionDate(record),
          student_type: record.student_type
            ? (record.student_type as StudentType)
            : undefined,
          status: record.status ? (record.status as StudentStatus) : undefined
        }
      });

      if (sectionId && academicYearId) {
        await tx.student_section_enrollments.create({
          data: {
            school_id: toBigInt(schoolId),
            student_id: student.id,
            section_id: sectionId,
            academic_year_id: academicYearId,
            term_id: termId,
            enrolled_at: new Date(),
            status: EnrollmentStatus.active
          }
        });
      }

      if (record.parent_first_name && record.parent_last_name && record.parent_phone) {
        const parent = await tx.parents_guardians.create({
          data: {
            school_id: toBigInt(schoolId),
            first_name: record.parent_first_name,
            last_name: record.parent_last_name,
            phone: record.parent_phone,
            phone_alt: record.parent_phone_alt ?? undefined,
            email: record.parent_email ?? undefined,
            national_id: record.parent_national_id ?? undefined,
            relationship: record.parent_relationship || "Guardian",
            address: record.parent_address ?? undefined,
            occupation: record.parent_occupation ?? undefined
          }
        });

        await tx.student_parent_links.create({
          data: {
            student_id: student.id,
            parent_id: parent.id,
            is_primary: true
          }
        });
      }
      count += 1;
    }

    return count;
  });

  return { created: createdCount };
};

export const createStudentEnrollment = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  input: EnrollmentCreateInput
) =>
  prisma.$transaction(async (tx) => {
    const student = await assertStudent(tx, schoolId, studentId);
    const section = await assertSection(tx, schoolId, input.section_id);
    await assertAcademicYear(tx, schoolId, input.academic_year_id);

    if (input.term_id) {
      await assertTerm(tx, schoolId, input.term_id);
    }

    const duplicate = await tx.student_section_enrollments.findFirst({
      where: {
        student_id: student.id,
        section_id: section.id,
        academic_year_id: toBigInt(input.academic_year_id)
      }
    });

    if (duplicate) {
      throw new AppError("conflict", "Enrollment already exists", 409);
    }

    const created = await tx.student_section_enrollments.create({
      data: {
        school_id: toBigInt(schoolId),
        student_id: student.id,
        section_id: section.id,
        academic_year_id: toBigInt(input.academic_year_id),
        term_id: input.term_id ? toBigInt(input.term_id) : undefined,
        enrolled_at: input.enrolled_at ? toDateValue(input.enrolled_at) : new Date(),
        left_at: input.left_at ? toDateValue(input.left_at) : undefined,
        status: input.status ? (input.status as EnrollmentStatus) : undefined
      }
    });

    return formatEnrollment(created);
  });

export const listStudentEnrollments = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  pagination: PaginationParams,
  filters: EnrollmentFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.student_section_enrollmentsWhereInput = {
    school_id: toBigInt(schoolId),
    student_id: toBigInt(studentId)
  };

  if (filters.status) {
    where.status = filters.status as EnrollmentStatus;
  }

  if (filters.academic_year_id) {
    where.academic_year_id = toBigInt(filters.academic_year_id);
  }

  const allowed = new Set(["enrolled_at", "left_at", "created_at"]);
  const orderBy =
    sort && allowed.has(sort)
      ? ({ [sort]: order ?? "desc" } as Prisma.student_section_enrollmentsOrderByWithRelationInput)
      : ({ enrolled_at: "desc" } as Prisma.student_section_enrollmentsOrderByWithRelationInput);

  const [items, total] = await prisma.$transaction([
    prisma.student_section_enrollments.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.student_section_enrollments.count({ where })
  ]);

  return {
    data: items.map((item) => formatEnrollment(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};
