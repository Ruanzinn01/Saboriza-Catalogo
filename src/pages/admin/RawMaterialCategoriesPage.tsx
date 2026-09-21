import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { categoryKey, normalizeCategoryName } from "@/lib/raw-material-categories";
import { useRawMaterialCategoriesStore, type RawMaterialCategory } from "@/store/raw-material-categories-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";

export function RawMaterialCategoriesPage() {
  const navigate = useNavigate();
  const items = useRawMaterialCategoriesStore((state) => state.items);
  const status = useRawMaterialCategoriesStore((state) => state.status);
  const fetchCategories = useRawMaterialCategoriesStore((state) => state.fetchCategories);
  const createCategory = useRawMaterialCategoriesStore((state) => state.createCategory);
  const renameCategory = useRawMaterialCategoriesStore((state) => state.renameCategory);
  const deleteCategory = useRawMaterialCategoriesStore((state) => state.deleteCategory);
  const materials = useRawMaterialsStore((state) => state.materials);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [toDelete, setToDelete] = useState<RawMaterialCategory | null>(null);

  useEffect(() => {
    void fetchCategories();
    void fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countByKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const material of materials) {
      const key = categoryKey(material.category);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [materials]);

  const linkedCount = (name: string) => countByKey.get(categoryKey(name)) ?? 0;

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!normalizeCategoryName(newName) || adding) return;
    setAdding(true);
    const created = await createCategory(newName);
    setAdding(false);
    if (created) setNewName("");
  }

  function startEdit(category: RawMaterialCategory) {
    setEditingId(category.id);
    setEditDraft(category.name);
  }

  async function saveEdit() {
    if (!editingId || savingEdit) return;
    setSavingEdit(true);
    const ok = await renameCategory(editingId, editDraft);
    setSavingEdit(false);
    if (ok) setEditingId(null);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const result = await deleteCategory(toDelete.id);
    if (result !== "error") setToDelete(null);
  }

  const toDeleteCount = toDelete ? linkedCount(toDelete.name) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/materias-primas" className="mb-2 flex w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
          <ArrowLeft size={16} /> Voltar para Matérias-primas
        </Link>
        <h1 className="text-2xl font-extrabold text-forest-950 sm:text-3xl">Categorias de Matérias-primas</h1>
        <p className="mt-1 text-sm text-ink-muted">Organize os insumos por categoria. Ao renomear, todos os insumos vinculados são atualizados.</p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
        <Input
          label="Nova categoria"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ex: Embalagens"
          maxLength={60}
          className="min-w-[200px] flex-1"
        />
        <Button type="submit" disabled={adding || !normalizeCategoryName(newName)}>
          <Plus size={18} /> {adding ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>

      {status === "loading" && items.length === 0 ? (
        <AdminState variant="loading" message="Carregando categorias..." />
      ) : status === "error" && items.length === 0 ? (
        <AdminState variant="error" message="Não foi possível carregar as categorias." onRetry={fetchCategories} />
      ) : items.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma categoria cadastrada ainda." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((category) => {
            const count = linkedCount(category.name);
            const editing = editingId === category.id;
            return (
              <li
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest-950/10 bg-white px-4 py-3"
              >
                {editing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveEdit();
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      aria-label={`Novo nome para ${category.name}`}
                      maxLength={60}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-forest-700 bg-white px-4 text-sm text-ink-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={savingEdit || !normalizeCategoryName(editDraft)}
                      aria-label="Salvar novo nome"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-700/10 text-forest-800 hover:bg-forest-700/20 disabled:opacity-40"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar edição"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-ink-900/5"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-ink-900">
                    <span className="truncate">{category.name}</span>
                    <span className="shrink-0 rounded-full bg-forest-950/5 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                      {count} insumo{count === 1 ? "" : "s"}
                    </span>
                  </span>
                )}

                {!editing && (
                  <div className="flex items-center gap-1">
                    {count > 0 && (
                      <Link
                        to={`/admin/materias-primas?categoria=${encodeURIComponent(category.name)}`}
                        className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-forest-800 hover:bg-forest-950/5"
                      >
                        Ver insumos
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      aria-label={`Renomear ${category.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(category)}
                      aria-label={`Excluir ${category.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {toDelete && toDeleteCount > 0 ? (
        <ConfirmDialog
          open
          onClose={() => setToDelete(null)}
          title="Não é possível excluir esta categoria"
          description={
            <>
              Existem <strong className="text-ink-900">{toDeleteCount} insumo{toDeleteCount === 1 ? "" : "s"}</strong> nesta categoria (
              <strong className="text-ink-900">{toDelete.name}</strong>). Mude a categoria desses insumos antes de excluir.
            </>
          }
          cancelLabel="Fechar"
          extraAction={{
            label: "Ver insumos",
            onClick: () => navigate(`/admin/materias-primas?categoria=${encodeURIComponent(toDelete.name)}`),
          }}
        />
      ) : (
        <ConfirmDialog
          open={toDelete !== null}
          onClose={() => setToDelete(null)}
          title="Excluir categoria?"
          description={
            <>
              <strong className="text-ink-900">{toDelete?.name}</strong> será removida. Nenhum insumo usa esta categoria.
            </>
          }
          confirmLabel="Excluir"
          destructive
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
