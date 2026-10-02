import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export interface DreMonthLine {
  month: string;
  grossRevenue: number;
  deductions: number;
  otherRevenue: number;
  netRevenue: number;
  cmvCpv: number;
  grossProfit: number;
  operatingExpenses: number;
  financialCharges: number;
  managerialOperatingResult: number;
}

interface DreState {
  lines: DreMonthLine[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
}

export const useDreStore = create<DreState>((set) => ({
  lines: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const { data, error } = await supabase.rpc("get_dre_monthly", { p_company_id: companyId });

    if (error) {
      set({ status: "error" });
      return;
    }

    set({
      lines: (data ?? []).map((d) => ({
        month: d.month ?? "",
        grossRevenue: d.gross_revenue ?? 0,
        deductions: d.deductions ?? 0,
        otherRevenue: d.other_revenue ?? 0,
        netRevenue: d.net_revenue ?? 0,
        cmvCpv: d.cmv_cpv ?? 0,
        grossProfit: d.gross_profit ?? 0,
        operatingExpenses: d.operating_expenses ?? 0,
        financialCharges: d.financial_charges ?? 0,
        managerialOperatingResult: d.managerial_operating_result ?? 0,
      })),
      status: "ready",
    });
  },
}));
