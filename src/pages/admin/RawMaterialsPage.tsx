import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PackagePlus, Plus, Search } from "lucide-react";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useSuppliersStore } from "@/store/suppliers-store";
import { AdminState } from "@/components/admin/AdminState";
import { Pagination } from "@/components/admin/Pagination";
import { ProductsKpiCards } from "@/components/admin/ProductsKpiCards";
import { RawMaterialsMobileList } from "@/components/admin/RawMaterialsMobileList";
import { RawMaterialsTable } from "@/components/admin/RawMaterialsTable";
import { Button } from "@/components/ui/Button";
import { paginate } from "@/lib/pagination";
import { buildKpis } from "@/lib/product-list";
import { materialCategories } from "@/lib/raw-material-entry";
import {
  EMPTY_MATERIAL_FILTERS,
  buildMaterialRows,
  countMaterialFilters,
  filterMaterialRows,
  sortMaterialRows,
  type MaterialListSort,
  type MaterialListSortKey,
  type RawMaterialFilters,
} from "@/lib/raw-material-list";

const selectClasses =
  "h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700 xl:h-12";

export function RawMaterialsPage() {
  const materials = useRawMaterialsStore((state) => state.materials);
  const status = useRawMaterialsStore((state) => state.status);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);

  const [filters, setFilters] = useState<RawMaterialFilters>(EMPTY_MATERIAL_FILTERS);
  const [sort, setSort] = useState<MaterialListSort>({ key: "code", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchMaterials();
    if (suppliers.length === 0) fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMaterials]);

  const categories = useMemo(() => materialCategories(materials), [materials]);
  const rows = useMemo(() => buildMaterialRows(materials, suppliers), [materials, suppliers]);
  const kpis = useMemo(() => buildKpis(materials), [materials]);
  const visibleRows = useMemo(() => sortMaterialRows(filterMaterialRows(rows, filters), sort), [rows, filters, sort]);
  const pageData = paginate(visibleRows, page, pageSize);
  const activeFilterCount = countMaterialFilters(filters);

  function patchFilters(patch: Partial<RawMaterialFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function handleSort(key: MaterialListSortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center">
        <div className="2xl:w-72 2xl:shrink-0">
          <h1 className="text-2xl font-extrabold text-forest-950 sm:text-3xl">Matérias-primas</h1>
          <p className="text-sm text-ink-muted">Cadastro de insumos com saldo e custo médio calculados pelo sistema.</p>
        </div>
        <div className="2xl:flex-1">
          <ProductsKpiCards
            kpis={kpis}
            totalLabel="Total de Insumos"
            selected={filters.stock === "all" ? null : filters.stock}
            onSelect={(bucket) => patchFilters({ stock: filters.stock === bucket ? "all" : bucket })}
          />
        </div>
        <div className="flex flex-wrap gap-2 2xl:shrink-0">
          <Link to="/admin/materias-primas/entrada" className="flex-1 2xl:flex-none">
            <Button size="lg" variant="secondary" className="w-full">
              <PackagePlus size={18} /> Nova entrada
            </Button>
          </Link>
          <Link to="/admin/materias-primas/novo" className="flex-1 2xl:flex-none">
            <Button size="lg" className="w-full">
              <Plus size={18} /> Novo insumo
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <label htmlFor="insumos-busca" className="sr-only">
            Buscar por nome, código ou fornecedor
          </label>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            id="insumos-busca"
            value={filters.search}
            onChange={(e) => patchFilters({ search: e.target.value })}
            placeholder="Buscar por nome, código ou fornecedor..."
            className="h-12 w-full rounded-xl border border-ink-900/15 bg-white pl-12 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:flex">
          <select aria-label="Categoria" value={filters.category} onChange={(e) => patchFilters({ category: e.target.value })} className={selectClasses}>
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            aria-label="Status do insumo"
            value={filters.active}
            onChange={(e) => patchFilters({ active: e.target.value as RawMaterialFilters["active"] })}
            className={selectClasses}
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <select
            aria-label="Situação do estoque"
            value={filters.stock}
            onChange={(e) => patchFilters({ stock: e.target.value as RawMaterialFilters["stock"] })}
            className={selectClasses}
          >
            <option value="all">Todos os estoques</option>
            <option value="ok">Em estoque</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Sem estoque</option>
          </select>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="-mt-3 flex items-center gap-3 text-sm text-ink-700">
          <span>
            {visibleRows.length} de {materials.length} insumos
          </span>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_MATERIAL_FILTERS);
              setPage(1);
            }}
            className="min-h-9 font-semibold text-forest-800 hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {status === "loading" && materials.length === 0 ? (
        <AdminState variant="loading" message="Carregando insumos..." />
      ) : status === "error" && materials.length === 0 ? (
        <AdminState variant="error" message="Não foi possível carregar os insumos." onRetry={fetchMaterials} />
      ) : visibleRows.length === 0 ? (
        <AdminState
          variant="empty"
          message={materials.length === 0 ? "Nenhum insumo cadastrado ainda." : "Nenhum insumo encontrado com esse filtro."}
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
          <RawMaterialsTable rows={pageData.items} sort={sort} onSort={handleSort} />
          <RawMaterialsMobileList rows={pageData.items} />
          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            pageSize={pageSize}
            total={visibleRows.length}
            itemLabel="insumos"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
