import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

type SmsUsageFilters = {
  from?: string;
  to?: string;
  schoolId?: string;
};

type CountRow = {
  total: bigint;
  sent: bigint;
  failed: bigint;
  pending: bigint;
};

type SpendRow = {
  currency: string;
  total_spend: Prisma.Decimal;
};

type SchoolRow = {
  school_id: bigint;
  school_name: string;
  country: string | null;
  total: bigint;
  sent: bigint;
  failed: bigint;
  pending: bigint;
  currency: string;
  total_spend: Prisma.Decimal;
};

type TrendRow = {
  day: Date;
  currency: string;
  total: bigint;
  sent: bigint;
  total_spend: Prisma.Decimal;
};

const startOfCurrentMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const nextMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 1);

const parseFrom = (value?: string) => (value ? new Date(value) : startOfCurrentMonth());

const parseToExclusive = (value: string | undefined, from: Date) => {
  if (!value) return nextMonth(from);
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setDate(date.getDate() + 1);
  }
  return date;
};

export const getSmsUsage = async (filters: SmsUsageFilters = {}) => {
  const from = parseFrom(filters.from);
  const to = parseToExclusive(filters.to, from);
  const schoolId = filters.schoolId ? BigInt(filters.schoolId) : null;
  const schoolFilter = schoolId ? Prisma.sql`AND nl.school_id = ${schoolId}` : Prisma.empty;

  const [countRows, spendRows, schoolRows, trendRows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE nl.status IN ('sent', 'delivered'))::bigint AS sent,
        COUNT(*) FILTER (WHERE nl.status = 'failed')::bigint AS failed,
        COUNT(*) FILTER (WHERE nl.status IN ('queued', 'retry'))::bigint AS pending
      FROM notification_logs nl
      WHERE nl.channel = 'sms'
        AND nl.created_at >= ${from}
        AND nl.created_at < ${to}
        ${schoolFilter}
    `),
    prisma.$queryRaw<SpendRow[]>(Prisma.sql`
      SELECT
        nl.sms_currency AS currency,
        COALESCE(SUM(nl.sms_cost) FILTER (WHERE nl.status IN ('sent', 'delivered')), 0) AS total_spend
      FROM notification_logs nl
      WHERE nl.channel = 'sms'
        AND nl.created_at >= ${from}
        AND nl.created_at < ${to}
        ${schoolFilter}
      GROUP BY nl.sms_currency
      ORDER BY nl.sms_currency
    `),
    prisma.$queryRaw<SchoolRow[]>(Prisma.sql`
      SELECT
        s.id AS school_id,
        s.name AS school_name,
        s.country,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE nl.status IN ('sent', 'delivered'))::bigint AS sent,
        COUNT(*) FILTER (WHERE nl.status = 'failed')::bigint AS failed,
        COUNT(*) FILTER (WHERE nl.status IN ('queued', 'retry'))::bigint AS pending,
        nl.sms_currency AS currency,
        COALESCE(SUM(nl.sms_cost) FILTER (WHERE nl.status IN ('sent', 'delivered')), 0) AS total_spend
      FROM notification_logs nl
      INNER JOIN schools s ON s.id = nl.school_id
      WHERE nl.channel = 'sms'
        AND nl.created_at >= ${from}
        AND nl.created_at < ${to}
        ${schoolFilter}
      GROUP BY s.id, s.name, s.country, nl.sms_currency
      ORDER BY total_spend DESC, total DESC, s.name ASC
    `),
    prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', nl.created_at) AS day,
        nl.sms_currency AS currency,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE nl.status IN ('sent', 'delivered'))::bigint AS sent,
        COALESCE(SUM(nl.sms_cost) FILTER (WHERE nl.status IN ('sent', 'delivered')), 0) AS total_spend
      FROM notification_logs nl
      WHERE nl.channel = 'sms'
        AND nl.created_at >= ${from}
        AND nl.created_at < ${to}
        ${schoolFilter}
      GROUP BY date_trunc('day', nl.created_at), nl.sms_currency
      ORDER BY day ASC, nl.sms_currency ASC
    `)
  ]);

  const counts = countRows[0] ?? { total: 0n, sent: 0n, failed: 0n, pending: 0n };

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      total: Number(counts.total),
      sent: Number(counts.sent),
      failed: Number(counts.failed),
      pending: Number(counts.pending),
      spend_by_currency: spendRows.map((row) => ({
        currency: row.currency.trim(),
        amount: Number(row.total_spend)
      }))
    },
    schools: schoolRows.map((row) => ({
      school_id: row.school_id.toString(),
      school_name: row.school_name,
      country: row.country,
      total: Number(row.total),
      sent: Number(row.sent),
      failed: Number(row.failed),
      pending: Number(row.pending),
      currency: row.currency.trim(),
      total_spend: Number(row.total_spend)
    })),
    trend: trendRows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      currency: row.currency.trim(),
      total: Number(row.total),
      sent: Number(row.sent),
      total_spend: Number(row.total_spend)
    }))
  };
};
