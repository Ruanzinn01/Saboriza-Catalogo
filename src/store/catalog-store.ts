import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";
import { mockProducts } from "@/data/mock-products";
import { mockCategories } from "@/data/mock-categories";

interface CatalogState {
  products: Product[];
  categories: Category[];
  addProduct: (product: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      products: mockProducts,
      categories: mockCategories,
      addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
      updateProduct: (id, patch) =>
        set((state) => ({
          products: state.products.map((product) => (product.id === id ? { ...product, ...patch } : product)),
        })),
      removeProduct: (id) => set((state) => ({ products: state.products.filter((product) => product.id !== id) })),
      addCategory: (category) => set((state) => ({ categories: [...state.categories, category] })),
      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((category) => (category.id === id ? { ...category, ...patch } : category)),
        })),
      removeCategory: (id) =>
        set((state) => ({ categories: state.categories.filter((category) => category.id !== id) })),
      reorderCategories: (orderedIds) =>
        set((state) => ({
          categories: orderedIds
            .map((id, index) => {
              const category = state.categories.find((item) => item.id === id);
              return category ? { ...category, order: index } : null;
            })
            .filter((category): category is Category => category !== null),
        })),
    }),
    { name: "saboriza-catalog" }
  )
);
