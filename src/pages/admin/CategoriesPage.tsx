import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AdminState } from "@/components/admin/AdminState";
import { useCatalogStore } from "@/store/catalog-store";
import { slugify } from "@/lib/slugify";
import type { Category } from "@/types/category";

export function CategoriesPage() {
  const navigate = useNavigate();
  const categories = useCatalogStore((state) => [...state.categories].sort((a, b) => a.order - b.order));
  const products = useCatalogStore((state) => state.products);
  const status = useCatalogStore((state) => state.status);
  const addCategory = useCatalogStore((state) => state.addCategory);
  const updateCategory = useCatalogStore((state) => state.updateCategory);
  const removeCategory = useCatalogStore((state) => state.removeCategory);
  const reorderCategories = useCatalogStore((state) => state.reorderCategories);
  const [newName, setNewName] = useState("");
  const [newTagline, setNewTagline] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  function linkedProductsCount(categoryId: string) {
    return products.filter((product) => product.categoryId === categoryId).length;
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    addCategory({
      id: crypto.randomUUID(),
      name: newName.trim(),
      slug: slugify(newName),
      tagline: newTagline.trim(),
      order: categories.length,
      active: true,
    });
    setNewName("");
    setNewTagline("");
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const ids = categories.map((category) => category.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderCategories(ids);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">Categorias</h1>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
        <Input
          label="Nova categoria"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ex: Kits Promocionais"
          className="min-w-[200px] flex-1"
        />
        <Input
          label="Frase de apoio (opcional)"
          value={newTagline}
          onChange={(e) => setNewTagline(e.target.value)}
          placeholder="Ex: Sabor que vende sozinho."
          className="min-w-[240px] flex-1"
        />
        <Button type="submit">
          <Plus size={18} /> Adicionar
        </Button>
      </form>

      {status === "loading" && categories.length === 0 ? (
        <AdminState variant="loading" message="Carregando categorias..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar as categorias. Tente recarregar a página." />
      ) : categories.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma categoria cadastrada ainda." />
      ) : (
      <div className="flex flex-col gap-2">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest-950/10 bg-white px-4 py-3"
          >
            <div className="flex flex-1 items-center gap-3">
              <div className="flex flex-col">
                <button onClick={() => move(index, -1)} disabled={index === 0} className="text-ink-700/50 disabled:opacity-20">
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === categories.length - 1}
                  className="text-ink-700/50 disabled:opacity-20"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 font-semibold text-ink-900">
                  {category.name}
                  <span className="rounded-full bg-forest-950/5 px-2 py-0.5 text-[11px] font-semibold text-ink-700/60">
                    {linkedProductsCount(category.id)} produto{linkedProductsCount(category.id) === 1 ? "" : "s"}
                  </span>
                </span>
                <input
                  defaultValue={category.tagline}
                  onBlur={(e) => updateCategory(category.id, { tagline: e.target.value })}
                  placeholder="Frase de apoio..."
                  className="w-full max-w-sm rounded-lg border border-transparent bg-transparent text-xs text-ink-700/60 outline-none focus:border-forest-700/30 focus:bg-cream-50 focus:px-2 focus:py-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateCategory(category.id, { active: !category.active })}
                className={
                  category.active
                    ? "rounded-full bg-forest-700/10 px-3 py-1 text-xs font-bold text-forest-800"
                    : "rounded-full bg-ink-900/10 px-3 py-1 text-xs font-bold text-ink-700/60"
                }
              >
                {category.active ? "Ativa" : "Inativa"}
              </button>
              <button
                onClick={() => setCategoryToDelete(category)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
      {categoryToDelete && linkedProductsCount(categoryToDelete.id) > 0 ? (
        <ConfirmDialog
          open
          onClose={() => setCategoryToDelete(null)}
          title="Não é possível excluir esta categoria"
          description={
            <>
              Existem <strong className="text-ink-900">{linkedProductsCount(categoryToDelete.id)} produtos</strong> vinculados a{" "}
              <strong className="text-ink-900">{categoryToDelete.name}</strong>. Mova ou exclua esses produtos antes de excluir a
              categoria.
            </>
          }
          cancelLabel="Fechar"
          extraAction={{
            label: "Ver produtos",
            onClick: () => navigate(`/admin/produtos?categoria=${categoryToDelete.id}`),
          }}
        />
      ) : (
        <ConfirmDialog
          open={categoryToDelete !== null}
          onClose={() => setCategoryToDelete(null)}
          title="Excluir categoria?"
          description={
            <>
              <strong className="text-ink-900">{categoryToDelete?.name}</strong> será removida. Essa ação não pode ser desfeita.
            </>
          }
          confirmLabel="Excluir"
          destructive
          onConfirm={() => {
            if (!categoryToDelete) return;
            removeCategory(categoryToDelete.id);
            setCategoryToDelete(null);
          }}
        />
      )}
    </div>
  );
}
