type PaginationInput = {
  page?: unknown;
  limit?: unknown;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intValue = Math.floor(parsed);
  if (intValue <= 0) return fallback;
  return intValue;
}

export function resolvePagination(input: PaginationInput): PaginationMeta {
  const page = toPositiveInt(input.page, DEFAULT_PAGE);
  const requestedLimit = toPositiveInt(input.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit,
  };
}

export function paginatedResponse<T>(params: {
  data: T[];
  total: number;
  page: number;
  limit: number;
  extra?: Record<string, unknown>;
}) {
  const { data, total, page, limit, extra } = params;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    ...(extra || {}),
  };
}

