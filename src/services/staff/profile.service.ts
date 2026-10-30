import {
  EmploymentStatus,
  Prisma,
  type Gender,
  type StaffContractType,
  type staff_profiles
} from "@prisma/client";
import { UserRole } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { STAFF_ROLES } from "../../constants/roles";

type StaffProfileCreateInput = {
  user_id?: string | number | bigint;
  staff_id_number?: string;
  gender?: Gender;
  department?: string;
  contract_type?: StaffContractType;
  join_date?: string | Date;
  date_of_birth?: string | Date;
  national_id?: string;
  address?: string;
  emergency_contact?: string;
  qualifications?: string;
  experience?: string;
  timetable_access?: string;
  basic_salary?: string | number;
  employment_status?: EmploymentStatus;
  subjects?: string[];
};

type StaffProfileUpdateInput = Partial<StaffProfileCreateInput> & {
  user_id?: string | number | bigint | null;
  staff_id_number?: string | null;
  gender?: Gender | null;
  department?: string | null;
  contract_type?: StaffContractType | null;
  join_date?: string | Date | null;
  date_of_birth?: string | Date | null;
  national_id?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  qualifications?: string | null;
  experience?: string | null;
  timetable_access?: string | null;
  basic_salary?: string | number | null;
  subjects?: string[] | null;
};

type StaffProfileFilters = {
  department?: string;
  employment_status?: EmploymentStatus;
  contract_type?: StaffContractType;
};

const STAFF_USER_ROLES: UserRole[] = STAFF_ROLES.map((role) => role as UserRole);

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const toDecimal = (value: string | number) => {
  if (typeof value === "number") return new Prisma.Decimal(value);
  const cleaned = value.replace(/,/g, "").trim();
  return new Prisma.Decimal(cleaned);
};

const formatStaffProfile = (record: staff_profiles) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  user_id: record.user_id ? record.user_id.toString() : null,
  subjects: record.subjects ?? null,
  basic_salary: record.basic_salary ? record.basic_salary.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "join_date", "department"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.staff_profilesOrderByWithRelationInput;
  }
  return { created_at: "desc" } as Prisma.staff_profilesOrderByWithRelationInput;
};

const assertStaffUser = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  userId: string | number | bigint
) => {
  const user = await tx.users.findFirst({
    where: {
      id: toBigInt(userId),
      school_id: toBigInt(schoolId),
      role: { in: STAFF_USER_ROLES },
      deleted_at: null
    }
  });

  if (!user) {
    throw new AppError("not_found", "Staff user not found", 404);
  }

  const existingProfile = await tx.staff_profiles.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      user_id: toBigInt(userId),
      deleted_at: null
    }
  });

  if (existingProfile) {
    throw new AppError("conflict", "User already linked to a staff profile", 409);
  }

  return user;
};

export const createStaffProfile = async (
  schoolId: string | number | bigint,
  input: StaffProfileCreateInput
) =>
  prisma.$transaction(async (tx) => {
    if (input.user_id) {
      await assertStaffUser(tx, schoolId, input.user_id);
    }

    const created = await tx.staff_profiles.create({
      data: {
        school_id: toBigInt(schoolId),
        user_id: input.user_id ? toBigInt(input.user_id) : undefined,
        staff_id_number: input.staff_id_number,
        gender: input.gender,
        department: input.department,
        contract_type: input.contract_type,
        join_date: input.join_date ? toDateValue(input.join_date) : undefined,
        date_of_birth: input.date_of_birth ? toDateValue(input.date_of_birth) : undefined,
        national_id: input.national_id,
        address: input.address,
        emergency_contact: input.emergency_contact,
        qualifications: input.qualifications,
        experience: input.experience,
        timetable_access: input.timetable_access,
        basic_salary:
          input.basic_salary !== undefined ? toDecimal(input.basic_salary) : undefined,
        employment_status: input.employment_status,
        subjects: input.subjects ?? undefined
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    return {
      ...formatStaffProfile(created),
      user: created.user ? { ...created.user, id: created.user.id.toString() } : null
    };
  });

export const findAllStaffProfiles = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: StaffProfileFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.staff_profilesWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.department) where.department = filters.department;
  if (filters.employment_status) where.employment_status = filters.employment_status;
  if (filters.contract_type) where.contract_type = filters.contract_type;

  if (q) {
    where.OR = [
      { staff_id_number: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.staff_profiles.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    }),
    prisma.staff_profiles.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatStaffProfile(item),
      user: item.user ? { ...item.user, id: item.user.id.toString() } : null
    })),
    meta: { page, limit, total }
  };
};

export const findStaffProfileById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid staff profile id", 400);
  }

  const record = await prisma.staff_profiles.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } }
    }
  });

  if (!record) {
    throw new AppError("not_found", "Staff profile not found", 404);
  }

  return {
    ...formatStaffProfile(record),
    user: record.user ? { ...record.user, id: record.user.id.toString() } : null
  };
};

export const findStaffProfileByUserId = async (
  schoolId: string | number | bigint,
  userId: string | number | bigint
) => {
  const record = await prisma.staff_profiles.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      user_id: toBigInt(userId),
      deleted_at: null
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } }
    }
  });

  if (!record) {
    throw new AppError("not_found", "Staff profile not found for current user", 404);
  }

  return {
    ...formatStaffProfile(record),
    user: record.user ? { ...record.user, id: record.user.id.toString() } : null
  };
};

export const updateStaffProfile = async (
  schoolId: string | number | bigint,
  id: string,
  input: StaffProfileUpdateInput
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid staff profile id", 400);
    }

    const existing = await tx.staff_profiles.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Staff profile not found", 404);
    }

    if (input.user_id) {
      const linked = await tx.staff_profiles.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          user_id: toBigInt(input.user_id),
          deleted_at: null,
          id: { not: existing.id }
        }
      });

      if (linked) {
        throw new AppError("conflict", "User already linked to another staff profile", 409);
      }

      const user = await tx.users.findFirst({
        where: {
          id: toBigInt(input.user_id),
          school_id: toBigInt(schoolId),
          role: { in: STAFF_USER_ROLES },
          deleted_at: null
        }
      });

      if (!user) {
        throw new AppError("not_found", "Staff user not found", 404);
      }
    }

    const data: Prisma.staff_profilesUncheckedUpdateInput = {};
    if (input.user_id !== undefined) {
      data.user_id = input.user_id ? toBigInt(input.user_id) : null;
    }
    if (input.staff_id_number !== undefined) data.staff_id_number = input.staff_id_number;
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.department !== undefined) data.department = input.department;
    if (input.contract_type !== undefined) data.contract_type = input.contract_type;
    if (input.join_date !== undefined) {
      data.join_date = input.join_date ? toDateValue(input.join_date) : null;
    }
    if (input.date_of_birth !== undefined) {
      data.date_of_birth = input.date_of_birth ? toDateValue(input.date_of_birth) : null;
    }
    if (input.national_id !== undefined) data.national_id = input.national_id;
    if (input.address !== undefined) data.address = input.address;
    if (input.emergency_contact !== undefined) data.emergency_contact = input.emergency_contact;
    if (input.qualifications !== undefined) data.qualifications = input.qualifications;
    if (input.experience !== undefined) data.experience = input.experience;
    if (input.timetable_access !== undefined) data.timetable_access = input.timetable_access;
    if (input.basic_salary !== undefined) {
      data.basic_salary = input.basic_salary === null ? null : toDecimal(input.basic_salary);
    }
    if (input.employment_status !== undefined) data.employment_status = input.employment_status;
    if (input.subjects !== undefined) {
      data.subjects = input.subjects ?? undefined;
    }

    const updated = await tx.staff_profiles.update({
      where: { id: existing.id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    return {
      ...formatStaffProfile(updated),
      user: updated.user ? { ...updated.user, id: updated.user.id.toString() } : null
    };
  });

export const deleteStaffProfile = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid staff profile id", 400);
  }

  const existing = await prisma.staff_profiles.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Staff profile not found", 404);
  }

  const updated = await prisma.staff_profiles.update({
    where: { id: existing.id },
    data: { deleted_at: new Date() }
  });

  return formatStaffProfile(updated);
};
