import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export type FinanceiroPeriod = "month" | "3m" | "6m" | "year";

export interface UnavailableMetric {
  disponivel: false;
  motivo: string;
}

export interface ResultadoEmpresa {
  disponivel?: false;
  motivo?: string;
  month?: string;
  netRevenue?: number;
  cmvCpv?: number;
  grossProfit?: number;
  grossMargin?: number | null;
  operatingExpenses?: number;
  financialCharges?: number;
  managementNetResult?: number;
  managementNetMargin?: number | null;
}

export interface FinanceiroGeralSummary {
  periodo: FinanceiroPeriod;
  periodoDe: string;
  periodoAte: string;
  saldoDisponivel: UnavailableMetric;
  projecaoCaixa: UnavailableMetric;
  entradasMes: { total: number; vendas: number; outrasReceitas: number; aportes: number };
  saidasMes: { total: number; operacionais: number; investimentos: number; retiradasSocios: number };
  composicaoSaidas: { origin: string; total: number }[];
  resultadoEmpresa: ResultadoEmpresa;
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
  fetchSummary: (period?: FinanceiroPeriod) => Promise<void>;
}

export const useFinanceiroGeralStore = create<FinanceiroGeralState>((set) => ({
  summary: null,
  status: "idle",

  fetchSummary: async (period = "month") => {
    set({ status: "loading" });

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const { data, error } = await supabase.rpc("get_financeiro_geral_summary", { p_company_id: companyId, p_period: period });
    if (error || !data) {
      set({ status: "error" });
      return;
    }

    const raw = data as unknown as {
      periodo: FinanceiroPeriod;
      periodo_de: string;
      periodo_ate: string;
      saldo_disponivel: UnavailableMetric;
      projecao_caixa: UnavailableMetric;
      entradas_mes: { total: number; vendas: number; outras_receitas: number; aportes: number };
      saidas_mes: { total: number; operacionais: number; investimentos: number; retiradas_socios: number };
      composicao_saidas: { origin: string; total: number }[];
      resultado_empresa: {
        disponivel?: false;
        motivo?: string;
        month?: string;
        net_revenue?: number;
        cmv_cpv?: number;
        gross_profit?: number;
        gross_margin?: number | null;
        operating_expenses?: number;
        financial_charges?: number;
        management_net_result?: number;
        management_net_margin?: number | null;
      };
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
        periodo: raw.periodo,
        periodoDe: raw.periodo_de,
        periodoAte: raw.periodo_ate,
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
          retiradasSocios: raw.saidas_mes.retiradas_socios,
        },
        composicaoSaidas: raw.composicao_saidas ?? [],
        resultadoEmpresa: raw.resultado_empresa.disponivel === false
          ? { disponivel: false, motivo: raw.resultado_empresa.motivo ?? "" }
          : {
              month: raw.resultado_empresa.month,
              netRevenue: raw.resultado_empresa.net_revenue,
              cmvCpv: raw.resultado_empresa.cmv_cpv,
              grossProfit: raw.resultado_empresa.gross_profit,
              grossMargin: raw.resultado_empresa.gross_margin,
              operatingExpenses: raw.resultado_empresa.operating_expenses,
              financialCharges: raw.resultado_empresa.financial_charges,
              managementNetResult: raw.resultado_empresa.management_net_result,
              managementNetMargin: raw.resultado_empresa.management_net_margin,
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
