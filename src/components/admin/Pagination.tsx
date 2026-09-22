import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/number";
import { pageNumbers } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: number[];
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const pageButton =
  "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40";

export function Pagination({
  page,
  totalPages,
  pageSize,
  pageSizeOptions = [10, 25, 50],
  total,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-forest-950/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-ink-700">
        <label htmlFor="pagination-size">Exibir</label>
        <select
          id="pagination-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-9 rounded-lg border border-ink-900/15 bg-white px-2 text-sm outline-none focus:border-forest-700"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span>
          de {formatNumber(total)} {itemLabel}
        </span>
      </div>

      <nav aria-label="Paginação" className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className={cn(pageButton, "border-ink-900/15 bg-white text-ink-700 hover:bg-ink-900/5")}
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers(page, totalPages).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} aria-hidden className="flex h-9 min-w-9 items-center justify-center text-sm text-ink-muted">
              ...
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              aria-label={`Página ${entry}`}
              className={cn(
                pageButton,
                entry === page ? "border-forest-900 bg-forest-900 text-cream-50" : "border-ink-900/15 bg-white text-ink-700 hover:bg-ink-900/5"
              )}
            >
              {entry}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
          className={cn(pageButton, "border-ink-900/15 bg-white text-ink-700 hover:bg-ink-900/5")}
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}
