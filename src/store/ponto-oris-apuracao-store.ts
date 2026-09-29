import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface DayResult {
  date: string;
  workedMinutes: number;
  inconsistencyType: string | null;
  openSessionStart: string | null;
}

interface ApuracaoState {
  days: DayResult[];
  status: "idle" | "loading" | "ready" | "error";
  fetchMonth: (employeeId: string, competencia: string) => Promise<void>;
}

export const usePontoOrisApuracaoStore = create<ApuracaoState>((set) => ({
  days: [],
  status: "idle",

  fetchMonth: async (employeeId, competencia) => {
    set({ status: "loading" });
    const { data, error } = await supabase.rpc("oris360_apurar_mes", {
      p_employee_id: employeeId,
      p_competencia: competencia,
    });

    if (error) {
      set({ status: "error", days: [] });
      return;
    }

    set({
      status: "ready",
      days: (data ?? []).map((row) => ({
        date: row.dia,
        workedMinutes: row.worked_minutes ?? 0,
        inconsistencyType: row.inconsistency_type,
        openSessionStart: row.open_session_start,
      })),
    });
  },
}));
