import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { categoryFromRow, categoryToRow } from "@/lib/mappers/category-mapper";
import { productFromRow, productToRow } from "@/lib/mappers/product-mapper";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

function sortByName(products: Product[]) {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

interface CatalogState {
  products: Product[];
  categories: Category[];
  status: "idle" | "loading" | "ready" | "error";
  fetchCatalog: () => Promise<void>;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  products: [],
  categories: [],
  status: "idle",

  fetchCatalog: async () => {
    set({ status: "loading" });
    const [{ data: categoryRows, error: categoryError }, { data: productRows, error: productError }] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("products").select("*"),
    ]);

    if (categoryError || productError) {
      toast.error("Não foi possível carregar o catálogo");
      set({ status: "error" });
      return;
    }

    set({
      categories: (categoryRows ?? []).map(categoryFromRow),
      products: sortByName((productRows ?? []).map(productFromRow)),
      status: "ready",
    });
  },

  addProduct: (product) => {
    set((state) => ({ products: sortByName([...state.products, product]) }));
    supabase
      .from("products")
      .insert(productToRow(product))
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível salvar o produto");
          set((state) => ({ products: state.products.filter((item) => item.id !== product.id) }));
        } else {
          toast.success("Produto salvo com sucesso");
        }
      });
  },

  updateProduct: (id, patch) => {
    const previous = get().products;
    set((state) => ({
      products: sortByName(state.products.map((product) => (product.id === id ? { ...product, ...patch } : product))),
    }));
    const updated = get().products.find((product) => product.id === id);
    if (!updated) return;
    supabase
      .from("products")
      .update(productToRow(updated))
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível atualizar o produto");
          set({ products: previous });
        } else if (Object.keys(patch).length === 1 && "active" in patch) {
          toast.success(updated.active ? "Produto ativado" : "Produto desativado");
        } else {
          toast.success("Produto atualizado");
        }
      });
  },

  removeProduct: (id) => {
    const previous = get().products;
    set((state) => ({ products: state.products.filter((product) => product.id !== id) }));
    supabase
      .from("products")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível excluir o produto");
          set({ products: previous });
        } else {
          toast.success("Produto removido");
        }
      });
  },

  addCategory: (category) => {
    set((state) => ({ categories: [...state.categories, category] }));
    supabase
      .from("categories")
      .insert(categoryToRow(category))
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível salvar a categoria");
          set((state) => ({ categories: state.categories.filter((item) => item.id !== category.id) }));
        } else {
          toast.success("Categoria salva com sucesso");
        }
      });
  },

  updateCategory: (id, patch) => {
    const previous = get().categories;
    set((state) => ({
      categories: state.categories.map((category) => (category.id === id ? { ...category, ...patch } : category)),
    }));
    const updated = get().categories.find((category) => category.id === id);
    if (!updated) return;
    supabase
      .from("categories")
      .update(categoryToRow(updated))
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível atualizar a categoria");
          set({ categories: previous });
        }
      });
  },

  removeCategory: (id) => {
    const previous = get().categories;
    set((state) => ({ categories: state.categories.filter((category) => category.id !== id) }));
    supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível excluir a categoria");
          set({ categories: previous });
        } else {
          toast.success("Categoria removida");
        }
      });
  },

  reorderCategories: (orderedIds) => {
    const previous = get().categories;
    const reordered = orderedIds
      .map((id, index) => {
        const category = previous.find((item) => item.id === id);
        return category ? { ...category, order: index } : null;
      })
      .filter((category): category is Category => category !== null);

    set({ categories: reordered });

    Promise.all(
      reordered.map((category) => supabase.from("categories").update({ sort_order: category.order }).eq("id", category.id))
    ).then((results) => {
      if (results.some((result) => result.error)) {
        toast.error("Não foi possível salvar a nova ordem");
        set({ categories: previous });
      }
    });
  },
}));
