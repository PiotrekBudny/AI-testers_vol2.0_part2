import type { PageDto } from '@/models/pageDto';

export function pageOf<T>(all: T[], page: number, size: number): PageDto<T> {
  return {
    content: all.slice(page * size, (page + 1) * size),
    pageNumber: page,
    pageSize: size,
    totalElements: all.length,
    totalPages: Math.ceil(all.length / size),
  };
}
