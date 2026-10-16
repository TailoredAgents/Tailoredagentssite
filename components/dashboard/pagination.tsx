import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function pageHref(basePath: string, page: number, values: Record<string, string>) {
  const params = new URLSearchParams(values);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function DashboardPagination({
  basePath,
  page,
  pages,
  values = {},
}: {
  basePath: string;
  page: number;
  pages: number;
  values?: Record<string, string>;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="dashboard-pagination" aria-label="Pagination">
      {page > 1 ? <Link href={pageHref(basePath, page - 1, values)}><ChevronLeft size={14} />Previous</Link> : <span />}
      <small>Page {page} of {pages}</small>
      {page < pages ? <Link href={pageHref(basePath, page + 1, values)}>Next<ChevronRight size={14} /></Link> : <span />}
    </nav>
  );
}
