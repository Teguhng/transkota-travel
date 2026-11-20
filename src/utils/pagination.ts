export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  hasPrev: boolean;
  hasNext: boolean;
  pages: Array<number | '...'>;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

function buildPageWindow(currentPage: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages: Array<number | '...'> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    pages.push('...');
  }

  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push(p);
  }

  if (windowEnd < totalPages - 1) {
    pages.push('...');
  }

  pages.push(totalPages);
  return pages;
}

export function buildPaginationMeta(
  totalItems: number,
  requestedPage = 1,
  pageSize = 12
): PaginationMeta {
  const safeSize = Math.max(1, Math.trunc(pageSize) || 12);
  const safeTotal = Math.max(0, Math.trunc(totalItems) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize));
  const rawPage = Math.trunc(requestedPage) || 1;
  const page = Math.min(Math.max(1, rawPage), totalPages);

  const startItem = safeTotal === 0 ? 0 : (page - 1) * safeSize + 1;
  const endItem = safeTotal === 0 ? 0 : Math.min(page * safeSize, safeTotal);

  return {
    page,
    pageSize: safeSize,
    totalItems: safeTotal,
    totalPages,
    startItem,
    endItem,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    pages: buildPageWindow(page, totalPages),
  };
}

export function paginateItems<T>(
  items: T[],
  requestedPage = 1,
  pageSize = 12
): PaginatedResult<T> {
  const pagination = buildPaginationMeta(items.length, requestedPage, pageSize);
  const offset = (pagination.page - 1) * pagination.pageSize;
  return {
    items: items.slice(offset, offset + pagination.pageSize),
    pagination,
  };
}
