import { cn } from "@/lib/cn";
import { stockFillPct, type MarginState, type ProductRow, type StockBucket } from "@/lib/product-list";
import { formatPercent } from "@/lib/product-profitability";

const bucketLabels: Record<StockBucket, string> = {
  ok: "Em estoque",
  low: "Estoque baixo",
  out: "Sem estoque",
};

const pillClasses: Record<StockBucket, string> = {
  ok: "bg-forest-700/10 text-forest-800",
  low: "bg-amber-500/15 text-amber-800",
  out: "bg-red-500/10 text-red-700",
};

const dotClasses: Record<StockBucket, string> = {
  ok: "bg-forest-600",
  low: "bg-amber-500",
  out: "bg-red-600",
};

export const stockBucketLabel = (bucket: StockBucket) => bucketLabels[bucket];

export function StockStatusPill({ bucket }: { bucket: StockBucket }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", pillClasses[bucket])}>
      <span aria-hidden className={cn("h-2 w-2 rounded-full", dotClasses[bucket])} />
      {bucketLabels[bucket]}
    </span>
  );
}

interface StockMeterProps {
  name: string;
  currentStock: number;
  minStock: number;
  bucket: StockBucket;
  unit?: string;
}

export function StockMeter({ name, currentStock, minStock, bucket, unit = "un" }: StockMeterProps) {
  const fill = stockFillPct({ currentStock, minStock });
  return (
    <div className="flex w-28 flex-col gap-1">
      <p className={cn("text-sm font-bold leading-none", bucket === "out" ? "text-red-600" : "text-ink-900")}>
        {currentStock.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unit}
      </p>
      <div
        role="progressbar"
        aria-label={`Nível de estoque de ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        className="h-1.5 overflow-hidden rounded-full bg-ink-900/10"
      >
        <div className={cn("h-full rounded-full", dotClasses[bucket])} style={{ width: `${fill}%` }} />
      </div>
      <p className="text-xs text-ink-muted">Min: {minStock.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</p>
    </div>
  );
}

const marginClasses: Record<MarginState, string> = {
  "on-target": "bg-forest-700/10 text-forest-800",
  "below-target": "bg-red-500/10 text-red-700",
  none: "bg-ink-900/5 text-ink-muted",
};

export function MarginChip({ marginPct, marginState }: Pick<ProductRow, "marginPct" | "marginState">) {
  const label = marginPct === null ? "—" : formatPercent(marginPct, 0);
  const title =
    marginState === "none"
      ? "Sem ficha técnica cadastrada: margem indisponível"
      : marginState === "on-target"
        ? "Margem dentro da meta do produto"
        : "Margem abaixo da meta do produto";
  return (
    <span title={title} className={cn("inline-flex min-w-14 justify-center rounded-full px-3 py-1 text-sm font-bold", marginClasses[marginState])}>
      {label}
    </span>
  );
}
