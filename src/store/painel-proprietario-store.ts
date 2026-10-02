import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export interface UnavailableMetric {
  disponivel: false;
  motivo: string;
}

export interface OwnerPanelSummary {
  saldoDisponivel: UnavailableMetric;
  projecaoCaixa: UnavailableMetric;
  aReceber: number;
  aPagar: number;
  resultadoMes: { disponivel: boolean; valor: number | null; mes: string | null };
  ativosMonitorados: number;
  estoqueCriticos: number;
  aportesMes: number;
  geradoEm: string;
}

interface PainelProprietarioState {
  summary: OwnerPanelSummary | null;
  status: "idle" | "loading" | "ready" | "error";
  fetchSummary: () => Promise<void>;
}

export const usePainelProprietarioStore = create<PainelProprietarioState>((set) => ({
  summary: null,
  status: "idle",

  fetchSummary: async () => {
    set({ status: "loading" });

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const { data, error } = await supabase.rpc("get_owner_panel_summary", { p_company_id: companyId });

    if (error || !data) {
      set({ status: "error" });
      return;
    }

    const raw = data as {
      saldo_disponivel: { disponivel: false; motivo: string };
      projecao_caixa: { disponivel: false; motivo: string };
      a_receber: number;
      a_pagar: number;
      resultado_mes: { disponivel: boolean; valor: number | null; mes: string | null };
      ativos_monitorados: number;
      estoque_criticos: number;
      aportes_mes: number;
      gerado_em: string;
    };

    set({
      summary: {
        saldoDisponivel: raw.saldo_disponivel,
        projecaoCaixa: raw.projecao_caixa,
        aReceber: raw.a_receber,
        aPagar: raw.a_pagar,
        resultadoMes: raw.resultado_mes,
        ativosMonitorados: raw.ativos_monitorados,
        estoqueCriticos: raw.estoque_criticos,
        aportesMes: raw.aportes_mes,
        geradoEm: raw.gerado_em,
      },
      status: "ready",
    });
  },
}));
