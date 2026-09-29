import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface DayResult {
  date: string;
  workedMinutes: number;
  normalMinutes: number;
  extraMinutes: number;
  lateMinutes: number;
  inconsistencyType: string | null;
  openSessionStart: string | null;
}

export interface PunchDetail {
  id: string;
  type: "ENTRADA" | "INTERVALO" | "RETORNO" | "SAIDA";
  serverTime: string;
  photoPath: string | null;
  photoUrl: string | null;
}

export interface DayDetail {
  workedMinutes: number;
  normalMinutes: number;
  extraMinutes: number;
  lateMinutes: number;
  inconsistencyType: string | null;
  punches: PunchDetail[];
}

interface ApuracaoState {
  days: DayResult[];
  status: "idle" | "loading" | "ready" | "error";
  fetchMonth: (employeeId: string, competencia: string) => Promise<void>;

  expandedDate: string | null;
  dayDetail: DayDetail | null;
  dayDetailStatus: "idle" | "loading" | "ready" | "error";
  toggleDay: (employeeId: string, date: string) => Promise<void>;
}

export const usePontoOrisApuracaoStore = create<ApuracaoState>((set, get) => ({
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
        normalMinutes: row.normal_minutes ?? 0,
        extraMinutes: row.extra_minutes ?? 0,
        lateMinutes: row.late_minutes ?? 0,
        inconsistencyType: row.inconsistency_type,
        openSessionStart: row.open_session_start,
      })),
    });
  },

  expandedDate: null,
  dayDetail: null,
  dayDetailStatus: "idle",

  toggleDay: async (employeeId, date) => {
    if (get().expandedDate === date) {
      set({ expandedDate: null, dayDetail: null, dayDetailStatus: "idle" });
      return;
    }

    set({ expandedDate: date, dayDetail: null, dayDetailStatus: "loading" });

    const { data, error } = await supabase.rpc("oris360_apurar_dia_detalhado", {
      p_employee_id: employeeId,
      p_date: date,
    });

    if (error || !data) {
      set({ dayDetailStatus: "error" });
      return;
    }

    const raw = data as unknown as {
      worked_minutes: number;
      normal_minutes: number;
      extra_minutes: number;
      late_minutes: number;
      inconsistency_type: string | null;
      punches: { id: string; type: PunchDetail["type"]; server_time: string; photo_path: string | null }[];
    };

    const punches: PunchDetail[] = raw.punches.map((p) => ({
      id: p.id,
      type: p.type,
      serverTime: p.server_time,
      photoPath: p.photo_path,
      photoUrl: null,
    }));

    set({
      dayDetailStatus: "ready",
      dayDetail: {
        workedMinutes: raw.worked_minutes,
        normalMinutes: raw.normal_minutes,
        extraMinutes: raw.extra_minutes,
        lateMinutes: raw.late_minutes,
        inconsistencyType: raw.inconsistency_type,
        punches,
      },
    });

    // Assina as fotos em segundo plano (nao bloqueia a exibicao dos horarios).
    for (const punch of punches) {
      if (!punch.photoPath) continue;
      const { data: urlData } = await supabase.functions.invoke<{ url?: string }>("ponto-oris-terminal", {
        body: { action: "get-photo-url", photo_path: punch.photoPath },
      });
      if (urlData?.url) {
        set((state) => {
          if (!state.dayDetail) return state;
          return {
            dayDetail: {
              ...state.dayDetail,
              punches: state.dayDetail.punches.map((p) => (p.id === punch.id ? { ...p, photoUrl: urlData.url ?? null } : p)),
            },
          };
        });
      }
    }
  },
}));
