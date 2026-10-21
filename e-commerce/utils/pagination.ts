export function getPaginationPages(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "after", totalPages];
  if (currentPage >= totalPages - 3) return [1, "before", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "before", currentPage - 1, currentPage, currentPage + 1, "after", totalPages];
}
