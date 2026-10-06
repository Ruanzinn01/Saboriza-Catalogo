import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFinanceiroGeralStore, type FinanceiroPeriod } from "@/store/financeiro-geral-store";
import { subscribeToTables } from "@/lib/realtime";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "-----" : `${v.toFixed(1)}%`);

const ORIGIN_LABEL: Record<string, string> = {
  stock: "Insumos e Mercadorias",
  asset: "Bens e Investimentos",
  expense: "Serviços e Outras Despesas",
  salary: "Gestão Salarial",
  commission: "Força de Vendas / Comissões",
  partner: "Sócios e Retiradas",
};

const PERIOD_OPTIONS: { value: FinanceiroPeriod; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "year", label: "Ano" },
];

function Card({ label, children, to }: { label: string; children: ReactNode; to?: string }) {
  const content = (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-forest-950/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {content}
    </Link>
  ) : (
    content
  );
}

function UnavailableValue({ motivo }: { motivo: string }) {
  return (
    <div>
      <p className="text-lg font-extrabold text-ink-muted">Indisponível</p>
      <p className="text-xs text-ink-muted">{motivo}</p>
    </div>
  );
}

export function FinanceiroGeralPage() {
  const summary = useFinanceiroGeralStore((s) => s.summary);
  const status = useFinanceiroGeralStore((s) => s.status);
  const fetchSummary = useFinanceiroGeralStore((s) => s.fetchSummary);
  const [period, setPeriod] = useState<FinanceiroPeriod>("month");

  useEffect(() => {
    fetchSummary(period);
    return subscribeToTables(
      "financeiro-geral",
      ["receivables", "revenues", "revenue_receipts", "revenue_receivables", "expenses", "expense_launches", "expense_launch_installments", "salary_obligations", "salary_advances", "partner_contributions", "investment_formation_ledger", "charges", "billings", "fiscal_documents"],
      () => fetchSummary(period),
    );
  }, [fetchSummary, period]);

  if (status === "loading" && !summary) return <AdminState variant="loading" message="Carregando financeiro geral..." />;
  if (status === "error" || !summary) return <AdminState variant="error" message="Não foi possível carregar o financeiro geral." />;

  const temAtencao =
    summary.centralAtencao.despesasAtrasadas.quantidade > 0 ||
    summary.centralAtencao.recebiveisVencidos.quantidade > 0 ||
    summary.centralAtencao.estoqueCriticos > 0;

  const resultado = summary.resultadoEmpresa;
  const resultadoDisponivel = resultado.disponivel !== false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Financeiro Geral</h1>
          <p className="text-sm text-ink-muted">Consolidado único de Aportes, Despesas, Receitas e Vendas — sem contagem duplicada.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                period === opt.value ? "border-forest-700 bg-forest-950/5 text-forest-900" : "border-forest-950/10 text-ink-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Saldo disponível">
          <UnavailableValue motivo={summary.saldoDisponivel.motivo} />
        </Card>
        <Card label="Projeção de caixa (D+10/20/30)">
          <UnavailableValue motivo={summary.projecaoCaixa.motivo} />
        </Card>
        <Card label="Entradas do período">
          <p className="text-xl font-extrabold text-emerald-700">{brl(summary.entradasMes.total)}</p>
        </Card>
        <Card label="Saídas do período">
          <p className="text-xl font-extrabold text-red-600">{brl(summary.saidasMes.total)}</p>
        </Card>
        <Card label="A receber (em aberto)" to="/admin/faturar">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.aReceber)}</p>
        </Card>
        <Card label="A pagar (em aberto)" to="/admin/despesas">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.aPagar)}</p>
        </Card>
        <Card label="Aportes de sócios no período" to="/admin/aportes">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.entradasMes.aportes)}</p>
        </Card>
        <Card label="Investimentos no período" to="/admin/patrimonio">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.saidasMes.investimentos)}</p>
        </Card>
      </div>

      <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-forest-950">Resultado da Empresa</p>
          <Link to="/admin/dre" className="text-xs font-semibold text-forest-800 hover:underline">Entender meu resultado →</Link>
        </div>
        {!resultadoDisponivel ? (
          <UnavailableValue motivo={resultado.motivo ?? "DRE indisponível"} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-ink-muted">Receita líquida</p><p className="font-bold text-ink-900">{brl(resultado.netRevenue ?? 0)}</p></div>
              <div><p className="text-xs text-ink-muted">Lucro bruto</p><p className="font-bold text-ink-900">{brl(resultado.grossProfit ?? 0)} <span className="text-xs text-ink-muted">({pct(resultado.grossMargin)})</span></p></div>
              <div><p className="text-xs text-ink-muted">Despesas operacionais</p><p className="font-bold text-ink-900">{brl(resultado.operatingExpenses ?? 0)}</p></div>
              <div><p className="text-xs text-ink-muted">Resultado líquido gerencial</p><p className="font-bold text-forest-950">{brl(resultado.managementNetResult ?? 0)} <span className="text-xs text-ink-muted">({pct(resultado.managementNetMargin)})</span></p></div>
            </div>
            <p className="mt-3 text-xs italic text-ink-muted">Lucro não é a mesma coisa que dinheiro em caixa.</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-forest-950/10 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-forest-950">Composição das Entradas</p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-ink-700">Vendas (pedidos faturados)</span><span className="font-semibold text-ink-900">{brl(summary.entradasMes.vendas)}</span></div>
            <div className="flex items-center justify-between"><span className="text-ink-700">Outras receitas</span><span className="font-semibold text-ink-900">{brl(summary.entradasMes.outrasReceitas)}</span></div>
            <div className="flex items-center justify-between"><span className="text-ink-700">Aportes de sócios</span><span className="font-semibold text-ink-900">{brl(summary.entradasMes.aportes)}</span></div>
          </div>
        </div>

        <Link to="/admin/despesas" className="block rounded-3xl border border-forest-950/10 bg-white p-4 transition hover:-translate-y-0.5">
          <p className="mb-3 text-sm font-bold text-forest-950">Composição das Saídas</p>
          <div className="flex flex-col gap-2 text-sm">
            {summary.composicaoSaidas.length === 0 ? (
              <p className="text-ink-muted">Sem saídas no período.</p>
            ) : (
              summary.composicaoSaidas.map((c) => (
                <div key={c.origin} className="flex items-center justify-between">
                  <span className="text-ink-700">{ORIGIN_LABEL[c.origin] ?? c.origin}</span>
                  <span className="font-semibold text-ink-900">{brl(c.total)}</span>
                </div>
              ))
            )}
            <div className="flex items-center justify-between border-t border-forest-950/5 pt-2"><span className="text-ink-700">Retiradas de sócios</span><span className="font-semibold text-ink-900">{brl(summary.saidasMes.retiradasSocios)}</span></div>
          </div>
        </Link>
      </div>

      <div className="rounded-3xl border border-forest-950/10 bg-white p-4">
        <p className="mb-3 text-sm font-bold text-forest-950">Central de Atenção</p>
        {!temAtencao ? (
          <p className="text-sm text-ink-muted">Sem problemas ativos no momento.</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {summary.centralAtencao.despesasAtrasadas.quantidade > 0 && (
              <Link to="/admin/despesas" className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100">
                <span>{summary.centralAtencao.despesasAtrasadas.quantidade} despesa(s) atrasada(s)</span>
                <span className="font-bold">{brl(summary.centralAtencao.despesasAtrasadas.valor)}</span>
              </Link>
            )}
            {summary.centralAtencao.recebiveisVencidos.quantidade > 0 && (
              <Link to="/admin/faturar" className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100">
                <span>{summary.centralAtencao.recebiveisVencidos.quantidade} título(s) a receber vencido(s)</span>
                <span className="font-bold">{brl(summary.centralAtencao.recebiveisVencidos.valor)}</span>
              </Link>
            )}
            {summary.centralAtencao.estoqueCriticos > 0 && (
              <Link to="/admin/estoque/indicadores" className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-red-700 hover:bg-red-100">
                <span>Itens em estoque crítico</span>
                <span className="font-bold">{summary.centralAtencao.estoqueCriticos}</span>
              </Link>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Período: {summary.periodoDe} a {summary.periodoAte} · Atualizado em {new Date(summary.geradoEm).toLocaleString("pt-BR")}
      </p>
    </div>
  );
}
