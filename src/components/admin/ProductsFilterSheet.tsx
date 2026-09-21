import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { ProductFilters } from "@/lib/product-list";
import type { Supplier } from "@/types/supplier";

interface ProductsFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: ProductFilters;
  suppliers: Supplier[];
  onChange: (patch: Partial<ProductFilters>) => void;
  onClear: () => void;
}

const selectClasses =
  "h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700";

export function ProductsFilterSheet({ open, onClose, filters, suppliers, onChange, onClear }: ProductsFilterSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtros"
      footer={
        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" onClick={onClose}>
            Ver resultados
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={onClear}>
            Limpar todos os filtros
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Margem de lucro</span>
          <select
            value={filters.margin}
            onChange={(e) => onChange({ margin: e.target.value as ProductFilters["margin"] })}
            className={selectClasses}
          >
            <option value="all">Todas</option>
            <option value="on-target">Dentro da meta</option>
            <option value="below-target">Abaixo da meta</option>
            <option value="none">Margem indisponível</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Cadastro do produto</span>
          <select
            value={filters.setup}
            onChange={(e) => onChange({ setup: e.target.value as ProductFilters["setup"] })}
            className={selectClasses}
          >
            <option value="all">Todos</option>
            <option value="incomplete">Sem ficha técnica (falta preço, ficha, imposto ou matéria-prima)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Fornecedor</span>
          <select value={filters.supplierId} onChange={(e) => onChange({ supplierId: e.target.value })} className={selectClasses}>
            <option value="">Todos</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.tradeName || supplier.companyName}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-ink-muted">A margem usa o custo da ficha técnica e a meta definida em cada produto.</p>
      </div>
    </Sheet>
  );
}
