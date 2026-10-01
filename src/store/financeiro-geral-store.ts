import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface UnavailableMetric {
  disponivel: false;
  motivo: string;
}

export interface FinanceiroGeralSummary {
  saldoDisponivel: UnavailableMetric;
  projecaoCaixa: UnavailableMetric;
  entradasMes: { total: number; vendas: number; outrasReceitas: number; aportes: number };
  saidasMes: { total: number; operacionais: number; investimentos: number };
  aReceber: number;
  aPagar: number;
  centralAtencao: {
    despesasAtrasadas: { quantidade: number; valor: number };
    recebiveisVencidos: { quantidade: number; valor: number };
    estoqueCriticos: number;
  };
  geradoEm: string;
}

interface FinanceiroGeralState {
  summary: FinanceiroGeralSummary | null;
  status: "idle" | "loading" | "ready" | "error";
  fetchSummary: () => Promise<void>;
}

export const useFinanceiroGeralStore = create<FinanceiroGeralState>((set) => ({
  summary: null,
  status: "idle",

  fetchSummary: async () => {
    set({ status: "loading" });

    const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
    if (!company) {
      set({ status: "error" });
      return;
    }

    const { data, error } = await supabase.rpc("get_financeiro_geral_summary", { p_company_id: company.id });
    if (error || !data) {
      set({ status: "error" });
      return;
    }

    const raw = data as {
      saldo_disponivel: UnavailableMetric;
      projecao_caixa: UnavailableMetric;
      entradas_mes: { total: number; vendas: number; outras_receitas: number; aportes: number };
      saidas_mes: { total: number; operacionais: number; investimentos: number };
      a_receber: number;
      a_pagar: number;
      central_atencao: {
        despesas_atrasadas: { quantidade: number; valor: number };
        recebiveis_vencidos: { quantidade: number; valor: number };
        estoque_criticos: number;
      };
      gerado_em: string;
    };

    set({
      summary: {
        saldoDisponivel: raw.saldo_disponivel,
        projecaoCaixa: raw.projecao_caixa,
        entradasMes: {
          total: raw.entradas_mes.total,
          vendas: raw.entradas_mes.vendas,
          outrasReceitas: raw.entradas_mes.outras_receitas,
          aportes: raw.entradas_mes.aportes,
        },
        saidasMes: {
          total: raw.saidas_mes.total,
          operacionais: raw.saidas_mes.operacionais,
          investimentos: raw.saidas_mes.investimentos,
        },
        aReceber: raw.a_receber,
        aPagar: raw.a_pagar,
        centralAtencao: {
          despesasAtrasadas: raw.central_atencao.despesas_atrasadas,
          recebiveisVencidos: raw.central_atencao.recebiveis_vencidos,
          estoqueCriticos: raw.central_atencao.estoque_criticos,
        },
        geradoEm: raw.gerado_em,
      },
      status: "ready",
    });
  },
}));
