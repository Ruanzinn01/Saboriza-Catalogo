import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { StockStatusPill } from "@/components/admin/ProductListParts";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { ProductBucket } from "@/lib/product-list";
import type { RawMaterial, RawMaterialInput } from "@/types/raw-material";

interface RawMaterialSummaryCardProps {
  form: RawMaterialInput;
  material?: RawMaterial;
  bucket?: ProductBucket;
}

const fmt = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-forest-950/10 bg-white px-3 py-2">
      <p className="truncate text-[11px] font-medium text-ink-700">{label}</p>
      <p className="truncate text-sm font-extrabold text-ink-900">{value}</p>
    </div>
  );
}

export function RawMaterialSummaryCard({ form, material, bucket }: RawMaterialSummaryCardProps) {
  const unit = form.controlUnit;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900">Resumo do insumo</h2>
        {material && (
          <Link
            to={`/admin/materias-primas/${material.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-forest-900/20 px-3 text-xs font-semibold text-forest-900 hover:bg-forest-900/5"
          >
            <ExternalLink size={14} /> Ver detalhes
          </Link>
        )}
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-forest-950/5">
        <ProductImage imageUrl={form.imageUrl} name={form.name || "Insumo"} />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-base font-bold leading-tight text-ink-900">{form.name.trim() || "Novo insumo"}</p>
        <p className="font-mono text-xs text-ink-muted">{material?.code ?? "Código gerado ao salvar"}</p>
        <p className="text-sm text-ink-700/70">
          {form.category || "Sem categoria"} · {form.purchaseUnitLabel || unit}
        </p>
        {!form.isActive && (
          <span className="mt-1 w-fit rounded-full bg-ink-900/10 px-2 py-0.5 text-[11px] font-bold text-ink-700">Inativo</span>
        )}
        {material && bucket && (
          <div className="mt-1">
            <StockStatusPill bucket={bucket} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Saldo atual" value={material ? `${fmt(material.currentStock)} ${unit}` : "—"} />
        <Tile label="Mínimo" value={`${fmt(form.minStock)} ${unit}`} />
        <Tile label="Máximo" value={form.maxStock > 0 ? `${fmt(form.maxStock)} ${unit}` : "—"} />
      </div>
    </section>
  );
}
