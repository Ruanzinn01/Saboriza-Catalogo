import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export type AssetStatus = "ATIVO" | "BAIXADO";

export interface AssetUnit {
  id: string;
  modelName: string;
  category: string;
  acquisitionValue: number;
  acquisitionDate: string | null;
  status: AssetStatus;
  responsibleId: string | null;
  responsibleName: string | null;
}

export interface NewAssetInput {
  modelName: string;
  category: string;
  acquisitionValue: number;
  acquisitionDate?: string;
  responsibleId?: string;
}

interface PatrimonioState {
  assets: AssetUnit[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  createAsset: (input: NewAssetInput) => Promise<string | null>;
  writeOffAsset: (id: string) => Promise<string | null>;
}

export const usePatrimonioStore = create<PatrimonioState>((set, get) => ({
  assets: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });

    const { data: rows, error } = await supabase
      .from("asset_units")
      .select("id, acquisition_value, acquisition_date, status, current_responsible_id, asset_models(name, category), employees(name)")
      .order("created_at", { ascending: false });

    if (error) {
      set({ status: "error" });
      return;
    }

    set({
      assets: (rows ?? []).map((a) => {
        const model = a.asset_models as unknown as { name: string; category: string } | null;
        const employee = a.employees as unknown as { name: string } | null;
        return {
          id: a.id,
          modelName: model?.name ?? "-----",
          category: model?.category ?? "OUTRO",
          acquisitionValue: a.acquisition_value,
          acquisitionDate: a.acquisition_date,
          status: a.status as AssetStatus,
          responsibleId: a.current_responsible_id,
          responsibleName: employee?.name ?? null,
        };
      }),
      status: "ready",
    });
  },

  createAsset: async (input) => {
    const { data: model, error: modelError } = await supabase
      .from("asset_models")
      .insert({ name: input.modelName, category: input.category })
      .select("id")
      .single();
    if (modelError) return modelError.message;

    const { error: unitError } = await supabase.from("asset_units").insert({
      asset_model_id: model.id,
      acquisition_value: input.acquisitionValue,
      acquisition_date: input.acquisitionDate || null,
      current_responsible_id: input.responsibleId || null,
    });
    if (unitError) return unitError.message;

    await get().fetchAll();
    return null;
  },

  writeOffAsset: async (id) => {
    const { error } = await supabase.from("asset_units").update({ status: "BAIXADO" }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },
}));
