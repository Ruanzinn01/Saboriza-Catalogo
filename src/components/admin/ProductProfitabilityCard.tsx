import { type ReactNode, useId, useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Coins, FileText, Info, PieChart, Tag, Target, TrendingUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import { computeProfitability, computeUnitCost, formatPercent, formatPoints } from "@/lib/product-profitability";
import { useProductRecipeStore } from "@/store/product-recipe-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";

interface ProductProfitabilityCardProps {
  productId: string | null;
  price: number;
  targetPct: number;
  onTargetChange: (value: number) => void;
}

type Tone = "white" | "green" | "blue" | "amber" | "red";

const toneClasses: Record<Tone, string> = {
  white: "border border-forest-950/10 bg-white",
  green: "bg-forest-700/10",
  blue: "bg-blue-500/10",
  amber: "bg-amber-500/15",
  red: "bg-red-500/10",
};

const iconToneClasses: Record<Tone, string> = {
  white: "bg-forest-700/15 text-forest-700",
  green: "text-forest-700",
  blue: "text-blue-600",
  amber: "text-amber-700",
  red: "text-red-600",
};

export function MetricTile({
  icon,
  label,
  tone = "white",
  iconTone,
  children,
  className,
}: {
  icon: ReactNode;
  label: string;
  tone?: Tone;
  iconTone?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3", toneClasses[tone], className)}>
      <span
        aria-hidden
        className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", iconTone ?? iconToneClasses[tone])}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-tight text-ink-700">{label}</p>
        {children}
      </div>
    </div>
  );
}

const valueClasses = "text-xl font-extrabold leading-tight text-ink-900";

export function ProductProfitabilityCard({ productId, price, targetPct, onTargetChange }: ProductProfitabilityCardProps) {
  const infoId = useId();
  const [infoOpen, setInfoOpen] = useState(false);
  const recipeLines = useProductRecipeStore((state) => (productId ? state.linesByProduct[productId] : undefined));
  const materials = useRawMaterialsStore((state) => state.materials);

  const unitCost = useMemo(() => computeUnitCost(recipeLines ?? [], materials), [recipeLines, materials]);
  const result = useMemo(() => computeProfitability(price, unitCost, targetPct), [price, unitCost, targetPct]);

  const hasMargin = result.marginPct !== null;
  const margin = result.marginPct ?? 0;
  const fillPct = Math.min(100, Math.max(0, margin));
  const markerPct = Math.min(100, Math.max(0, targetPct));

  const statusTone: Tone = result.status === "on-target" ? "green" : result.status === "below-target" ? "red" : "amber";
  const statusLabel =
    result.status === "on-target"
      ? "Dentro da meta"
      : result.status === "below-target"
        ? "Abaixo da meta"
        : result.status === "no-recipe"
          ? "Sem ficha técnica"
          : "Sem preço";
  const StatusIcon = result.status === "on-target" ? CheckCircle2 : TriangleAlert;

  function scrollToRecipe() {
    document.getElementById("ficha-tecnica")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section aria-labelledby={`${infoId}-titulo`} className="rounded-3xl border-2 border-ink-900/20 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id={`${infoId}-titulo`} className="text-xs font-bold uppercase tracking-wide text-ink-900">
            Rentabilidade do produto
          </h2>
          <button
            type="button"
            onClick={() => setInfoOpen((open) => !open)}
            aria-expanded={infoOpen}
            aria-controls={infoId}
            aria-label="Como a rentabilidade é calculada"
            className="flex h-8 w-8 items-center justify-center rounded-full text-forest-900 hover:bg-forest-950/5"
          >
            <Info size={18} />
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={scrollToRecipe}>
          <FileText size={15} /> Ver ficha técnica
        </Button>
      </div>

      <p id={infoId} hidden={!infoOpen} className="mt-2 rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">
        Custo atual = soma da ficha técnica (quantidade × custo médio de cada insumo). Lucro real = preço − custo. Margem real = lucro ÷ preço.
        A margem desejada é a meta do produto.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MetricTile icon={<CircleDollarSign size={22} />} label="Custo atual (por unidade)">
          <p className={valueClasses}>{unitCost.hasRecipe ? formatCurrency(result.cost) : "—"}</p>
        </MetricTile>

        <MetricTile icon={<Tag size={20} />} label="Preço praticado" iconTone="text-gold-600">
          <p className={valueClasses}>{formatCurrency(price)}</p>
          <p className="text-[11px] text-ink-muted">(Preço unitário)</p>
        </MetricTile>

        <MetricTile icon={<Target size={22} />} label="Margem de lucro desejada (%)" iconTone="text-forest-700">
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.1"
              value={targetPct}
              onChange={(e) => onTargetChange(Math.min(100, Math.max(0, Number(e.target.value))))}
              aria-label="Margem de lucro desejada em porcentagem"
              className="h-11 w-full min-w-0 rounded-xl border border-ink-900/15 bg-white px-3 text-sm font-semibold text-ink-900 outline-none focus:border-forest-700"
            />
            <span className="text-sm text-ink-muted">%</span>
          </div>
        </MetricTile>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricTile icon={<Coins size={22} />} label="Lucro real (por unidade)" tone="green">
          <p className={valueClasses}>{result.profit !== null ? formatCurrency(result.profit) : "—"}</p>
        </MetricTile>

        <MetricTile icon={<PieChart size={22} />} label="Margem real" tone="green">
          <p className={cn(valueClasses, "text-forest-700")}>{hasMargin ? formatPercent(margin) : "—"}</p>
        </MetricTile>

        <MetricTile icon={<TrendingUp size={22} />} label="Diferença para a meta" tone="blue">
          <p className={cn(valueClasses, "text-blue-700")}>{result.gapPp !== null ? formatPoints(result.gapPp) : "—"}</p>
        </MetricTile>

        <MetricTile icon={<StatusIcon size={24} />} label="Situação" tone={statusTone}>
          <p className="text-sm font-extrabold leading-tight text-ink-900">{statusLabel}</p>
        </MetricTile>
      </div>

      {(unitCost.materialsWithoutCost > 0 || result.status === "no-recipe") && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          {result.status === "no-recipe"
            ? productId
              ? "Cadastre a ficha técnica abaixo para calcular o custo e a margem."
              : "Salve o produto e cadastre a ficha técnica para calcular o custo e a margem."
            : `${unitCost.materialsWithoutCost} insumo(s) da ficha sem custo médio (ainda sem entrada de nota). O custo real pode ser maior.`}
        </p>
      )}

      <div className="mt-5">
        <div
          role="img"
          aria-label={
            hasMargin
              ? `Margem real ${formatPercent(margin)}, meta ${formatPercent(targetPct)}`
              : "Margem real indisponível"
          }
          className="relative h-6 rounded-full bg-ink-900/10"
        >
          <div className="h-full rounded-full bg-forest-600 transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]" style={{ width: `${fillPct}%` }} />
          {hasMargin && (
            <span
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-sm font-extrabold",
                fillPct > 82 ? "right-2 text-cream-50" : "pl-2 text-forest-700"
              )}
              style={fillPct > 82 ? undefined : { left: `${fillPct}%` }}
            >
              {formatPercent(margin)}
            </span>
          )}
          <span
            aria-hidden
            className="absolute -top-2 bottom-[-8px] border-l-2 border-dashed border-ink-900/70"
            style={{ left: `${markerPct}%` }}
          />
        </div>
        <div className="relative mt-3 h-4">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-ink-900"
            style={{ left: `${Math.min(92, Math.max(8, markerPct))}%` }}
          >
            Meta: {formatPercent(targetPct, 0)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-full bg-forest-600" />
            Margem real ({hasMargin ? formatPercent(margin) : "—"})
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-full bg-ink-900/25" />
            Falta para a meta ({formatPercent(result.missingToTargetPct)})
          </span>
        </div>
      </div>
    </section>
  );
}
