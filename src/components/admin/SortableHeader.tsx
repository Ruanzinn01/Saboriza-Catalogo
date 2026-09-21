import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface SortableHeaderProps {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onSort: () => void;
  className?: string;
}

export function SortableHeader({ label, active, dir, onSort, className }: SortableHeaderProps) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-3", className)}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-bold uppercase tracking-wide hover:text-forest-800",
          active ? "text-forest-900" : "text-ink-700"
        )}
      >
        {label}
        <Icon size={13} aria-hidden />
      </button>
    </th>
  );
}
