import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";

interface SupplierCategoryPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

// Categoria é opcional e múltipla. Criar categoria aqui não navega nem limpa o rascunho do formulário;
// a categoria criada é persistida na hora (ação própria) e passa a fazer parte da seleção.
export function SupplierCategoryPicker({ value, onChange }: SupplierCategoryPickerProps) {
  const inputId = useId();
  const categories = useSupplierCategoriesStore((state) => state.categories);
  const status = useSupplierCategoriesStore((state) => state.status);
  const fetchAll = useSupplierCategoriesStore((state) => state.fetchAll);
  const createCategory = useSupplierCategoriesStore((state) => state.createCategory);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "idle") void fetchAll();
  }, [status, fetchAll]);

  const visible = categories.filter((category) => category.active || value.includes(category.id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  async function handleCreate() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    const created = await createCategory(draft);
    setSaving(false);
    if (!created) return;
    if (!value.includes(created.id)) onChange([...value, created.id]);
    setDraft("");
    setCreating(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleCreate();
    }
    if (event.key === "Escape") {
      setCreating(false);
      setDraft("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink-900">Categorias (opcional)</span>
      <div className="flex flex-wrap gap-2">
        {visible.length === 0 && status === "ready" && <p className="text-sm text-ink-muted">Nenhuma categoria cadastrada. Salvar sem categoria é permitido.</p>}
        {visible.map((category) => {
          const selected = value.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(category.id)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                selected ? "border-forest-900 bg-forest-900 text-cream-50" : "border-ink-900/15 bg-white text-ink-700 hover:bg-ink-900/5"
              )}
            >
              {category.name}
              {!category.active && " (inativa)"}
            </button>
          );
        })}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-forest-900/30 px-4 text-sm font-semibold text-forest-900 hover:bg-forest-900/5"
          >
            <Plus size={14} /> Criar categoria
          </button>
        )}
      </div>

      {creating && (
        <div className="flex flex-col gap-2 rounded-2xl bg-forest-950/5 p-3">
          <label htmlFor={inputId} className="text-xs font-semibold text-ink-700">
            Nome da nova categoria
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={60}
              placeholder="Ex.: Serviços gráficos"
              className="h-11 min-w-0 flex-1 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
            <Button type="button" variant="secondary" disabled={saving || !draft.trim()} onClick={() => void handleCreate()}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
            <button
              type="button"
              aria-label="Cancelar nova categoria"
              onClick={() => {
                setCreating(false);
                setDraft("");
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-ink-900/5"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
