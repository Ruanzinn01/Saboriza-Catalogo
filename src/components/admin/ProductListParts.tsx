import { FileWarning } from "lucide-react";
import { cn } from "@/lib/cn";
import { SETUP_GAP_LABELS, stockFillPct, type MarginState, type ProductBucket, type ProductRow, type SetupGap } from "@/lib/product-list";
import { formatPercent } from "@/lib/product-profitability";

const bucketLabels: Record<ProductBucket, string> = {
  ok: "Em estoque",
  low: "Estoque baixo",
  out: "Sem estoque",
  over: "Acima do máximo",
};

const pillClasses: Record<ProductBucket, string> = {
  ok: "bg-forest-700/10 text-forest-800",
  low: "bg-amber-500/15 text-amber-800",
  out: "bg-red-500/10 text-red-700",
  over: "bg-blue-500/10 text-blue-700",
};

const dotClasses: Record<ProductBucket, string> = {
  ok: "bg-forest-600",
  low: "bg-amber-500",
  out: "bg-red-600",
  over: "bg-blue-500",
};

export const stockBucketLabel = (bucket: ProductBucket) => bucketLabels[bucket];

export function StockStatusPill({ bucket }: { bucket: ProductBucket }) {
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
  maxStock?: number;
  bucket: ProductBucket;
  unit?: string;
}

const fmt = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function StockMeter({ name, currentStock, minStock, maxStock = 0, bucket, unit = "un" }: StockMeterProps) {
  const fill = stockFillPct({ currentStock, minStock, maxStock });
  return (
    <div className="flex w-28 flex-col gap-1">
      <p className={cn("text-sm font-bold leading-none", bucket === "out" ? "text-red-600" : "text-ink-900")}>
        {fmt(currentStock)} {unit}
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
      <p className="text-xs text-ink-muted">
        Min: {fmt(minStock)}
        {maxStock > 0 && <> · Máx: {fmt(maxStock)}</>}
      </p>
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

export function SetupAlertChip({ gaps }: { gaps: SetupGap[] }) {
  if (gaps.length === 0) return null;
  const missing = gaps.map((gap) => SETUP_GAP_LABELS[gap]).join(", ");
  return (
    <span
      title={`Falta conectar: ${missing}`}
      className="mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-bold text-violet-700"
    >
      <FileWarning size={12} aria-hidden />
      Sem ficha técnica
      <span className="sr-only">. Falta: {missing}</span>
    </span>
  );
}
