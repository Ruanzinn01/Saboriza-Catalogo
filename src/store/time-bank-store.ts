import { create } from "zustand";
import { supabase } from "@/lib/supabase";

interface TimeBankState {
  balanceMinutes: number;
  status: "idle" | "loading" | "ready" | "error";
  fetchBalance: (employeeId: string) => Promise<void>;
  closeCompetencia: (employeeId: string, competencia: string) => Promise<{ extraMinutes: number; lateMinutes: number } | null>;
  resolve: (employeeId: string, minutes: number, resolution: "PAGO" | "COMPENSADO") => Promise<string | null>;
}

export const useTimeBankStore = create<TimeBankState>((set, get) => ({
  balanceMinutes: 0,
  status: "idle",

  fetchBalance: async (employeeId) => {
    set({ status: "loading" });
    const { data, error } = await supabase.rpc("oris360_time_bank_balance", { p_employee_id: employeeId });
    if (error) {
      set({ status: "error" });
      return;
    }
    set({ balanceMinutes: data ?? 0, status: "ready" });
  },

  closeCompetencia: async (employeeId, competencia) => {
    const { data, error } = await supabase.rpc("oris360_fechar_competencia_ponto", {
      p_employee_id: employeeId,
      p_competencia: competencia,
    });
    if (error || !data) return null;
    await get().fetchBalance(employeeId);
    const result = data as unknown as { extra_minutes: number; late_minutes: number };
    return { extraMinutes: result.extra_minutes, lateMinutes: result.late_minutes };
  },

  resolve: async (employeeId, minutes, resolution) => {
    const { error } = await supabase.rpc("oris360_resolver_banco_horas", {
      p_employee_id: employeeId,
      p_minutes: minutes,
      p_resolution: resolution,
    });
    if (error) return error.message;
    await get().fetchBalance(employeeId);
    return null;
  },
}));
