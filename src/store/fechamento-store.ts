import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export type MonthlyCloseStatus =
  | "EM_ANDAMENTO"
  | "PREPARANDO"
  | "PRONTO"
  | "FECHADO_AUTOMATICAMENTE"
  | "FECHADO_COM_PENDENCIA"
  | "FALHA_TECNICA_FECHAMENTO";

export interface MonthlyClose {
  id: string;
  competence: string;
  status: MonthlyCloseStatus;
  snapshot: Record<string, unknown>;
  pendencies: string[];
  closedAt: string | null;
}

interface FechamentoState {
  companyId: string | null;
  closes: MonthlyClose[];
  automationEnabled: boolean;
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  setAutomation: (enabled: boolean) => Promise<string | null>;
}

export const useFechamentoStore = create<FechamentoState>((set, get) => ({
  companyId: null,
  closes: [],
  automationEnabled: false,
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });

    const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
    if (!company) {
      set({ status: "error" });
      return;
    }

    const [{ data: closes, error: closesError }, { data: settings }] = await Promise.all([
      supabase.from("monthly_closes").select("*").eq("company_id", company.id).order("competence", { ascending: false }),
      supabase.from("company_closing_settings").select("automation_enabled").eq("company_id", company.id).maybeSingle(),
    ]);

    if (closesError) {
      set({ status: "error" });
      return;
    }

    set({
      companyId: company.id,
      automationEnabled: settings?.automation_enabled ?? false,
      closes: (closes ?? []).map((c) => ({
        id: c.id,
        competence: c.competence,
        status: c.status as MonthlyCloseStatus,
        snapshot: (c.snapshot as Record<string, unknown>) ?? {},
        pendencies: (c.pendencies as string[]) ?? [],
        closedAt: c.closed_at,
      })),
      status: "ready",
    });
  },

  setAutomation: async (enabled) => {
    const companyId = get().companyId;
    if (!companyId) return "Empresa não identificada";

    const { error } = await supabase.rpc("set_monthly_close_automation", { p_company_id: companyId, p_enabled: enabled });
    if (error) return error.message;

    set({ automationEnabled: enabled });
    return null;
  },
}));
