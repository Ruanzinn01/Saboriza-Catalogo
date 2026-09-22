import { CircleDollarSign, PackagePlus, Target } from "lucide-react";
import { MetricTile } from "@/components/admin/ProductProfitabilityCard";
import { formatCurrency } from "@/lib/currency";
import { COST_BASIS_LABELS } from "@/types/raw-material";
import type { RawMaterial, RawMaterialInput } from "@/types/raw-material";

interface RawMaterialCostCardProps {
  form: RawMaterialInput;
  material?: RawMaterial;
}

const valueClasses = "text-xl font-extrabold leading-tight text-ink-900";

export function RawMaterialCostCard({ form, material }: RawMaterialCostCardProps) {
  const unit = form.controlUnit;
  const reorder = form.defaultReorderQty > 0 ? `${form.defaultReorderQty.toLocaleString("pt-BR")} ${unit}` : "—";
  const lead = form.leadTimeDays > 0 ? `${form.leadTimeDays} ${form.leadTimeDays === 1 ? "dia" : "dias"} de prazo` : "Prazo não definido";

  return (
    <section className="rounded-3xl border-2 border-ink-900/20 bg-white p-4 sm:p-5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900">Custo e reposição</h2>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <MetricTile icon={<CircleDollarSign size={22} />} label={`Custo médio atual (por ${unit})`}>
          <p className={valueClasses}>{material ? formatCurrency(material.avgCost) : "—"}</p>
        </MetricTile>

        <MetricTile icon={<Target size={22} />} label="Base de custo para previsão" iconTone="text-forest-700">
          <p className="text-sm font-extrabold leading-tight text-ink-900">{COST_BASIS_LABELS[form.costBasis]}</p>
          {form.costBasis === "manual" && <p className="text-[11px] text-ink-muted">{formatCurrency(form.manualCost)} por {unit}</p>}
        </MetricTile>

        <MetricTile icon={<PackagePlus size={22} />} label="Reposição padrão" iconTone="text-gold-600">
          <p className={valueClasses}>{reorder}</p>
          <p className="text-[11px] text-ink-muted">{lead}</p>
        </MetricTile>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        O saldo e o custo médio só mudam por entrada confirmada. Use "Nova entrada" para registrar uma compra.
      </p>
    </section>
  );
}
