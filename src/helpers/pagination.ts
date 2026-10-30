type QueryValue = string | string[] | undefined | null;

const normalizeQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value === "string") {
    return value;
  }

  return undefined;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export type PaginationParams = {
  page: number;
  limit: number;
  sort?: string;
  order?: "asc" | "desc";
  q?: string;
};

export const parsePagination = (
  query: Record<string, QueryValue>
): PaginationParams => {
  const page = parsePositiveInt(normalizeQueryValue(query.page), 1);
  const limit = clamp(
    parsePositiveInt(normalizeQueryValue(query.limit), 20),
    1,
    5000
  );

  const sort = normalizeQueryValue(query.sort);
  const orderValue = normalizeQueryValue(query.order);
  const order = orderValue === "asc" || orderValue === "desc" ? orderValue : undefined;
  const q = normalizeQueryValue(query.q);

  return {
    page,
    limit,
    sort,
    order,
    q: q || undefined
  };
};
