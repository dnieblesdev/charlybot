/**
 * Generic paginated response contract.
 * Matches the API response format: { data, total, page, limit, totalPages }
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
