import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { categoryKey, findCategoryName, normalizeCategoryName } from "@/lib/raw-material-categories";
import { useRawMaterialsStore } from "@/store/raw-materials-store";

export interface RawMaterialCategory {
  id: string;
  name: string;
}

interface RawMaterialCategoriesState {
  items: RawMaterialCategory[];
  names: string[];
  status: "idle" | "loading" | "ready" | "error";
  fetchCategories: () => Promise<void>;
  createCategory: (name: string) => Promise<string | null>;
  renameCategory: (id: string, name: string) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<"deleted" | "in-use" | "error">;
}

function withItems(items: RawMaterialCategory[]) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { items: sorted, names: sorted.map((item) => item.name) };
}

export function countMaterialsInCategory(name: string): number {
  const key = categoryKey(name);
  return useRawMaterialsStore.getState().materials.filter((material) => categoryKey(material.category) === key).length;
}

export const useRawMaterialCategoriesStore = create<RawMaterialCategoriesState>()((set, get) => ({
  items: [],
  names: [],
  status: "idle",

  fetchCategories: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("raw_material_categories").select("id, name").order("name", { ascending: true });

    if (error) {
      toast.error("Não foi possível carregar as categorias de insumo");
      set({ status: "error" });
      return;
    }

    set({ ...withItems(data.map((row) => ({ id: row.id, name: row.name }))), status: "ready" });
  },

  createCategory: async (input) => {
    const name = normalizeCategoryName(input);
    if (!name) return null;

    const existing = findCategoryName(get().names, name);
    if (existing) return existing;

    const { data, error } = await supabase.from("raw_material_categories").insert({ name }).select("id, name").single();

    if (error?.code === "23505") {
      await get().fetchCategories();
      return findCategoryName(get().names, name) ?? name;
    }

    if (error || !data) {
      toast.error("Não foi possível cadastrar a categoria");
      return null;
    }

    set((state) => withItems([...state.items, { id: data.id, name: data.name }]));
    toast.success(`Categoria "${data.name}" cadastrada`);
    return data.name;
  },

  renameCategory: async (id, input) => {
    const name = normalizeCategoryName(input);
    if (!name) return false;

    const current = get().items.find((item) => item.id === id);
    if (!current || current.name === name) return true;

    const clash = get().items.find((item) => item.id !== id && categoryKey(item.name) === categoryKey(name));
    if (clash) {
      toast.error(`Já existe a categoria "${clash.name}"`);
      return false;
    }

    const { error } = await supabase.rpc("rename_raw_material_category", { p_id: id, p_name: name });
    if (error) {
      toast.error(error.code === "23505" ? `Já existe a categoria "${name}"` : "Não foi possível renomear a categoria");
      return false;
    }

    set((state) => withItems(state.items.map((item) => (item.id === id ? { ...item, name } : item))));
    await useRawMaterialsStore.getState().fetchMaterials();
    toast.success("Categoria renomeada nos insumos vinculados");
    return true;
  },

  deleteCategory: async (id) => {
    const target = get().items.find((item) => item.id === id);
    if (!target) return "error";
    if (countMaterialsInCategory(target.name) > 0) return "in-use";

    const { error } = await supabase.from("raw_material_categories").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir a categoria");
      return "error";
    }

    set((state) => withItems(state.items.filter((item) => item.id !== id)));
    toast.success("Categoria excluída");
    return "deleted";
  },
}));
