import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rawMaterialFromRow } from "@/lib/mappers/raw-material-mapper";
import type { RawMaterial, RawMaterialInput } from "@/types/raw-material";

function toRow(input: RawMaterialInput) {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    control_unit: input.controlUnit,
    image_url: input.imageUrl,
    purchase_unit_label: input.purchaseUnitLabel,
    purchase_unit_factor: input.purchaseUnitFactor,
    min_stock: input.minStock,
    max_stock: input.maxStock,
    min_purchase_qty: input.minPurchaseQty,
    default_reorder_qty: input.defaultReorderQty,
    purchase_multiple: input.purchaseMultiple,
    lead_time_days: input.leadTimeDays,
    cost_basis: input.costBasis,
    manual_cost: input.manualCost,
    primary_supplier_id: input.primarySupplierId,
    is_active: input.isActive,
  };
}

interface RawMaterialsState {
  materials: RawMaterial[];
  status: "idle" | "loading" | "ready" | "error";
  fetchMaterials: () => Promise<void>;
  createMaterial: (input: RawMaterialInput) => Promise<RawMaterial | null>;
  updateMaterial: (id: string, input: RawMaterialInput) => Promise<boolean>;
}

export const useRawMaterialsStore = create<RawMaterialsState>()((set) => ({
  materials: [],
  status: "idle",

  fetchMaterials: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("raw_materials").select("*").order("name", { ascending: true });

    if (error) {
      toast.error("Não foi possível carregar os insumos");
      set({ status: "error" });
      return;
    }

    set({ materials: data.map(rawMaterialFromRow), status: "ready" });
  },

  createMaterial: async (input) => {
    const { data, error } = await supabase.from("raw_materials").insert(toRow(input)).select("*").single();

    if (error || !data) {
      toast.error("Não foi possível cadastrar o insumo");
      return null;
    }

    const material = rawMaterialFromRow(data);
    set((state) => ({ materials: [...state.materials, material].sort((a, b) => a.name.localeCompare(b.name)) }));
    toast.success("Insumo cadastrado");
    return material;
  },

  updateMaterial: async (id, input) => {
    const { data, error } = await supabase.from("raw_materials").update(toRow(input)).eq("id", id).select("*").single();

    if (error || !data) {
      toast.error("Não foi possível atualizar o insumo");
      return false;
    }

    const material = rawMaterialFromRow(data);
    set((state) => ({
      materials: state.materials.map((item) => (item.id === id ? material : item)).sort((a, b) => a.name.localeCompare(b.name)),
    }));
    toast.success("Insumo atualizado");
    return true;
  },
}));
