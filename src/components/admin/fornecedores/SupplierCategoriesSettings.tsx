import { useEffect, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";

export function SupplierCategoriesSettings() {
  const categories = useSupplierCategoriesStore((state) => state.categories);
  const linksBySupplier = useSupplierCategoriesStore((state) => state.linksBySupplier);
  const status = useSupplierCategoriesStore((state) => state.status);
  const fetchAll = useSupplierCategoriesStore((state) => state.fetchAll);
  const createCategory = useSupplierCategoriesStore((state) => state.createCategory);
  const renameCategory = useSupplierCategoriesStore((state) => state.renameCategory);
  const setActive = useSupplierCategoriesStore((state) => state.setActive);
  const loadDefaults = useSupplierCategoriesStore((state) => state.loadDefaults);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "idle") void fetchAll();
  }, [status, fetchAll]);

  function usageCount(categoryId: string) {
    let count = 0;
    linksBySupplier.forEach((ids) => {
      if (ids.includes(categoryId)) count += 1;
    });
    return count;
  }

  async function handleCreate() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    const created = await createCategory(newName);
    setBusy(false);
    if (created) setNewName("");
  }

  async function handleRename(id: string) {
    if (!editName.trim() || busy) return;
    setBusy(true);
    const ok = await renameCategory(id, editName);
    setBusy(false);
    if (ok) setEditingId(null);
  }

  async function handleDefaults() {
    setBusy(true);
    const inserted = await loadDefaults();
    setBusy(false);
    if (inserted === null) return;
    toast.success(inserted > 0 ? `${inserted} categoria(s) inicial(is) adicionada(s)` : "As categorias iniciais já estavam cadastradas");
  }

  if (status === "loading" && categories.length === 0) return <AdminState variant="loading" message="Carregando categorias..." />;
  if (status === "error") return <AdminState variant="error" message="Não foi possível carregar as categorias." onRetry={() => void fetchAll()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-6">
        <p className="text-sm font-extrabold text-forest-950">Categorias de fornecedores</p>
        <p className="mt-1 text-sm text-ink-muted">
          Descrevem o que o fornecedor oferece. Não são a categoria financeira da despesa e nunca reclassificam lançamentos antigos. Inativar não remove vínculos já feitos.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            maxLength={60}
            aria-label="Nome da nova categoria"
            placeholder="Nova categoria"
            className="h-11 min-w-0 flex-1 rounded-xl border border-ink-900/15 bg-white px-4 text-sm outline-none focus:border-forest-700"
          />
          <Button type="button" variant="secondary" disabled={busy || !newName.trim()} onClick={() => void handleCreate()}>
            <Plus size={16} /> Criar categoria
          </Button>
        </div>

        {categories.length === 0 ? (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl bg-forest-950/5 p-4">
            <p className="text-sm text-ink-700">Nenhuma categoria cadastrada. Você pode carregar as oito categorias iniciais confirmadas ou criar as suas.</p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void handleDefaults()}>
              Carregar categorias iniciais
            </Button>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-forest-950/5">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                {editingId === category.id ? (
                  <div className="flex flex-1 gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename(category.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      maxLength={60}
                      aria-label="Novo nome da categoria"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-ink-900/15 bg-white px-4 text-sm outline-none focus:border-forest-700"
                    />
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleRename(category.id)} aria-label="Salvar nome">
                      <Check size={16} />
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingId(null)} aria-label="Cancelar edição">
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className={category.active ? "font-semibold text-ink-900" : "font-semibold text-ink-muted line-through"}>{category.name}</p>
                      <p className="text-xs text-ink-muted">
                        {usageCount(category.id)} fornecedor(es) · {category.active ? "Ativa" : "Inativa"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditName(category.name);
                        }}
                      >
                        <Pencil size={14} /> Renomear
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => void setActive(category.id, !category.active)}>
                        {category.active ? "Inativar" : "Reativar"}
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
