import { CheckCircle2, Settings, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { situationTone } from "@/lib/stock-insights";

interface ProductStockStatusBarProps {
  currentStock: number;
  minStock: number;
  onConfigure: () => void;
}

type Level = "normal" | "low" | "out";

const items: { level: Level; title: string; iconClass: string; circleClass: string; titleClass: string }[] = [
  { level: "normal", title: "Estoque normal", iconClass: "text-forest-700", circleClass: "bg-forest-700/15", titleClass: "text-forest-800" },
  { level: "low", title: "Estoque baixo", iconClass: "text-amber-600", circleClass: "bg-amber-500/15", titleClass: "text-amber-700" },
  { level: "out", title: "Estoque zerado", iconClass: "text-red-600", circleClass: "bg-red-500/10", titleClass: "text-red-600" },
];

export function ProductStockStatusBar({ currentStock, minStock, onConfigure }: ProductStockStatusBarProps) {
  const tone = situationTone({ currentStock, minStock });
  const active: Level = tone === "out" ? "out" : tone === "ok" ? "normal" : "low";

  function detail(level: Level) {
    if (level === "normal") return `${currentStock} unid. em estoque`;
    if (level === "low") return `Mínimo: ${minStock} unid.`;
    return "Produto indisponível";
  }

  return (
    <section
      aria-label="Situação do estoque"
      className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
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
              {item.level === "normal" ? <CheckCircle2 size={22} /> : <TriangleAlert size={22} />}
            </span>
            <div className="min-w-0">
              <p className={cn("text-sm font-bold leading-tight", item.titleClass)}>{item.title}</p>
              <p className="text-xs text-ink-muted">{detail(item.level)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" onClick={onConfigure}>
        <Settings size={16} /> Configurar estoque mínimo
      </Button>
    </section>
  );
}
