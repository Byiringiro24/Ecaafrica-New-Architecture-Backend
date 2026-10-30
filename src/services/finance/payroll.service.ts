import type { PaymentMethod, PayrollRunStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AuditActorType } from "../../constants/enums";
import type { PaginationParams } from "../../helpers/pagination";
import { AppError } from "../../middleware/errorHandler";
import { logAction } from "../audit.service";
import {
  parseId,
  resolveOrderBy,
  toAuditJson,
  toBigInt,
  toDate,
  type IdInput
} from "./shared";

/** Rwanda statutory rates: PAYE on gross, RSSB pension on basic. */
export const TAX_RATE = 0.15;
export const PENSION_RATE = 0.05;

/** draft -> submitted -> approved -> paid. No step may be skipped or reversed. */
const ALLOWED_RUN_TRANSITIONS: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  draft: ["submitted"],
  submitted: ["approved"],
  approved: ["paid"],
  paid: []
};

type PayslipInput = {
  staff_id: IdInput;
  basic_salary: string | number;
  allowances?: string | number;
  overtime?: string | number;
  bonus?: string | number;
  loan_recovery?: string | number;
  other_deductions?: string | number;
  notes?: string;
};

type PayslipRecord = Prisma.payslipsGetPayload<{
  include: {
    staff: {
      select: {
        id: true;
        staff_id_number: true;
        department: true;
        user: { select: { name: true; role: true } };
      };
    };
  };
}>;

type RunRecord = Prisma.payroll_runsGetPayload<{
  include: {
    approver: { select: { name: true } };
    _count: { select: { payslips: true } };
  };
}>;

const payslipInclude = {
  staff: {
    select: {
      id: true,
      staff_id_number: true,
      department: true,
      user: { select: { name: true, role: true } }
    }
  }
} satisfies Prisma.payslipsInclude;

/**
 * Salary math is owned by the server so that a client can never post an
 * inconsistent gross/net. Only the raw inputs are accepted.
 */
export const computePayslip = (input: PayslipInput) => {
  const basic = Number(input.basic_salary);
  const allowances = Number(input.allowances ?? 0);
  const overtime = Number(input.overtime ?? 0);
  const bonus = Number(input.bonus ?? 0);
  const loanRecovery = Number(input.loan_recovery ?? 0);
  const otherDeductions = Number(input.other_deductions ?? 0);

  const gross = basic + allowances + overtime + bonus;
  const tax = Math.round(gross * TAX_RATE);
  const pension = Math.round(basic * PENSION_RATE);
  const totalDeductions = tax + pension + loanRecovery + otherDeductions;
  const net = gross - totalDeductions;

  if (net < 0) {
    throw new AppError(
      "bad_request",
      "Deductions exceed gross salary; net pay would be negative",
      400
    );
  }

  return {
    basic_salary: basic.toFixed(2),
    allowances: allowances.toFixed(2),
    overtime: overtime.toFixed(2),
    bonus: bonus.toFixed(2),
    gross_salary: gross.toFixed(2),
    tax: tax.toFixed(2),
    pension: pension.toFixed(2),
    loan_recovery: loanRecovery.toFixed(2),
    other_deductions: otherDeductions.toFixed(2),
    total_deductions: totalDeductions.toFixed(2),
    net_salary: net.toFixed(2)
  };
};

const formatRun = (record: RunRecord) => ({
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  month: record.month,
  year: record.year,
  period: `${String(record.month).padStart(2, "0")}/${record.year}`,
  status: record.status,
  employee_count: record.employee_count,
  payslip_count: record._count?.payslips ?? 0,
  total_gross: record.total_gross.toString(),
  total_deductions: record.total_deductions.toString(),
  total_net: record.total_net.toString(),
  currency: record.currency,
  submitted_at: record.submitted_at,
  approved_by: record.approved_by ? record.approved_by.toString() : null,
  approved_by_name: record.approver?.name ?? null,
  approved_at: record.approved_at,
  paid_at: record.paid_at,
  notes: record.notes,
  created_at: record.created_at,
  updated_at: record.updated_at
});

const formatPayslip = (record: PayslipRecord) => ({
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  payroll_run_id: record.payroll_run_id.toString(),
  staff_id: record.staff_id.toString(),
  staff_number: record.staff.staff_id_number,
  staff_name: record.staff.user?.name ?? null,
  role: record.staff.user?.role ?? null,
  department: record.staff.department,
  reference: record.reference,
  basic_salary: record.basic_salary.toString(),
  allowances: record.allowances.toString(),
  overtime: record.overtime.toString(),
  bonus: record.bonus.toString(),
  gross_salary: record.gross_salary.toString(),
  tax: record.tax.toString(),
  pension: record.pension.toString(),
  loan_recovery: record.loan_recovery.toString(),
  other_deductions: record.other_deductions.toString(),
  total_deductions: record.total_deductions.toString(),
  net_salary: record.net_salary.toString(),
  currency: record.currency,
  status: record.status,
  paid_at: record.paid_at,
  payment_method: record.payment_method,
  notes: record.notes,
  created_at: record.created_at,
  updated_at: record.updated_at
});

/** Recomputes a run's totals from its payslips. Call inside the caller's tx. */
const syncRunTotals = async (tx: Prisma.TransactionClient, runId: bigint) => {
  const totals = await tx.payslips.aggregate({
    where: { payroll_run_id: runId, deleted_at: null },
    _sum: { gross_salary: true, total_deductions: true, net_salary: true },
    _count: true
  });

  return tx.payroll_runs.update({
    where: { id: runId },
    data: {
      total_gross: totals._sum.gross_salary?.toString() ?? "0",
      total_deductions: totals._sum.total_deductions?.toString() ?? "0",
      total_net: totals._sum.net_salary?.toString() ?? "0",
      employee_count: totals._count
    },
    include: {
      approver: { select: { name: true } },
      _count: { select: { payslips: true } }
    }
  });
};

const loadRun = async (
  tx: Prisma.TransactionClient,
  schoolId: IdInput,
  id: string
) => {
  const run = await tx.payroll_runs.findFirst({
    where: { id: parseId(id, "payroll run"), school_id: toBigInt(schoolId), deleted_at: null }
  });

  if (!run) {
    throw new AppError("not_found", "Payroll run not found", 404);
  }

  return run;
};

/**
 * Opens a run for a month and seeds a draft payslip for every active staff
 * member that has a basic salary on file.
 */
export const generatePayrollRun = async (
  schoolId: IdInput,
  actorId: IdInput | undefined,
  input: { month: number; year: number; notes?: string }
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.payroll_runs.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        month: input.month,
        year: input.year,
        deleted_at: null
      }
    });

    if (existing) {
      throw new AppError(
        "conflict",
        `A payroll run already exists for ${input.month}/${input.year}`,
        409
      );
    }

    const staff = await tx.staff_profiles.findMany({
      where: {
        school_id: toBigInt(schoolId),
        deleted_at: null,
        employment_status: "active",
        basic_salary: { not: null }
      },
      select: { id: true, basic_salary: true }
    });

    if (staff.length === 0) {
      throw new AppError(
        "bad_request",
        "No active staff with a basic salary on file; set salaries before generating payroll",
        400
      );
    }

    const run = await tx.payroll_runs.create({
      data: {
        school_id: toBigInt(schoolId),
        month: input.month,
        year: input.year,
        status: "draft",
        notes: input.notes
      }
    });

    const period = `${input.year}${String(input.month).padStart(2, "0")}`;

    await tx.payslips.createMany({
      data: staff.map((member, index) => {
        const computed = computePayslip({
          staff_id: member.id,
          basic_salary: member.basic_salary!.toString()
        });

        return {
          school_id: toBigInt(schoolId),
          payroll_run_id: run.id,
          staff_id: member.id,
          reference: `PS-${period}-${String(index + 1).padStart(3, "0")}`,
          ...computed,
          status: "draft" as const
        };
      })
    });

    const synced = await syncRunTotals(tx, run.id);
    return formatRun(synced);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "generate", "payroll_runs", result.id, {
    schoolId,
    resourceName: result.period
  });

  return result;
};

export const findAllPayrollRuns = async (
  schoolId: IdInput,
  pagination: PaginationParams,
  filters: { status?: PayrollRunStatus; year?: number } = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.payroll_runsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.status) where.status = filters.status;
  if (filters.year) where.year = filters.year;

  const [items, total] = await Promise.all([
    prisma.payroll_runs.findMany({
      where,
      orderBy: resolveOrderBy<Prisma.payroll_runsOrderByWithRelationInput>(
        ["year", "month", "created_at", "total_net", "status"],
        sort,
        order,
        "created_at"
      ),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        approver: { select: { name: true } },
        _count: { select: { payslips: true } }
      }
    }),
    prisma.payroll_runs.count({ where })
  ]);

  return { data: items.map(formatRun), meta: { page, limit, total } };
};

export const findPayrollRunById = async (schoolId: IdInput, id: string) => {
  const record = await prisma.payroll_runs.findFirst({
    where: { id: parseId(id, "payroll run"), school_id: toBigInt(schoolId), deleted_at: null },
    include: {
      approver: { select: { name: true } },
      _count: { select: { payslips: true } }
    }
  });

  if (!record) {
    throw new AppError("not_found", "Payroll run not found", 404);
  }

  return formatRun(record);
};

const transitionRun = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  target: PayrollRunStatus,
  extraData: Prisma.payroll_runsUncheckedUpdateInput = {}
) => {
  const result = await prisma.$transaction(async (tx) => {
    const run = await loadRun(tx, schoolId, id);

    if (!ALLOWED_RUN_TRANSITIONS[run.status].includes(target)) {
      throw new AppError(
        "conflict",
        `Cannot move a payroll run from "${run.status}" to "${target}"`,
        409
      );
    }

    const updated = await tx.payroll_runs.update({
      where: { id: run.id },
      data: { status: target, ...extraData },
      include: {
        approver: { select: { name: true } },
        _count: { select: { payslips: true } }
      }
    });

    // Payslips follow the run so a payslip can never claim to be paid while
    // its run is still awaiting approval.
    await tx.payslips.updateMany({
      where: { payroll_run_id: run.id, deleted_at: null },
      data: {
        status: target,
        ...(target === "paid" ? { paid_at: new Date() } : {})
      }
    });

    return formatRun(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    target,
    "payroll_runs",
    result.id,
    { schoolId, resourceName: result.period }
  );

  return result;
};

export const submitPayrollRun = (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined
) => transitionRun(schoolId, id, actorId, "submitted", { submitted_at: new Date() });

export const approvePayrollRun = (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined
) =>
  transitionRun(schoolId, id, actorId, "approved", {
    approved_at: new Date(),
    approved_by: actorId ? toBigInt(actorId) : undefined
  });

export const markPayrollRunPaid = (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  paidAt?: string | Date
) =>
  transitionRun(schoolId, id, actorId, "paid", {
    paid_at: paidAt ? toDate(paidAt) : new Date()
  });

export const deletePayrollRun = async (
  schoolId: IdInput,
  id: string,
  actorId?: IdInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const run = await loadRun(tx, schoolId, id);

    if (run.status === "paid" || run.status === "approved") {
      throw new AppError(
        "conflict",
        `Cannot delete an ${run.status} payroll run`,
        409
      );
    }

    await tx.payslips.updateMany({
      where: { payroll_run_id: run.id },
      data: { deleted_at: new Date() }
    });

    const deleted = await tx.payroll_runs.update({
      where: { id: run.id },
      data: { deleted_at: new Date() },
      include: {
        approver: { select: { name: true } },
        _count: { select: { payslips: true } }
      }
    });

    return formatRun(deleted);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "delete", "payroll_runs", result.id, {
    schoolId,
    resourceName: result.period
  });

  return result;
};

export const findAllPayslips = async (
  schoolId: IdInput,
  pagination: PaginationParams,
  filters: {
    payroll_run_id?: string;
    staff_id?: string;
    status?: PayrollRunStatus;
    department?: string;
  } = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.payslipsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.payroll_run_id) where.payroll_run_id = toBigInt(filters.payroll_run_id);
  if (filters.staff_id) where.staff_id = toBigInt(filters.staff_id);
  if (filters.status) where.status = filters.status;
  if (filters.department) where.staff = { department: filters.department };

  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { staff: { user: { name: { contains: q, mode: "insensitive" } } } },
      { staff: { department: { contains: q, mode: "insensitive" } } }
    ];
  }

  const [items, total, sums] = await Promise.all([
    prisma.payslips.findMany({
      where,
      orderBy: resolveOrderBy<Prisma.payslipsOrderByWithRelationInput>(
        ["net_salary", "gross_salary", "created_at", "status"],
        sort,
        order,
        "created_at"
      ),
      skip: (page - 1) * limit,
      take: limit,
      include: payslipInclude
    }),
    prisma.payslips.count({ where }),
    prisma.payslips.aggregate({
      where,
      _sum: { gross_salary: true, total_deductions: true, net_salary: true }
    })
  ]);

  return {
    data: items.map(formatPayslip),
    meta: {
      page,
      limit,
      total,
      total_gross: sums._sum.gross_salary?.toString() ?? "0",
      total_deductions: sums._sum.total_deductions?.toString() ?? "0",
      total_net: sums._sum.net_salary?.toString() ?? "0"
    }
  };
};

export const findPayslipById = async (schoolId: IdInput, id: string) => {
  const record = await prisma.payslips.findFirst({
    where: { id: parseId(id, "payslip"), school_id: toBigInt(schoolId), deleted_at: null },
    include: payslipInclude
  });

  if (!record) {
    throw new AppError("not_found", "Payslip not found", 404);
  }

  return formatPayslip(record);
};

export const createPayslip = async (
  schoolId: IdInput,
  runId: string,
  actorId: IdInput | undefined,
  input: PayslipInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const run = await loadRun(tx, schoolId, runId);

    if (run.status !== "draft") {
      throw new AppError(
        "conflict",
        "Payslips can only be added while the payroll run is a draft",
        409
      );
    }

    const staff = await tx.staff_profiles.findFirst({
      where: {
        id: toBigInt(input.staff_id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!staff) {
      throw new AppError("not_found", "Staff member not found", 404);
    }

    const duplicate = await tx.payslips.findFirst({
      where: { payroll_run_id: run.id, staff_id: staff.id, deleted_at: null }
    });

    if (duplicate) {
      throw new AppError(
        "conflict",
        "This staff member already has a payslip in this payroll run",
        409
      );
    }

    const count = await tx.payslips.count({ where: { payroll_run_id: run.id } });
    const period = `${run.year}${String(run.month).padStart(2, "0")}`;

    const created = await tx.payslips.create({
      data: {
        school_id: toBigInt(schoolId),
        payroll_run_id: run.id,
        staff_id: staff.id,
        reference: `PS-${period}-${String(count + 1).padStart(3, "0")}`,
        ...computePayslip(input),
        status: "draft",
        notes: input.notes
      },
      include: payslipInclude
    });

    await syncRunTotals(tx, run.id);
    return formatPayslip(created);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "create", "payslips", result.id, {
    schoolId,
    resourceName: result.reference,
    newValues: toAuditJson({ staff_id: result.staff_id, net: result.net_salary })
  });

  return result;
};

export const updatePayslip = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: Partial<PayslipInput>
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.payslips.findFirst({
      where: { id: parseId(id, "payslip"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Payslip not found", 404);
    }

    if (existing.status !== "draft") {
      throw new AppError(
        "conflict",
        "Only payslips in a draft payroll run can be edited",
        409
      );
    }

    const computed = computePayslip({
      staff_id: existing.staff_id,
      basic_salary: input.basic_salary ?? existing.basic_salary.toString(),
      allowances: input.allowances ?? existing.allowances.toString(),
      overtime: input.overtime ?? existing.overtime.toString(),
      bonus: input.bonus ?? existing.bonus.toString(),
      loan_recovery: input.loan_recovery ?? existing.loan_recovery.toString(),
      other_deductions: input.other_deductions ?? existing.other_deductions.toString()
    });

    const updated = await tx.payslips.update({
      where: { id: existing.id },
      data: { ...computed, notes: input.notes ?? existing.notes },
      include: payslipInclude
    });

    await syncRunTotals(tx, existing.payroll_run_id);
    return formatPayslip(updated);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "update", "payslips", result.id, {
    schoolId,
    resourceName: result.reference,
    newValues: toAuditJson({ ...input })
  });

  return result;
};

export const markPayslipPaid = async (
  schoolId: IdInput,
  id: string,
  actorId: IdInput | undefined,
  input: { payment_method?: PaymentMethod; paid_at?: string | Date }
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.payslips.findFirst({
      where: { id: parseId(id, "payslip"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Payslip not found", 404);
    }

    if (existing.status !== "approved") {
      throw new AppError(
        "conflict",
        "Only payslips in an approved payroll run can be paid",
        409
      );
    }

    const updated = await tx.payslips.update({
      where: { id: existing.id },
      data: {
        status: "paid",
        paid_at: input.paid_at ? toDate(input.paid_at) : new Date(),
        payment_method: input.payment_method
      },
      include: payslipInclude
    });

    return formatPayslip(updated);
  });

  void logAction(
    actorId ?? null,
    AuditActorType.SCHOOL_USER,
    "mark_paid",
    "payslips",
    result.id,
    { schoolId, resourceName: result.reference }
  );

  return result;
};

export const deletePayslip = async (
  schoolId: IdInput,
  id: string,
  actorId?: IdInput
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.payslips.findFirst({
      where: { id: parseId(id, "payslip"), school_id: toBigInt(schoolId), deleted_at: null }
    });

    if (!existing) {
      throw new AppError("not_found", "Payslip not found", 404);
    }

    if (existing.status !== "draft") {
      throw new AppError(
        "conflict",
        "Only payslips in a draft payroll run can be removed",
        409
      );
    }

    const deleted = await tx.payslips.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() },
      include: payslipInclude
    });

    await syncRunTotals(tx, existing.payroll_run_id);
    return formatPayslip(deleted);
  });

  void logAction(actorId ?? null, AuditActorType.SCHOOL_USER, "delete", "payslips", result.id, {
    schoolId,
    resourceName: result.reference
  });

  return result;
};
