import { SalaryStatus, type Prisma, type salary_records } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

type SalaryCreateInput = {
  staff_id: string | number | bigint;
  month: number;
  year: number;
  basic_salary: string | number;
  allowances?: string | number;
  deductions?: string | number;
  net_salary?: string | number;
  notes?: string;
};

type SalaryUpdateInput = {
  basic_salary?: string | number;
  allowances?: string | number;
  deductions?: string | number;
  net_salary?: string | number;
  status?: SalaryStatus;
  payment_method?: string | null;
  notes?: string | null;
};

type SalaryFilters = {
  staff_id?: string;
  month?: number;
  year?: number;
  status?: SalaryStatus;
};

type MarkPaidInput = {
  payment_method?: string;
  paid_at?: string | Date;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDecimal = (value: string | number) =>
  typeof value === "string" ? value : value.toString();

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatSalaryRecord = (record: salary_records) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  staff_id: record.staff_id.toString(),
  basic_salary: record.basic_salary.toString(),
  allowances: record.allowances.toString(),
  deductions: record.deductions.toString(),
  net_salary: record.net_salary.toString()
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "year", "month", "status", "paid_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.salary_recordsOrderByWithRelationInput;
  }
  return { created_at: "desc" } as Prisma.salary_recordsOrderByWithRelationInput;
};

const computeNetSalary = (
  basic: string | number,
  allowances: string | number = 0,
  deductions: string | number = 0
) => {
  const net = Number(basic) + Number(allowances) - Number(deductions);
  return net.toFixed(2);
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

export const createSalaryRecord = async (
  schoolId: string | number | bigint,
  input: SalaryCreateInput
) =>
  prisma.$transaction(async (tx) => {
    await assertStaffProfile(tx, schoolId, input.staff_id);

    const allowances = input.allowances ?? 0;
    const deductions = input.deductions ?? 0;
    const netSalary =
      input.net_salary ?? computeNetSalary(input.basic_salary, allowances, deductions);

    const existing = await tx.salary_records.findUnique({
      where: {
        staff_id_month_year: {
          staff_id: toBigInt(input.staff_id),
          month: input.month,
          year: input.year
        }
      }
    });

    if (existing) {
      throw new AppError(
        "conflict",
        "Salary record already exists for this staff member, month, and year",
        409
      );
    }

    const created = await tx.salary_records.create({
      data: {
        school_id: toBigInt(schoolId),
        staff_id: toBigInt(input.staff_id),
        month: input.month,
        year: input.year,
        basic_salary: toDecimal(input.basic_salary),
        allowances: toDecimal(allowances),
        deductions: toDecimal(deductions),
        net_salary: toDecimal(netSalary),
        notes: input.notes
      }
    });

    return formatSalaryRecord(created);
  });

export const findAllSalaryRecords = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: SalaryFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.salary_recordsWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.staff_id) where.staff_id = toBigInt(filters.staff_id);
  if (filters.month) where.month = filters.month;
  if (filters.year) where.year = filters.year;
  if (filters.status) where.status = filters.status;

  const [items, total] = await prisma.$transaction([
    prisma.salary_records.findMany({
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
        }
      }
    }),
    prisma.salary_records.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...formatSalaryRecord(item),
      staff: item.staff
        ? {
            ...item.staff,
            id: item.staff.id.toString(),
            user: item.staff.user
              ? { ...item.staff.user, id: item.staff.user.id.toString() }
              : null
          }
        : null
    })),
    meta: { page, limit, total }
  };
};

export const findSalaryRecordById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid salary record id", 400);
  }

  const record = await prisma.salary_records.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: { staff: true }
  });

  if (!record) {
    throw new AppError("not_found", "Salary record not found", 404);
  }

  return {
    ...formatSalaryRecord(record),
    staff: record.staff ? { ...record.staff, id: record.staff.id.toString() } : null
  };
};

export const updateSalaryRecord = async (
  schoolId: string | number | bigint,
  id: string,
  input: SalaryUpdateInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid salary record id", 400);
  }

  const existing = await prisma.salary_records.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Salary record not found", 404);
  }

  if (existing.status === SalaryStatus.paid && input.status && input.status !== SalaryStatus.paid) {
    throw new AppError("bad_request", "Cannot change status of a paid salary record", 400);
  }

  const basic = input.basic_salary ?? existing.basic_salary.toString();
  const allowances = input.allowances ?? existing.allowances.toString();
  const deductions = input.deductions ?? existing.deductions.toString();
  const netSalary =
    input.net_salary ?? computeNetSalary(basic, allowances, deductions);

  const updated = await prisma.salary_records.update({
    where: { id: existing.id },
    data: {
      basic_salary: input.basic_salary ? toDecimal(input.basic_salary) : undefined,
      allowances: input.allowances ? toDecimal(input.allowances) : undefined,
      deductions: input.deductions ? toDecimal(input.deductions) : undefined,
      net_salary: toDecimal(netSalary),
      status: input.status,
      payment_method: input.payment_method,
      notes: input.notes
    }
  });

  return formatSalaryRecord(updated);
};

export const markSalaryAsPaid = async (
  schoolId: string | number | bigint,
  id: string,
  input: MarkPaidInput = {}
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid salary record id", 400);
  }

  const existing = await prisma.salary_records.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Salary record not found", 404);
  }

  if (existing.status === SalaryStatus.paid) {
    throw new AppError("bad_request", "Salary record is already marked as paid", 400);
  }

  if (existing.status === SalaryStatus.cancelled) {
    throw new AppError("bad_request", "Cannot mark a cancelled salary record as paid", 400);
  }

  const updated = await prisma.salary_records.update({
    where: { id: existing.id },
    data: {
      status: SalaryStatus.paid,
      paid_at: input.paid_at ? toDateValue(input.paid_at) : new Date(),
      payment_method: input.payment_method
    }
  });

  return formatSalaryRecord(updated);
};

export const deleteSalaryRecord = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid salary record id", 400);
  }

  const existing = await prisma.salary_records.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Salary record not found", 404);
  }

  if (existing.status === SalaryStatus.paid) {
    throw new AppError("conflict", "Cannot delete a paid salary record", 409);
  }

  await prisma.salary_records.delete({ where: { id: existing.id } });

  return formatSalaryRecord(existing);
};
