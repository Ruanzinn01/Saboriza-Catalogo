import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { productRecipeLineFromRow } from "@/lib/mappers/production-mapper";
import type { ProductRecipeLine } from "@/types/production";

interface ProductRecipeState {
  linesByProduct: Record<string, ProductRecipeLine[]>;
  status: "idle" | "loading" | "ready" | "error";
  fetchRecipe: (productId: string) => Promise<void>;
  fetchRecipesFor: (productIds: string[]) => Promise<void>;
  addLine: (productId: string, rawMaterialId: string, quantityPerUnit: number) => Promise<boolean>;
  updateLine: (id: string, productId: string, quantityPerUnit: number) => Promise<boolean>;
  removeLine: (id: string, productId: string) => Promise<boolean>;
}

export const useProductRecipeStore = create<ProductRecipeState>()((set) => ({
  linesByProduct: {},
  status: "idle",

  fetchRecipe: async (productId) => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("product_recipe").select("*").eq("product_id", productId);

    if (error) {
      toast.error("Não foi possível carregar a ficha técnica");
      set({ status: "error" });
      return;
    }

    set((state) => ({
      linesByProduct: { ...state.linesByProduct, [productId]: data.map(productRecipeLineFromRow) },
      status: "ready",
    }));
  },

  fetchRecipesFor: async (productIds) => {
    if (productIds.length === 0) return;
    const { data, error } = await supabase.from("product_recipe").select("*").in("product_id", productIds);

    if (error) {
      toast.error("Não foi possível carregar as fichas técnicas");
      return;
    }

    const grouped: Record<string, ProductRecipeLine[]> = Object.fromEntries(productIds.map((id) => [id, []]));
    for (const row of data) grouped[row.product_id].push(productRecipeLineFromRow(row));
    set((state) => ({ linesByProduct: { ...state.linesByProduct, ...grouped } }));
  },

  addLine: async (productId, rawMaterialId, quantityPerUnit) => {
    const { data, error } = await supabase
      .from("product_recipe")
      .insert({ product_id: productId, raw_material_id: rawMaterialId, quantity_per_unit: quantityPerUnit })
      .select("*")
      .single();

    if (error || !data) {
      toast.error(error?.code === "23505" ? "Esse insumo já está na ficha técnica" : "Não foi possível adicionar o componente");
      return false;
    }

    const line = productRecipeLineFromRow(data);
    set((state) => ({
      linesByProduct: { ...state.linesByProduct, [productId]: [...(state.linesByProduct[productId] ?? []), line] },
    }));
    return true;
  },

  updateLine: async (id, productId, quantityPerUnit) => {
    const { data, error } = await supabase
      .from("product_recipe")
      .update({ quantity_per_unit: quantityPerUnit })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      toast.error("Não foi possível atualizar o componente");
      return false;
    }

    const line = productRecipeLineFromRow(data);
    set((state) => ({
      linesByProduct: {
        ...state.linesByProduct,
        [productId]: (state.linesByProduct[productId] ?? []).map((item) => (item.id === id ? line : item)),
      },
    }));
    return true;
  },

  removeLine: async (id, productId) => {
    const { error } = await supabase.from("product_recipe").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover o componente");
      return false;
    }

    set((state) => ({
      linesByProduct: {
        ...state.linesByProduct,
        [productId]: (state.linesByProduct[productId] ?? []).filter((item) => item.id !== id),
      },
    }));
    return true;
  },
}));
