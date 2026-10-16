import { create } from "zustand";
import { toast } from "sonner";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { callRpc, friendlyRpcError, selectFrom } from "@/lib/supplier-rpc";
import type { SupplierCategory } from "@/types/supplier";

interface CategoryRow {
  id: string;
  name: string;
  active: boolean;
}

interface LinkRow {
  supplier_id: string;
  category_id: string;
}

interface SupplierCategoriesState {
  categories: SupplierCategory[];
  linksBySupplier: Map<string, string[]>;
  status: "idle" | "loading" | "ready" | "error";
  fetchAll: () => Promise<void>;
  createCategory: (name: string) => Promise<SupplierCategory | null>;
  renameCategory: (id: string, name: string) => Promise<boolean>;
  setActive: (id: string, active: boolean) => Promise<boolean>;
  loadDefaults: () => Promise<number | null>;
  saveSupplierCategories: (supplierId: string, add: string[], remove: string[]) => Promise<boolean>;
}

function sortCategories(items: SupplierCategory[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export const useSupplierCategoriesStore = create<SupplierCategoriesState>()((set, get) => ({
  categories: [],
  linksBySupplier: new Map(),
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }
    const [categoriesResult, linksResult] = await Promise.all([
      selectFrom("supplier_categories", "id, name, active").eq("company_id", companyId).order("name", { ascending: true }),
      selectFrom("supplier_category_links", "supplier_id, category_id").eq("company_id", companyId),
    ]);
    if (categoriesResult.error || linksResult.error) {
      toast.error("Não foi possível carregar as categorias de fornecedores");
      set({ status: "error" });
      return;
    }
    const links = new Map<string, string[]>();
    for (const row of (linksResult.data as LinkRow[]) ?? []) {
      links.set(row.supplier_id, [...(links.get(row.supplier_id) ?? []), row.category_id]);
    }
    set({
      categories: sortCategories(((categoriesResult.data as CategoryRow[]) ?? []).map((row) => ({ id: row.id, name: row.name, active: row.active }))),
      linksBySupplier: links,
      status: "ready",
    });
  },

  createCategory: async (name) => {
    const { data, error } = await callRpc<{ id: string; name: string; active: boolean; created: boolean }>("create_supplier_category", { p_name: name });
    if (error || !data) {
      toast.error(friendlyRpcError(error ?? "", "Não foi possível criar a categoria"));
      return null;
    }
    const category: SupplierCategory = { id: data.id, name: data.name, active: data.active };
    if (!data.active) {
      toast.info(`"${data.name}" já existe, mas está inativa. Reative em Configurações para usar.`);
      return null;
    }
    if (!data.created) toast.info(`"${data.name}" já existia e foi selecionada`);
    set((state) => ({
      categories: state.categories.some((item) => item.id === category.id) ? state.categories : sortCategories([...state.categories, category]),
    }));
    return category;
  },

  renameCategory: async (id, name) => {
    const { data, error } = await callRpc<{ id: string; name: string; active: boolean }>("rename_supplier_category", { p_id: id, p_name: name });
    if (error || !data) {
      toast.error(friendlyRpcError(error ?? "", "Não foi possível renomear a categoria"));
      return false;
    }
    set((state) => ({ categories: sortCategories(state.categories.map((item) => (item.id === id ? { ...item, name: data.name } : item))) }));
    return true;
  },

  setActive: async (id, active) => {
    const { error } = await callRpc<null>("set_supplier_category_active", { p_id: id, p_active: active });
    if (error) {
      toast.error(friendlyRpcError(error, "Não foi possível alterar a categoria"));
      return false;
    }
    set((state) => ({ categories: state.categories.map((item) => (item.id === id ? { ...item, active } : item)) }));
    return true;
  },

  loadDefaults: async () => {
    const { data, error } = await callRpc<number>("ensure_default_supplier_categories");
    if (error) {
      toast.error(friendlyRpcError(error, "Não foi possível carregar as categorias iniciais"));
      return null;
    }
    await get().fetchAll();
    return data ?? 0;
  },

  saveSupplierCategories: async (supplierId, add, remove) => {
    if (add.length === 0 && remove.length === 0) return true;
    const { error } = await callRpc<null>("set_supplier_categories", { p_supplier_id: supplierId, p_add: add, p_remove: remove });
    if (error) {
      toast.error(friendlyRpcError(error, "O fornecedor foi salvo, mas não foi possível gravar as categorias"));
      return false;
    }
    set((state) => {
      const links = new Map(state.linksBySupplier);
      const current = (links.get(supplierId) ?? []).filter((id) => !remove.includes(id));
      links.set(supplierId, [...current, ...add.filter((id) => !current.includes(id))]);
      return { linksBySupplier: links };
    });
    return true;
  },
}));
