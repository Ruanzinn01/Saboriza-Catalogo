import { ArrowUpToLine, CheckCircle2, Settings, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/number";
import { productBucket, type ProductBucket } from "@/lib/product-list";

interface ProductStockStatusBarProps {
  currentStock: number;
  minStock: number;
  maxStock: number;
  onConfigure: () => void;
  level?: ProductBucket;
  unit?: string;
  subject?: string;
}

const items: { level: ProductBucket; title: string; iconClass: string; circleClass: string; titleClass: string }[] = [
  { level: "ok", title: "Estoque normal", iconClass: "text-forest-700", circleClass: "bg-forest-700/15", titleClass: "text-forest-800" },
  { level: "low", title: "Estoque baixo", iconClass: "text-amber-600", circleClass: "bg-amber-500/15", titleClass: "text-amber-700" },
  { level: "out", title: "Estoque zerado", iconClass: "text-red-600", circleClass: "bg-red-500/10", titleClass: "text-red-600" },
  { level: "over", title: "Estoque máximo", iconClass: "text-blue-600", circleClass: "bg-blue-500/10", titleClass: "text-blue-700" },
];

export function ProductStockStatusBar({ currentStock, minStock, maxStock, onConfigure, level, unit = "unid.", subject = "Produto" }: ProductStockStatusBarProps) {
  const active = level ?? productBucket({ currentStock, minStock, maxStock });

  function detail(level: ProductBucket) {
    if (level === "ok") return `${formatNumber(currentStock)} ${unit} em estoque`;
    if (level === "low") return `Mínimo: ${formatNumber(minStock)} ${unit}`;
    if (level === "over") return maxStock > 0 ? `Máximo: ${formatNumber(maxStock)} ${unit}` : "Máximo não definido";
    return `${subject} indisponível`;
  }

  return (
    <section
      aria-label="Situação do estoque"
      className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <li
            key={item.level}
            aria-current={active === item.level ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors",
              active === item.level ? "bg-forest-950/5 ring-1 ring-forest-950/10" : "opacity-70"
            )}
          >
            <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", item.circleClass, item.iconClass)}>
              {item.level === "ok" ? <CheckCircle2 size={22} /> : item.level === "over" ? <ArrowUpToLine size={22} /> : <TriangleAlert size={22} />}
            </span>
            <div className="min-w-0">
              <p className={cn("text-sm font-bold leading-tight", item.titleClass)}>{item.title}</p>
              <p className="text-xs text-ink-muted">{detail(item.level)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" onClick={onConfigure}>
        <Settings size={16} /> Configurar estoque
      </Button>
    </section>
  );
}
