import { Link } from "react-router-dom";
import { Eye, Package, PackagePlus, Pencil } from "lucide-react";
import { StockMeter, StockStatusPill } from "@/components/admin/ProductListParts";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { formatCurrency } from "@/lib/currency";
import { replenishmentSummary, type MaterialListSortKey, type MaterialListSort, type RawMaterialRow } from "@/lib/raw-material-list";

interface RawMaterialsTableProps {
  rows: RawMaterialRow[];
  sort: MaterialListSort;
  onSort: (key: MaterialListSortKey) => void;
}

const plainTh = "px-3 py-3 text-xs font-bold uppercase tracking-wide text-ink-700";
const iconLink = "flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5";

export function MaterialThumb({ imageUrl, className = "h-12 w-12" }: { imageUrl: string; className?: string }) {
  return imageUrl ? (
    <img src={imageUrl} alt="" loading="lazy" className={`${className} shrink-0 rounded-xl border border-forest-950/10 object-cover`} />
  ) : (
    <span aria-hidden className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-forest-950/5 text-forest-950/30`}>
      <Package size={20} />
    </span>
  );
}

export function RawMaterialsTable({ rows, sort, onSort }: RawMaterialsTableProps) {
  const sortable = (key: MaterialListSortKey, label: string) => (
    <SortableHeader label={label} active={sort.key === key} dir={sort.dir} onSort={() => onSort(key)} />
  );

  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Lista de matérias-primas</caption>
        <thead className="bg-cream-50">
          <tr>
            <th scope="col" className={plainTh}>
              Imagem
            </th>
            {sortable("code", "Código")}
            {sortable("name", "Nome do insumo")}
            {sortable("category", "Categoria")}
            {sortable("stock", "Estoque")}
            {sortable("cost", "Custo médio")}
            <th scope="col" className={plainTh}>
              Fornecedor
            </th>
            <th scope="col" className={plainTh}>
              Reposição
            </th>
            {sortable("status", "Situação")}
            <th scope="col" className={plainTh}>
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { material } = row;
            const replenishment = replenishmentSummary(material);
            return (
              <tr key={material.id} className="border-t border-forest-950/5 align-middle hover:bg-forest-950/[0.02]">
                <td className="px-3 py-3">
                  <MaterialThumb imageUrl={material.imageUrl} className="h-14 w-14" />
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-ink-700/70">{material.code}</td>
                <td className="px-3 py-3">
                  <Link to={`/admin/materias-primas/${material.id}`} className="font-semibold text-ink-900 hover:underline">
                    {material.name}
                  </Link>
                  <p className="text-xs text-ink-muted">{material.purchaseUnitLabel || material.controlUnit}</p>
                  {!material.isActive && (
                    <span className="mt-1 inline-block rounded-full bg-ink-900/10 px-2 py-0.5 text-[11px] font-bold text-ink-700">Inativo</span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-700/80">{material.category || "-----"}</td>
                <td className="px-3 py-3">
                  <StockMeter name={material.name} currentStock={material.currentStock} minStock={material.minStock} maxStock={material.maxStock} unit={material.controlUnit} bucket={row.bucket} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-bold text-ink-900">{formatCurrency(material.avgCost)}</td>
                <td className="px-3 py-3 text-ink-700/80">{row.supplierName ?? "-----"}</td>
                <td className="px-3 py-3 text-xs text-ink-700/80">{replenishment || "—"}</td>
                <td className="px-3 py-3">
                  <StockStatusPill bucket={row.bucket} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Link to={`/admin/materias-primas/${material.id}`} aria-label={`Ver ${material.name}`} title="Ver detalhes" className={iconLink}>
                      <Eye size={16} />
                    </Link>
                    <Link to={`/admin/materias-primas/${material.id}/editar`} aria-label={`Editar ${material.name}`} title="Editar" className={iconLink}>
                      <Pencil size={16} />
                    </Link>
                    <Link
                      to={`/admin/materias-primas/entrada?insumo=${material.id}`}
                      aria-label={`Nova entrada de ${material.name}`}
                      title="Nova entrada"
                      className={iconLink}
                    >
                      <PackagePlus size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
