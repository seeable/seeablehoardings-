/**
 * Offset pagination — api-specification.md §9. One mechanism, every collection.
 *   query:  ?page=1&pageSize=20   (pageSize 1..100, page ≥ 1)
 *   body:   meta.pagination = { page, page_size, total, total_pages, has_next, has_previous }
 * Note the casing shift (§9.2): request `pageSize`, response `page_size`.
 */
import { ApiError } from "@/lib/api/errors";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  pageSize: number;
  /** Supabase `.range(from, to)` — inclusive, zero-based. */
  from: number;
  to: number;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

/** Parse + validate. `page=0`, `pageSize=101`, non-integers -> 400 INVALID_PAGINATION (§9.3). */
export function parsePagination(searchParams: URLSearchParams): Pagination {
  const page = intParam(searchParams.get("page"), 1);
  const pageSize = intParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);

  if (
    page === null ||
    pageSize === null ||
    page < 1 ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE
  ) {
    throw ApiError.of("INVALID_PAGINATION");
  }

  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

/** §9.2 metadata. `total` is the post-filter, post-visibility count. */
export function paginationMeta(
  total: number,
  { page, pageSize }: Pick<Pagination, "page" | "pageSize">,
): PaginationMeta {
  const total_pages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    page,
    page_size: pageSize,
    total,
    total_pages,
    has_next: page < total_pages,
    has_previous: page > 1,
  };
}

function intParam(raw: string | null, fallback: number): number | null {
  if (raw === null || raw === "") return fallback;
  if (!/^-?\d+$/.test(raw.trim())) return null; // non-integer -> invalid, not fallback
  return Number.parseInt(raw, 10);
}
