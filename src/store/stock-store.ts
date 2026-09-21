import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { stockMovementFromRow } from "@/lib/mappers/stock-mapper";
import { useCatalogStore } from "@/store/catalog-store";
import type { StockMovement } from "@/types/stock";

interface StockState {
  movementsByProduct: Record<string, StockMovement[]>;
  status: "idle" | "loading" | "ready" | "error";
  fetchMovements: (productId: string) => Promise<void>;
  createEntry: (productId: string, quantity: number, observation: string) => Promise<boolean>;
  adjustStock: (productId: string, countedStock: number, reason: string) => Promise<boolean>;
}

function refreshProductInCatalog(productId: string) {
  return useCatalogStore.getState().refreshProducts([productId]);
}

export const useStockStore = create<StockState>()((set) => ({
  movementsByProduct: {},
  status: "idle",

  fetchMovements: async (productId) => {
    set({ status: "loading" });
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar a movimentação do produto");
      set({ status: "error" });
      return;
    }

    set((state) => ({
      movementsByProduct: { ...state.movementsByProduct, [productId]: data.map(stockMovementFromRow) },
      status: "ready",
    }));
  },

  createEntry: async (productId, quantity, observation) => {
    const { data, error } = await supabase
      .rpc("create_stock_entry", { p_product_id: productId, p_quantity: quantity, p_observation: observation })
      .single();

    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível registrar a entrada");
      return false;
    }

    const movement = stockMovementFromRow(data);
    set((state) => ({
      movementsByProduct: {
        ...state.movementsByProduct,
        [productId]: [movement, ...(state.movementsByProduct[productId] ?? [])],
      },
    }));
    await refreshProductInCatalog(productId);
    toast.success("Entrada registrada");
    return true;
  },

  adjustStock: async (productId, countedStock, reason) => {
    const { data, error } = await supabase
      .rpc("adjust_stock", { p_product_id: productId, p_counted_stock: countedStock, p_reason: reason })
      .single();

    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível ajustar o estoque");
      return false;
    }

    const movement = stockMovementFromRow(data);
    set((state) => ({
      movementsByProduct: {
        ...state.movementsByProduct,
        [productId]: [movement, ...(state.movementsByProduct[productId] ?? [])],
      },
    }));
    await refreshProductInCatalog(productId);
    toast.success("Ajuste registrado");
    return true;
  },
}));
