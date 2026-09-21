import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { stockMovementFromRow } from "@/lib/mappers/stock-mapper";
import { rawMaterialEntryFromRow } from "@/lib/mappers/raw-material-entry-mapper";
import type { StockMovement } from "@/types/stock";
import type { RawMaterialEntry } from "@/types/raw-material";

export interface MaterialConsumption {
  rawMaterialId: string;
  consumedQuantity: number;
  confirmedAt: string;
}

interface StockInsightsState {
  movements: StockMovement[];
  entries: RawMaterialEntry[];
  consumptions: MaterialConsumption[];
  status: "idle" | "loading" | "ready" | "error";
  fetchInsights: () => Promise<void>;
}

export const useStockInsightsStore = create<StockInsightsState>()((set) => ({
  movements: [],
  entries: [],
  consumptions: [],
  status: "idle",

  fetchInsights: async () => {
    set({ status: "loading" });

    const [movementsRes, entriesRes, consumptionsRes] = await Promise.all([
      supabase.from("stock_movements").select("*"),
      supabase.from("raw_material_entries").select("*").eq("status", "confirmed"),
      supabase
        .from("production_consumptions")
        .select("raw_material_id, consumed_quantity, production_records!inner(confirmed_at)"),
    ]);

    if (movementsRes.error || entriesRes.error || consumptionsRes.error) {
      toast.error("Não foi possível carregar os dados de indicadores de estoque");
      set({ status: "error" });
      return;
    }

    const consumptions: MaterialConsumption[] = (consumptionsRes.data ?? []).map((row) => ({
      rawMaterialId: row.raw_material_id,
      consumedQuantity: row.consumed_quantity,
      confirmedAt: (row.production_records as unknown as { confirmed_at: string }).confirmed_at,
    }));

    set({
      movements: (movementsRes.data ?? []).map(stockMovementFromRow),
      entries: (entriesRes.data ?? []).map(rawMaterialEntryFromRow),
      consumptions,
      status: "ready",
    });
  },
}));
