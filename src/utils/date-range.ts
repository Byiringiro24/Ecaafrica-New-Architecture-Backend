/**
 * Build UTC boundaries for a calendar date.
 *
 * Attendance session_date is a PostgreSQL DATE, so date filters must not be
 * constructed with local-time Date arithmetic. Keeping the boundary at UTC
 * midnight makes the same YYYY-MM-DD value mean the same thing in every
 * server timezone.
 */
export const utcDayRange = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return { start: new Date(value), end: new Date(value) };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC normalises invalid dates (for example, 2026-02-31), so reject
  // those instead of silently querying a different calendar day.
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month - 1 ||
    start.getUTCDate() !== day
  ) {
    return { start: new Date("invalid"), end: new Date("invalid") };
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

export const utcDateRange = (startDate: string, endDate: string) => {
  const start = utcDayRange(startDate).start;
  const end = utcDayRange(endDate).end;
  return { start, end };
};
