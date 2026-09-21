import { type ReactNode } from "react";
import { Box, CheckCircle2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { percentOf, type ProductKpis, type StockBucket } from "@/lib/product-list";

interface CardProps {
  icon: ReactNode;
  iconClass: string;
  barClass?: string;
  label: string;
  value: number;
  percent?: number;
  selected?: boolean;
  onSelect?: () => void;
}

function KpiCard({ icon, iconClass, barClass, label, value, percent, selected, onSelect }: CardProps) {
  const Wrapper = onSelect ? "button" : "div";
  return (
    <Wrapper
      {...(onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": selected } : {})}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border bg-white px-3 py-3 text-left transition-colors",
        selected ? "border-forest-700 bg-forest-700/5" : "border-forest-950/10",
        onSelect && "cursor-pointer hover:bg-forest-950/[0.03]"
      )}
    >
      <span aria-hidden className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", iconClass)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-ink-700">{label}</p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-extrabold leading-tight text-ink-900">{value}</p>
          {percent !== undefined && <p className="text-xs font-semibold text-ink-700">{percent}%</p>}
        </div>
        {percent !== undefined && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-900/10" aria-hidden>
            <div className={cn("h-full rounded-full", barClass)} style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    </Wrapper>
  );
}

interface ProductsKpiCardsProps {
  kpis: ProductKpis;
  totalLabel?: string;
  selected?: StockBucket | null;
  onSelect?: (bucket: StockBucket) => void;
}

export function ProductsKpiCards({ kpis, totalLabel = "Total de Produtos", selected, onSelect }: ProductsKpiCardsProps) {
  const pick = (bucket: StockBucket) => (onSelect ? () => onSelect(bucket) : undefined);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard icon={<Box size={22} />} iconClass="bg-ink-900/5 text-ink-700" label={totalLabel} value={kpis.total} />
      <KpiCard
        icon={<CheckCircle2 size={22} />}
        iconClass="bg-forest-700/15 text-forest-700"
        barClass="bg-forest-600"
        label="Estoque OK"
        value={kpis.ok}
        percent={percentOf(kpis.ok, kpis.total)}
        selected={selected === "ok"}
        onSelect={pick("ok")}
      />
      <KpiCard
        icon={<TriangleAlert size={22} />}
        iconClass="bg-amber-500/15 text-amber-600"
        barClass="bg-amber-500"
        label="Estoque Baixo"
        value={kpis.low}
        percent={percentOf(kpis.low, kpis.total)}
        selected={selected === "low"}
        onSelect={pick("low")}
      />
      <KpiCard
        icon={<TriangleAlert size={22} />}
        iconClass="bg-red-500/10 text-red-600"
        barClass="bg-red-600"
        label="Sem Estoque"
        value={kpis.out}
        percent={percentOf(kpis.out, kpis.total)}
        selected={selected === "out"}
        onSelect={pick("out")}
      />
    </div>
  );
}
