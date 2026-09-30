import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface PulsoEvent {
  occurredAt: string;
  eventType: string;
  subject: string;
  deepLink: string;
}

export interface PulsoSummary {
  vendasHoje: number;
  pedidosHoje: number;
  producaoHoje: number;
  entregasHoje: number;
  colaboradoresAtivos: number;
  eventos: PulsoEvent[];
  geradoEm: string;
}

interface PulsoState {
  summary: PulsoSummary | null;
  status: "idle" | "loading" | "ready" | "error";
  fetchSummary: () => Promise<void>;
}

export const usePulsoStore = create<PulsoState>((set) => ({
  summary: null,
  status: "idle",

  fetchSummary: async () => {
    set({ status: "loading" });

    const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
    if (!company) {
      set({ status: "error" });
      return;
    }

    const { data, error } = await supabase.rpc("get_pulso_today", { p_company_id: company.id });

    if (error || !data) {
      set({ status: "error" });
      return;
    }

    const raw = data as {
      vendas_hoje: number;
      pedidos_hoje: number;
      producao_hoje: number;
      entregas_hoje: number;
      colaboradores_ativos: number;
      eventos: { occurredAt: string; eventType: string; subject: string; deepLink: string }[];
      gerado_em: string;
    };

    set({
      summary: {
        vendasHoje: raw.vendas_hoje,
        pedidosHoje: raw.pedidos_hoje,
        producaoHoje: raw.producao_hoje,
        entregasHoje: raw.entregas_hoje,
        colaboradoresAtivos: raw.colaboradores_ativos,
        eventos: raw.eventos ?? [],
        geradoEm: raw.gerado_em,
      },
      status: "ready",
    });
  },
}));
