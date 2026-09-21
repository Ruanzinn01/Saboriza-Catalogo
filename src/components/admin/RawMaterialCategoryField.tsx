import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { findCategoryName, mergeCategoryNames, normalizeCategoryName } from "@/lib/raw-material-categories";
import { useRawMaterialCategoriesStore } from "@/store/raw-material-categories-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";

interface RawMaterialCategoryFieldProps {
  value: string;
  onChange: (name: string) => void;
}

export function RawMaterialCategoryField({ value, onChange }: RawMaterialCategoryFieldProps) {
  const selectId = useId();
  const inputId = useId();
  const registered = useRawMaterialCategoriesStore((state) => state.names);
  const categoriesStatus = useRawMaterialCategoriesStore((state) => state.status);
  const fetchCategories = useRawMaterialCategoriesStore((state) => state.fetchCategories);
  const createCategory = useRawMaterialCategoriesStore((state) => state.createCategory);
  const materials = useRawMaterialsStore((state) => state.materials);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (categoriesStatus === "idle") void fetchCategories();
  }, [categoriesStatus, fetchCategories]);

  const options = useMemo(
    () => mergeCategoryNames([...registered, value], materials.map((material) => material.category)),
    [registered, value, materials]
  );

  async function handleCreate() {
    const name = normalizeCategoryName(draft);
    if (!name || saving) return;

    const alreadyThere = findCategoryName(options, name);
    if (alreadyThere) {
      onChange(alreadyThere);
      toast.info(`"${alreadyThere}" já existia e foi selecionada`);
    } else {
      setSaving(true);
      const created = await createCategory(name);
      setSaving(false);
      if (!created) return;
      onChange(created);
    }
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-semibold text-ink-900">
        Categoria
      </label>
      <div className="flex gap-2">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        >
          <option value="">Sem categoria</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {!creating && (
          <Button type="button" variant="outline" onClick={() => setCreating(true)} className="shrink-0">
            <Plus size={16} /> Nova
          </Button>
        )}
      </div>

      {creating && (
        <div className="mt-1 flex flex-col gap-2 rounded-2xl bg-forest-950/5 p-3">
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
              placeholder="Ex.: Embalagens"
              maxLength={60}
              className="h-11 min-w-0 flex-1 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
            <Button type="button" variant="secondary" disabled={saving || !normalizeCategoryName(draft)} onClick={() => void handleCreate()}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setDraft("");
              }}
              aria-label="Cancelar nova categoria"
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
