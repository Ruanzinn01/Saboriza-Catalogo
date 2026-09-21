import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { productionRecordFromRow } from "@/lib/mappers/production-mapper";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useCatalogStore } from "@/store/catalog-store";
import type { ProductionRecord } from "@/types/production";

interface ProductionState {
  records: ProductionRecord[];
  productStock: Record<string, number>;
  status: "idle" | "loading" | "ready" | "error";
  fetchRecords: () => Promise<void>;
  fetchProductStock: (productIds: string[]) => Promise<void>;
  registerProduction: (productId: string, packsQuantity: number) => Promise<{ record: ProductionRecord | null; error: string | null }>;
  refreshAfterProduction: (productIds: string[]) => Promise<void>;
}

export const useProductionStore = create<ProductionState>()((set) => ({
  records: [],
  productStock: {},
  status: "idle",

  fetchRecords: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("production_records").select("*").order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar os registros de produção");
      set({ status: "error" });
      return;
    }

    set({ records: data.map(productionRecordFromRow), status: "ready" });
  },

  fetchProductStock: async (productIds) => {
    if (productIds.length === 0) return;
    const { data, error } = await supabase.from("products").select("id, current_stock").in("id", productIds);
    if (error || !data) return;
    set((state) => ({
      productStock: {
        ...state.productStock,
        ...Object.fromEntries(data.map((row) => [row.id, row.current_stock])),
      },
    }));
  },

  registerProduction: async (productId, packsQuantity) => {
    const { data, error } = await supabase
      .rpc("create_production", { p_product_id: productId, p_packs_quantity: packsQuantity })
      .single();

    if (error || !data) {
      return { record: null, error: error?.message ?? "Não foi possível registrar a produção" };
    }

    const record = productionRecordFromRow(data);
    set((state) => ({ records: [record, ...state.records] }));
    return { record, error: null };
  },

  refreshAfterProduction: async (productIds) => {
    await Promise.all([
      useRawMaterialsStore.getState().fetchMaterials(),
      useCatalogStore.getState().refreshProducts(productIds),
      useProductionStore.getState().fetchProductStock(productIds),
    ]);
  },
}));
