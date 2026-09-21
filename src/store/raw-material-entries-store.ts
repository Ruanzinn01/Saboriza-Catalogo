import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rawMaterialEntryFromRow } from "@/lib/mappers/raw-material-entry-mapper";
import { rawMaterialFromRow } from "@/lib/mappers/raw-material-mapper";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import type { RawMaterialEntry, RawMaterialEntryInput } from "@/types/raw-material";

function toRow(input: RawMaterialEntryInput) {
  return {
    raw_material_id: input.rawMaterialId,
    supplier_id: input.supplierId,
    packages_quantity: input.packagesQuantity,
    unit_price: input.unitPrice,
    batch: input.batch,
    expiry_date: input.expiryDate,
    entry_date: input.entryDate,
    invoice_number: input.invoiceNumber,
    invoice_series: input.invoiceSeries,
    invoice_issue_date: input.invoiceIssueDate,
    invoice_access_key: input.invoiceAccessKey,
  };
}

interface RawMaterialEntriesState {
  entriesByMaterial: Record<string, RawMaterialEntry[]>;
  status: "idle" | "loading" | "ready" | "error";
  fetchEntries: (rawMaterialId: string) => Promise<void>;
  saveDraft: (input: RawMaterialEntryInput) => Promise<RawMaterialEntry | null>;
  confirmEntry: (entryId: string, rawMaterialId: string) => Promise<boolean>;
  reverseEntry: (entryId: string, rawMaterialId: string, reason: string) => Promise<boolean>;
}

export const useRawMaterialEntriesStore = create<RawMaterialEntriesState>()((set) => ({
  entriesByMaterial: {},
  status: "idle",

  fetchEntries: async (rawMaterialId) => {
    set({ status: "loading" });
    const { data, error } = await supabase
      .from("raw_material_entries")
      .select("*")
      .eq("raw_material_id", rawMaterialId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar as entradas do insumo");
      set({ status: "error" });
      return;
    }

    set((state) => ({
      entriesByMaterial: { ...state.entriesByMaterial, [rawMaterialId]: data.map(rawMaterialEntryFromRow) },
      status: "ready",
    }));
  },

  saveDraft: async (input) => {
    const { data, error } = await supabase.from("raw_material_entries").insert(toRow(input)).select("*").single();

    if (error || !data) {
      toast.error("Não foi possível salvar o rascunho da entrada");
      return null;
    }

    const entry = rawMaterialEntryFromRow(data);
    set((state) => ({
      entriesByMaterial: {
        ...state.entriesByMaterial,
        [input.rawMaterialId]: [entry, ...(state.entriesByMaterial[input.rawMaterialId] ?? [])],
      },
    }));
    toast.success("Rascunho salvo. Saldo e custo não foram alterados.");
    return entry;
  },

  confirmEntry: async (entryId, rawMaterialId) => {
    const { data, error } = await supabase.rpc("confirm_raw_material_entry", { p_entry_id: entryId }).single();

    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível confirmar a entrada");
      return false;
    }

    const entry = rawMaterialEntryFromRow(data);
    set((state) => ({
      entriesByMaterial: {
        ...state.entriesByMaterial,
        [rawMaterialId]: (state.entriesByMaterial[rawMaterialId] ?? []).map((item) => (item.id === entryId ? entry : item)),
      },
    }));

    const { data: materialRow, error: materialError } = await supabase
      .from("raw_materials")
      .select("*")
      .eq("id", rawMaterialId)
      .single();
    if (!materialError && materialRow) {
      const material = rawMaterialFromRow(materialRow);
      useRawMaterialsStore.setState((state) => ({
        materials: state.materials.map((item) => (item.id === rawMaterialId ? material : item)),
      }));
    }

    toast.success("Entrada confirmada. Saldo e custo médio atualizados.");
    return true;
  },

  reverseEntry: async (entryId, rawMaterialId, reason) => {
    const { data, error } = await supabase.rpc("reverse_raw_material_entry", { p_entry_id: entryId, p_reason: reason }).single();

    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível estornar a entrada");
      return false;
    }

    const entry = rawMaterialEntryFromRow(data);
    set((state) => ({
      entriesByMaterial: {
        ...state.entriesByMaterial,
        [rawMaterialId]: (state.entriesByMaterial[rawMaterialId] ?? []).map((item) => (item.id === entryId ? entry : item)),
      },
    }));

    const { data: materialRow, error: materialError } = await supabase
      .from("raw_materials")
      .select("*")
      .eq("id", rawMaterialId)
      .single();
    if (!materialError && materialRow) {
      const material = rawMaterialFromRow(materialRow);
      useRawMaterialsStore.setState((state) => ({
        materials: state.materials.map((item) => (item.id === rawMaterialId ? material : item)),
      }));
    }

    toast.success("Entrada estornada. Saldo e custo médio revertidos.");
    return true;
  },
}));
