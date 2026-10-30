import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { toBigInt, toDate, type IdInput } from "./shared";

type PeriodFilter = {
  from_date?: string;
  to_date?: string;
};

const resolvePeriod = (filters: PeriodFilter) => {
  const to = filters.to_date ? toDate(filters.to_date) : new Date();
  const from = filters.from_date
    ? toDate(filters.from_date)
    : new Date(to.getFullYear(), to.getMonth() - 5, 1);

  return { from, to };
};

const num = (value: Prisma.Decimal | null | undefined) => Number(value ?? 0);

/**
 * Top-level KPI block for the finance dashboard. Fee expectation and collection
 * come from student_fee_assignments, which stays the source of truth for what a
 * student owes; invoices are a presentation layer on top of it.
 */
export const getFinanceSummary = async (
  schoolId: IdInput,
  filters: PeriodFilter = {}
) => {
  const school = toBigInt(schoolId);
  const { from, to } = resolvePeriod(filters);

  const [fees, overdue, defaulters, paidStudents, payroll, expensePaid, expensePending, inventory, payable, collectedInPeriod] =
    await Promise.all([
      prisma.student_fee_assignments.aggregate({
        where: { school_id: school },
        _sum: { amount_due: true, amount_paid: true, balance: true }
      }),
      prisma.student_fee_assignments.aggregate({
        where: { school_id: school, status: "overdue" },
        _sum: { balance: true }
      }),
      prisma.student_fee_assignments.count({
        where: { school_id: school, status: { in: ["overdue", "unpaid"] } }
      }),
      prisma.student_fee_assignments.count({
        where: { school_id: school, status: "paid" }
      }),
      prisma.payslips.aggregate({
        where: { school_id: school, deleted_at: null },
        _sum: { net_salary: true, gross_salary: true, total_deductions: true }
      }),
      prisma.expenses.aggregate({
        where: { school_id: school, deleted_at: null, status: "paid" },
        _sum: { amount: true }
      }),
      prisma.expenses.aggregate({
        where: { school_id: school, deleted_at: null, status: "pending" },
        _sum: { amount: true }
      }),
      prisma.inventory_items.findMany({
        where: { school_id: school, deleted_at: null },
        select: { quantity: true, unit_cost: true, reorder_level: true }
      }),
      prisma.suppliers.aggregate({
        where: { school_id: school, deleted_at: null },
        _sum: { balance: true }
      }),
      prisma.fee_transactions.aggregate({
        where: { school_id: school, paid_at: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: true
      })
    ]);

  const expected = num(fees._sum.amount_due);
  const collected = num(fees._sum.amount_paid);
  const payrollNet = num(payroll._sum.net_salary);
  const expensesPaid = num(expensePaid._sum.amount);

  const inventoryValue = inventory.reduce(
    (sum, item) => sum + Number(item.unit_cost) * item.quantity,
    0
  );

  return {
    period: { from, to },
    expected: expected.toFixed(2),
    collected: collected.toFixed(2),
    outstanding: num(fees._sum.balance).toFixed(2),
    overdue: num(overdue._sum.balance).toFixed(2),
    collection_rate: expected ? Math.round((collected / expected) * 100) : 0,
    defaulters,
    paid_students: paidStudents,
    payroll_gross: num(payroll._sum.gross_salary).toFixed(2),
    payroll_deductions: num(payroll._sum.total_deductions).toFixed(2),
    payroll_net: payrollNet.toFixed(2),
    expenses_paid: expensesPaid.toFixed(2),
    expenses_pending: num(expensePending._sum.amount).toFixed(2),
    inventory_value: inventoryValue.toFixed(2),
    low_stock_count: inventory.filter((i) => i.quantity < i.reorder_level).length,
    supplier_payable: num(payable._sum.balance).toFixed(2),
    net_position: (collected - payrollNet - expensesPaid).toFixed(2),
    collected_in_period: num(collectedInPeriod._sum.amount).toFixed(2),
    transactions_in_period: collectedInPeriod._count
  };
};

/** Daily collection totals for the trend chart. Defaults to the last 30 days. */
export const getDailyCollections = async (
  schoolId: IdInput,
  filters: PeriodFilter = {}
) => {
  const to = filters.to_date ? toDate(filters.to_date) : new Date();
  const from = filters.from_date
    ? toDate(filters.from_date)
    : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);

  const transactions = await prisma.fee_transactions.findMany({
    where: {
      school_id: toBigInt(schoolId),
      paid_at: { gte: from, lte: to }
    },
    select: { paid_at: true, amount: true }
  });

  const byDay = new Map<string, number>();
  for (const tx of transactions) {
    const key = tx.paid_at.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(tx.amount));
  }

  const days: { date: string; amount: string }[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, amount: (byDay.get(key) ?? 0).toFixed(2) });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

/** Collected vs expected per month, for the dashboard bar chart. */
export const getMonthlyCollections = async (
  schoolId: IdInput,
  filters: PeriodFilter & { months?: number } = {}
) => {
  const school = toBigInt(schoolId);
  const monthCount = filters.months ?? 6;
  const to = filters.to_date ? toDate(filters.to_date) : new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - (monthCount - 1), 1);

  const [transactions, assignments] = await Promise.all([
    prisma.fee_transactions.findMany({
      where: { school_id: school, paid_at: { gte: from, lte: to } },
      select: { paid_at: true, amount: true }
    }),
    prisma.student_fee_assignments.findMany({
      where: { school_id: school, due_date: { gte: from, lte: to } },
      select: { due_date: true, amount_due: true }
    })
  ]);

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const collected = new Map<string, number>();
  for (const tx of transactions) {
    const key = monthKey(tx.paid_at);
    collected.set(key, (collected.get(key) ?? 0) + Number(tx.amount));
  }

  const expected = new Map<string, number>();
  for (const a of assignments) {
    if (!a.due_date) continue;
    const key = monthKey(a.due_date);
    expected.set(key, (expected.get(key) ?? 0) + Number(a.amount_due));
  }

  const months: { month: string; collected: string; expected: string }[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = monthKey(cursor);
    months.push({
      month: key,
      collected: (collected.get(key) ?? 0).toFixed(2),
      expected: (expected.get(key) ?? 0).toFixed(2)
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

export const getPaymentMethodBreakdown = async (
  schoolId: IdInput,
  filters: PeriodFilter = {}
) => {
  const { from, to } = resolvePeriod(filters);

  const grouped = await prisma.fee_transactions.groupBy({
    by: ["payment_method"],
    where: {
      school_id: toBigInt(schoolId),
      paid_at: { gte: from, lte: to }
    },
    _sum: { amount: true },
    _count: true,
    orderBy: { payment_method: "asc" }
  });

  return grouped.map((row) => ({
    payment_method: row.payment_method,
    amount: num(row._sum?.amount).toFixed(2),
    count: row._count
  }));
};

export const getExpensesByCategory = async (
  schoolId: IdInput,
  filters: PeriodFilter = {}
) => {
  const { from, to } = resolvePeriod(filters);

  const grouped = await prisma.expenses.groupBy({
    by: ["category"],
    where: {
      school_id: toBigInt(schoolId),
      deleted_at: null,
      expense_date: { gte: from, lte: to }
    },
    _sum: { amount: true },
    _count: true,
    orderBy: { category: "asc" }
  });

  return grouped
    .map((row) => ({
      category: row.category,
      amount: num(row._sum?.amount).toFixed(2),
      count: row._count
    }))
    .sort((a, b) => Number(b.amount) - Number(a.amount));
};

export const getDefaulters = async (
  schoolId: IdInput,
  limit = 50
) => {
  const assignments = await prisma.student_fee_assignments.findMany({
    where: {
      school_id: toBigInt(schoolId),
      status: { in: ["overdue", "unpaid"] }
    },
    orderBy: { balance: "desc" },
    take: limit,
    include: {
      student: {
        select: { id: true, first_name: true, last_name: true, student_id_number: true }
      },
      fee_structure: { select: { name: true } }
    }
  });

  return assignments.map((a) => ({
    assignment_id: a.id.toString(),
    student_id: a.student_id.toString(),
    student_name: `${a.student.first_name} ${a.student.last_name}`,
    student_number: a.student.student_id_number,
    fee: a.fee_structure.name,
    amount_due: a.amount_due.toString(),
    amount_paid: a.amount_paid.toString(),
    balance: a.balance.toString(),
    due_date: a.due_date,
    status: a.status
  }));
};

export const getPayrollSummaryByDepartment = async (
  schoolId: IdInput,
  filters: { payroll_run_id?: string } = {}
) => {
  const where: Prisma.payslipsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null
  };

  if (filters.payroll_run_id) {
    where.payroll_run_id = toBigInt(filters.payroll_run_id);
  }

  const payslips = await prisma.payslips.findMany({
    where,
    select: {
      gross_salary: true,
      total_deductions: true,
      net_salary: true,
      staff: { select: { department: true } }
    }
  });

  const byDepartment = new Map<
    string,
    { employees: number; gross: number; deductions: number; net: number }
  >();

  for (const slip of payslips) {
    const key = slip.staff.department ?? "Unassigned";
    const current = byDepartment.get(key) ?? {
      employees: 0,
      gross: 0,
      deductions: 0,
      net: 0
    };

    current.employees += 1;
    current.gross += Number(slip.gross_salary);
    current.deductions += Number(slip.total_deductions);
    current.net += Number(slip.net_salary);
    byDepartment.set(key, current);
  }

  return Array.from(byDepartment.entries())
    .map(([department, totals]) => ({
      department,
      employees: totals.employees,
      gross: totals.gross.toFixed(2),
      deductions: totals.deductions.toFixed(2),
      net: totals.net.toFixed(2)
    }))
    .sort((a, b) => Number(b.net) - Number(a.net));
};

export const getInventoryValuation = async (schoolId: IdInput) => {
  const items = await prisma.inventory_items.findMany({
    where: { school_id: toBigInt(schoolId), deleted_at: null },
    include: { supplier: { select: { name: true } } },
    orderBy: { item_name: "asc" }
  });

  const rows = items.map((item) => ({
    id: item.id.toString(),
    code: item.code,
    item_name: item.item_name,
    category: item.category,
    supplier_name: item.supplier?.name ?? null,
    quantity: item.quantity,
    unit_cost: item.unit_cost.toString(),
    total_value: item.unit_cost.mul(item.quantity).toString(),
    reorder_level: item.reorder_level,
    is_low_stock: item.quantity < item.reorder_level,
    status: item.status
  }));

  return {
    items: rows,
    total_value: rows.reduce((sum, r) => sum + Number(r.total_value), 0).toFixed(2),
    low_stock_count: rows.filter((r) => r.is_low_stock).length
  };
};

export const getCollectionReport = async (
  schoolId: IdInput,
  filters: PeriodFilter = {}
) => {
  const { from, to } = resolvePeriod(filters);
  const school = toBigInt(schoolId);

  const [monthly, methods, totals] = await Promise.all([
    getMonthlyCollections(schoolId, filters),
    getPaymentMethodBreakdown(schoolId, filters),
    prisma.fee_transactions.aggregate({
      where: { school_id: school, paid_at: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true
    })
  ]);

  return {
    period: { from, to },
    monthly,
    by_payment_method: methods,
    total_collected: num(totals._sum.amount).toFixed(2),
    transaction_count: totals._count
  };
};
