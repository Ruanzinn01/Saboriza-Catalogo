import { useEffect, useMemo, useRef, useState } from "react";
import { Package, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AdminState } from "@/components/admin/AdminState";
import { Pagination } from "@/components/admin/Pagination";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { paginate } from "@/lib/pagination";
import { filterMaterials, materialCategories, sortMaterials, type MaterialSort, type MaterialSortKey } from "@/lib/raw-material-entry";
import type { RawMaterial } from "@/types/raw-material";

interface RawMaterialPickerProps {
  materials: RawMaterial[];
  onAdd: (materials: RawMaterial[]) => void;
}

export function RawMaterialPicker({ materials, onAdd }: RawMaterialPickerProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<MaterialSort>({ key: "code", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => materialCategories(materials), [materials]);
  const rows = useMemo(
    () => sortMaterials(filterMaterials(materials, search, category), sort),
    [materials, search, category, sort]
  );
  const pageData = paginate(rows, page, pageSize);

  const pageIds = pageData.items.map((material) => material.id);
  const checkedOnPage = pageIds.filter((id) => checked.has(id)).length;
  const allChecked = pageIds.length > 0 && checkedOnPage === pageIds.length;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = checkedOnPage > 0 && !allChecked;
  }, [checkedOnPage, allChecked]);

  function toggleSort(key: MaterialSortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function toggleAllOnPage() {
    setChecked((current) => {
      const next = new Set(current);
      if (allChecked) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addChecked() {
    onAdd(materials.filter((material) => checked.has(material.id)));
    setChecked(new Set());
  }

  return (
    <section aria-labelledby="selecionar-insumos" className="flex flex-col rounded-3xl border border-forest-950/10 bg-white">
      <div className="flex flex-col gap-3 p-5 pb-3">
        <h2 id="selecionar-insumos" className="text-xl font-extrabold text-forest-950">
          Selecionar Insumos
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="picker-busca" className="sr-only">
              Buscar insumo por nome, código ou categoria
            </label>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              id="picker-busca"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar insumo por nome, código ou categoria..."
              className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </div>
          <label className="sr-only" htmlFor="picker-categoria">
            Categoria
          </label>
          <select
            id="picker-categoria"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          >
            <option value="">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {checked.size > 0 && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-forest-700/10 px-3 py-2">
            <span className="text-sm font-semibold text-forest-900">
              {checked.size} insumo{checked.size > 1 ? "s" : ""} selecionado{checked.size > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
                Limpar seleção
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={addChecked}>
                <Plus size={14} /> Adicionar selecionados
              </Button>
            </div>
          </div>
        )}
      </div>

      {materials.length === 0 ? (
        <div className="p-5 pt-0">
          <AdminState variant="empty" message="Nenhum insumo cadastrado ainda." />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-5 pt-0">
          <AdminState variant="empty" message="Nenhum insumo encontrado para esse filtro." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-50">
              <tr>
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAllOnPage}
                    aria-label="Selecionar todos os insumos da página"
                    className="h-4 w-4 accent-forest-700"
                  />
                </th>
                <th scope="col" className="hidden px-3 py-3 text-xs font-bold uppercase tracking-wide text-ink-700 sm:table-cell">
                  Imagem
                </th>
                <SortableHeader label="Código" active={sort.key === "code"} dir={sort.dir} onSort={() => toggleSort("code")} className="hidden md:table-cell" />
                <SortableHeader label="Nome do insumo" active={sort.key === "name"} dir={sort.dir} onSort={() => toggleSort("name")} />
                <SortableHeader label="Categoria" active={sort.key === "category"} dir={sort.dir} onSort={() => toggleSort("category")} className="hidden md:table-cell" />
                <th scope="col" className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-ink-700">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {pageData.items.map((material) => (
                <tr key={material.id} className="border-t border-forest-950/5 hover:bg-forest-950/[0.02]">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={checked.has(material.id)}
                      onChange={() => toggleOne(material.id)}
                      aria-label={`Selecionar ${material.name}`}
                      className="h-4 w-4 accent-forest-700"
                    />
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    {material.imageUrl ? (
                      <img src={material.imageUrl} alt="" loading="lazy" className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-950/5 text-forest-950/30">
                        <Package size={20} />
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-ink-700/70 md:table-cell">{material.code}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-ink-900">{material.name}</p>
                    <p className="text-xs text-ink-muted">
                      {material.purchaseUnitLabel || material.controlUnit}
                      <span className="md:hidden"> · {material.code}</span>
                    </p>
                  </td>
                  <td className="hidden px-3 py-2.5 text-ink-700/80 md:table-cell">{material.category || "-----"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onAdd([material])}
                      aria-label={`Adicionar ${material.name}`}
                      className="h-10 border-forest-600 px-4 text-forest-700 hover:bg-forest-600/5"
                    >
                      <Plus size={14} /> Adicionar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <Pagination
          page={pageData.page}
          totalPages={pageData.totalPages}
          pageSize={pageSize}
          total={rows.length}
          itemLabel="insumos"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </section>
  );
}
