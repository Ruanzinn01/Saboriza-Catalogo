import { Link } from "react-router-dom";
import { Eye, PackagePlus, Pencil } from "lucide-react";
import { StockMeter, StockStatusPill } from "@/components/admin/ProductListParts";
import { MaterialThumb } from "@/components/admin/RawMaterialsTable";
import { formatCurrency } from "@/lib/currency";
import { replenishmentSummary, type RawMaterialRow } from "@/lib/raw-material-list";

const iconLink = "flex h-11 w-11 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5";

export function RawMaterialsMobileList({ rows }: { rows: RawMaterialRow[] }) {
  return (
    <ul className="flex flex-col gap-3 p-3 lg:hidden">
      {rows.map((row) => {
        const { material } = row;
        const replenishment = replenishmentSummary(material);
        return (
          <li key={material.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
            <div className="flex items-start gap-3">
              <MaterialThumb imageUrl={material.imageUrl} className="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <Link to={`/admin/materias-primas/${material.id}`} className="block truncate font-semibold text-ink-900">
                  {material.name}
                </Link>
                <p className="font-mono text-xs text-ink-muted">
                  {material.code} · {material.category || "-----"}
                </p>
                <p className="text-xs text-ink-muted">{material.purchaseUnitLabel || material.controlUnit}</p>
                {!material.isActive && (
                  <span className="mt-1 inline-block rounded-full bg-ink-900/10 px-2 py-0.5 text-[11px] font-bold text-ink-700">Inativo</span>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <StockMeter name={material.name} currentStock={material.currentStock} minStock={material.minStock} unit={material.controlUnit} bucket={row.bucket} />
              <div className="text-right">
                <p className="text-sm font-bold text-ink-900">{formatCurrency(material.avgCost)}</p>
                <p className="text-xs text-ink-muted">custo médio</p>
                {replenishment && <p className="text-xs text-ink-muted">Repor: {replenishment}</p>}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <StockStatusPill bucket={row.bucket} />
              <div className="flex items-center gap-1">
                <Link to={`/admin/materias-primas/${material.id}`} aria-label={`Ver ${material.name}`} className={iconLink}>
                  <Eye size={18} />
                </Link>
                <Link to={`/admin/materias-primas/${material.id}/editar`} aria-label={`Editar ${material.name}`} className={iconLink}>
                  <Pencil size={18} />
                </Link>
                <Link to={`/admin/materias-primas/entrada?insumo=${material.id}`} aria-label={`Nova entrada de ${material.name}`} className={iconLink}>
                  <PackagePlus size={18} />
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
