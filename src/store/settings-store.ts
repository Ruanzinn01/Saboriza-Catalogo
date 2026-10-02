import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { settingsFromRow, settingsToRow } from "@/lib/mappers/settings-mapper";
import type { Settings } from "@/types/settings";

interface SettingsState {
  settings: Settings | null;
  status: "idle" | "loading" | "ready" | "error";
  fetchSettings: (companyId?: string) => Promise<void>;
  updateSettings: (patch: Partial<Omit<Settings, "id">>) => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: null,
  status: "idle",

  fetchSettings: async (companyId) => {
    set({ status: "loading" });
    const resolvedId = companyId ?? (await resolveCurrentCompanyId());
    if (!resolvedId) {
      set({ status: "error" });
      return;
    }

    const { data, error } = await supabase.from("settings").select("*").eq("company_id", resolvedId).maybeSingle();

    if (error) {
      toast.error("Não foi possível carregar as configurações");
      set({ status: "error" });
      return;
    }

    set({ settings: data ? settingsFromRow(data) : null, status: "ready" });
  },

  updateSettings: (patch) => {
    const previous = get().settings;
    if (!previous) return;
    const updated = { ...previous, ...patch };
    set({ settings: updated });
    supabase
      .from("settings")
      .update(settingsToRow(updated))
      .eq("id", updated.id)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível salvar as configurações");
          set({ settings: previous });
        } else {
          toast.success("Configurações salvas");
        }
      });
  },
}));
