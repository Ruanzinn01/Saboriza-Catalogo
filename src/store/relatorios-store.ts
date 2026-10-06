import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import type { Json } from "@/types/supabase";

export interface GeneratedReport {
  id: string;
  module: string;
  reportType: string;
  periodFrom: string | null;
  periodTo: string | null;
  generatedAt: string;
}

interface RelatoriosState {
  reports: GeneratedReport[];
  status: "idle" | "loading" | "ready" | "error";
  fetchReports: (module: string) => Promise<void>;
  registerReport: (input: { module: string; reportType: string; periodFrom?: string; periodTo?: string; filters?: Record<string, unknown> }) => Promise<string | null>;
}

export const useRelatoriosStore = create<RelatoriosState>((set, get) => ({
  reports: [],
  status: "idle",

  fetchReports: async (module) => {
    set({ status: "loading" });
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }
    const { data, error } = await supabase
      .from("generated_report")
      .select("id, module, report_type, period_from, period_to, generated_at")
      .eq("company_id", companyId)
      .eq("module", module)
      .order("generated_at", { ascending: false })
      .limit(20);
    if (error) {
      set({ status: "error" });
      return;
    }
    set({
      reports: (data ?? []).map((r) => ({
        id: r.id,
        module: r.module,
        reportType: r.report_type,
        periodFrom: r.period_from,
        periodTo: r.period_to,
        generatedAt: r.generated_at,
      })),
      status: "ready",
    });
  },

  registerReport: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error } = await supabase.from("generated_report").insert({
      company_id: companyId,
      module: input.module,
      report_type: input.reportType,
      period_from: input.periodFrom || null,
      period_to: input.periodTo || null,
      filters_json: (input.filters ?? {}) as Json,
    });
    if (error) return error.message;
    await get().fetchReports(input.module);
    return null;
  },
}));
