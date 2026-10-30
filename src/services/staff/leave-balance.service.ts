import { type Prisma, type staff_leave_balances } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

export type LeaveBalanceType = "annual" | "sick" | "emergency";

type LeaveBalanceCreateInput = {
  staff_id: string | number | bigint;
  academic_year_id: string | number | bigint;
  annual_days?: number;
  sick_days?: number;
  emergency_days?: number;
};

type LeaveBalanceUpdateInput = {
  annual_days?: number;
  sick_days?: number;
  emergency_days?: number;
  annual_used?: number;
  sick_used?: number;
  emergency_used?: number;
};

type LeaveBalanceFilters = {
  staff_id?: string;
  academic_year_id?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatLeaveBalance = (record: staff_leave_balances) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  staff_id: record.staff_id.toString(),
  academic_year_id: record.academic_year_id.toString(),
  annual_remaining: record.annual_days - record.annual_used,
  sick_remaining: record.sick_days - record.sick_used,
  emergency_remaining: record.emergency_days - record.emergency_used
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["id"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.staff_leave_balancesOrderByWithRelationInput;
  }
  return { id: "desc" } as Prisma.staff_leave_balancesOrderByWithRelationInput;
};

const assertStaffProfile = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  staffId: string | number | bigint
) => {
  const staff = await tx.staff_profiles.findFirst({
    where: {
      id: toBigInt(staffId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!staff) {
    throw new AppError("not_found", "Staff profile not found", 404);
  }

  return staff;
};

const assertAcademicYear = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  academicYearId: string | number | bigint
) => {
  const year = await tx.academic_years.findFirst({
    where: {
      id: toBigInt(academicYearId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!year) {
    throw new AppError("not_found", "Academic year not found", 404);
  }

  return year;
};

const getBalanceField = (leaveType: LeaveBalanceType) => {
  const map = {
    annual: { total: "annual_days", used: "annual_used" },
    sick: { total: "sick_days", used: "sick_used" },
    emergency: { total: "emergency_days", used: "emergency_used" }
  } as const;

  return map[leaveType];
};

export const deductLeaveBalanceOnApproval = async (
  schoolId: string | number | bigint,
  balanceId: string,
  leaveType: LeaveBalanceType,
  days: number
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(balanceId)) {
      throw new AppError("bad_request", "Invalid leave balance id", 400);
    }

    const existing = await tx.staff_leave_balances.findFirst({
      where: {
        id: toBigInt(balanceId),
        school_id: toBigInt(schoolId)
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Leave balance not found", 404);
    }

    const fields = getBalanceField(leaveType);
    const total = existing[fields.total];
    const used = existing[fields.used];
    const remaining = total - used;

    if (days > remaining) {
      throw new AppError(
        "bad_request",
        `Insufficient ${leaveType} leave balance (remaining: ${remaining})`,
        400
      );
    }

    const updated = await tx.staff_leave_balances.update({
      where: { id: existing.id },
      data: {
        [fields.used]: used + days
      }
    });

    return formatLeaveBalance(updated);
  });

export const createLeaveBalance = async (
  schoolId: string | number | bigint,
  input: LeaveBalanceCreateInput
) =>
  prisma.$transaction(async (tx) => {
    await assertStaffProfile(tx, schoolId, input.staff_id);
    await assertAcademicYear(tx, schoolId, input.academic_year_id);

    const existing = await tx.staff_leave_balances.findUnique({
      where: {
        staff_id_academic_year_id: {
          staff_id: toBigInt(input.staff_id),
          academic_year_id: toBigInt(input.academic_year_id)
        }
      }
    });

    if (existing) {
      throw new AppError(
        "conflict",
        "Leave balance already exists for this staff member and academic year",
        409
      );
    }

    const created = await tx.staff_leave_balances.create({
      data: {
        school_id: toBigInt(schoolId),
        staff_id: toBigInt(input.staff_id),
        academic_year_id: toBigInt(input.academic_year_id),
        annual_days: input.annual_days,
        sick_days: input.sick_days,
        emergency_days: input.emergency_days
      }
    });

    return formatLeaveBalance(created);
  });

export const findAllLeaveBalances = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: LeaveBalanceFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.staff_leave_balancesWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.staff_id) where.staff_id = toBigInt(filters.staff_id);
  if (filters.academic_year_id) where.academic_year_id = toBigInt(filters.academic_year_id);

  const [items, total] = await prisma.$transaction([
    prisma.staff_leave_balances.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        staff: {
          select: {
            id: true,
            staff_id_number: true,
            department: true,
            user: { select: { id: true, name: true } }
          }
        },
        academic_year: { select: { id: true, name: true, is_current: true } }
      }
    }),
    prisma.staff_leave_balances.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatLeaveBalance(item),
      staff: item.staff
        ? {
            ...item.staff,
            id: item.staff.id.toString(),
            user: item.staff.user
              ? { ...item.staff.user, id: item.staff.user.id.toString() }
              : null
          }
        : null,
      academic_year: item.academic_year
        ? { ...item.academic_year, id: item.academic_year.id.toString() }
        : null
    })),
    meta: { page, limit, total }
  };
};

export const findLeaveBalanceById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid leave balance id", 400);
  }

  const record = await prisma.staff_leave_balances.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      staff: true,
      academic_year: true
    }
  });

  if (!record) {
    throw new AppError("not_found", "Leave balance not found", 404);
  }

  return {
    ...formatLeaveBalance(record),
    staff: record.staff
      ? { ...record.staff, id: record.staff.id.toString() }
      : null,
    academic_year: record.academic_year
      ? { ...record.academic_year, id: record.academic_year.id.toString() }
      : null
  };
};

export const updateLeaveBalance = async (
  schoolId: string | number | bigint,
  id: string,
  input: LeaveBalanceUpdateInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid leave balance id", 400);
  }

  const existing = await prisma.staff_leave_balances.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Leave balance not found", 404);
  }

  const annualDays = input.annual_days ?? existing.annual_days;
  const sickDays = input.sick_days ?? existing.sick_days;
  const emergencyDays = input.emergency_days ?? existing.emergency_days;
  const annualUsed = input.annual_used ?? existing.annual_used;
  const sickUsed = input.sick_used ?? existing.sick_used;
  const emergencyUsed = input.emergency_used ?? existing.emergency_used;

  if (annualUsed > annualDays || sickUsed > sickDays || emergencyUsed > emergencyDays) {
    throw new AppError("bad_request", "Used days cannot exceed allocated days", 400);
  }

  const updated = await prisma.staff_leave_balances.update({
    where: { id: existing.id },
    data: {
      annual_days: input.annual_days,
      sick_days: input.sick_days,
      emergency_days: input.emergency_days,
      annual_used: input.annual_used,
      sick_used: input.sick_used,
      emergency_used: input.emergency_used
    }
  });

  return formatLeaveBalance(updated);
};

export const deleteLeaveBalance = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid leave balance id", 400);
  }

  const existing = await prisma.staff_leave_balances.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Leave balance not found", 404);
  }

  await prisma.staff_leave_balances.delete({ where: { id: existing.id } });

  return formatLeaveBalance(existing);
};
