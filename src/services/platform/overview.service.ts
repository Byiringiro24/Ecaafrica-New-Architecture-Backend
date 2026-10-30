import { prisma } from "../../database/prisma";
import type { Prisma } from "@prisma/client";

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && "toString" in (value as Record<string, unknown>)) {
    return Number((value as { toString: () => string }).toString());
  }
  return 0;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const getPlatformOverview = async () => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const trendStart = addMonths(monthStart, -11);
  const trendEnd = addMonths(monthStart, 1);

  const [
    totalSchools,
    activeSchools,
    totalStudents,
    activeSubscriptions,
    supportOpen,
    smsMonthly,
    newSchools,
    mrrRows,
    mrrTrendRows,
    schoolGrowthRows,
  ] = await prisma.$transaction([
    prisma.schools.count({ where: { deleted_at: null } }),
    prisma.schools.count({ where: { deleted_at: null, status: "active" } }),
    prisma.students.count({ where: { deleted_at: null } }),
    prisma.school_subscriptions.count({
      where: { status: { in: ["active", "trial", "grace"] } },
    }),
    prisma.support_tickets.count({
      where: { status: { in: ["open", "in_progress"] } },
    }),
    prisma.notification_logs.count({
      where: { channel: "sms", created_at: { gte: monthStart } },
    }),
    prisma.schools.count({ where: { deleted_at: null, created_at: { gte: monthStart } } }),
    prisma.$queryRaw<{ mrr: Prisma.Decimal | null }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN billing_cycle = 'monthly' THEN amount ELSE amount / 12 END), 0) AS mrr
      FROM school_subscriptions
      WHERE status IN ('active', 'trial', 'grace')
    `,
    prisma.$queryRaw<{ month: string; total: Prisma.Decimal | null }[]>`
      SELECT
        to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
        COALESCE(SUM(total), 0) AS total
      FROM invoices
      WHERE status = 'paid' AND paid_at IS NOT NULL
        AND paid_at >= ${trendStart} AND paid_at < ${trendEnd}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<{ month: string; total: Prisma.Decimal | null }[]>`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COUNT(*) AS total
      FROM schools
      WHERE deleted_at IS NULL
        AND created_at >= ${trendStart} AND created_at < ${trendEnd}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const mrr = toNumber(mrrRows[0]?.mrr ?? 0);

  const trendMap = new Map(
    mrrTrendRows.map((row) => [row.month, toNumber(row.total ?? 0)])
  );
  const schoolGrowthMap = new Map(
    schoolGrowthRows.map((row) => [row.month, Number(row.total ?? 0)])
  );

  const mrrTrend = Array.from({ length: 12 }, (_, index) => {
    const monthDate = addMonths(trendStart, index);
    const monthKey = formatMonthKey(monthDate);
    return {
      month: monthKey,
      mrr: trendMap.get(monthKey) ?? 0,
    };
  });

  const schoolGrowth = Array.from({ length: 12 }, (_, index) => {
    const monthDate = addMonths(trendStart, index);
    const monthKey = formatMonthKey(monthDate);
    return {
      month: monthKey,
      schools: schoolGrowthMap.get(monthKey) ?? 0,
    };
  });

  return {
    schools: {
      total: totalSchools,
      active: activeSchools,
      new: newSchools,
    },
    students: {
      total: totalStudents,
    },
    subscriptions: {
      active: activeSubscriptions,
    },
    mrr,
    smsMonthly,
    supportOpen,
    mrrTrend,
    schoolGrowth,
  };
};
