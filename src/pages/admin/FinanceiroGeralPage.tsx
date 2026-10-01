import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFinanceiroGeralStore } from "@/store/financeiro-geral-store";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (status === "loading" && !summary) return <AdminState variant="loading" message="Carregando financeiro geral..." />;
  if (status === "error" || !summary) return <AdminState variant="error" message="Não foi possível carregar o financeiro geral." />;

  const temAtencao =
    summary.centralAtencao.despesasAtrasadas.quantidade > 0 ||
    summary.centralAtencao.recebiveisVencidos.quantidade > 0 ||
    summary.centralAtencao.estoqueCriticos > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Financeiro Geral</h1>
        <p className="text-sm text-ink-muted">Consolidado único de Aportes, Despesas, Receitas e Vendas — sem contagem duplicada.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Saldo disponível">
          <UnavailableValue motivo={summary.saldoDisponivel.motivo} />
        </Card>
        <Card label="Projeção de caixa (D+10/20/30)">
          <UnavailableValue motivo={summary.projecaoCaixa.motivo} />
        </Card>
        <Card label="Entradas do mês">
          <p className="text-xl font-extrabold text-emerald-700">{brl(summary.entradasMes.total)}</p>
        </Card>
        <Card label="Saídas do mês">
          <p className="text-xl font-extrabold text-red-600">{brl(summary.saidasMes.total)}</p>
        </Card>
        <Card label="A receber (em aberto)" to="/admin/faturar">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.aReceber)}</p>
        </Card>
        <Card label="A pagar (em aberto)" to="/admin/despesas">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.aPagar)}</p>
        </Card>
        <Card label="Aportes de sócios no mês" to="/admin/aportes">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.entradasMes.aportes)}</p>
        </Card>
        <Card label="Investimentos no mês" to="/admin/patrimonio">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.saidasMes.investimentos)}</p>
        </Card>
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

        <div className="rounded-3xl border border-forest-950/10 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-forest-950">Composição das Saídas</p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-ink-700">Operacionais (inclui folha)</span><span className="font-semibold text-ink-900">{brl(summary.saidasMes.operacionais)}</span></div>
            <div className="flex items-center justify-between"><span className="text-ink-700">Investimentos</span><span className="font-semibold text-ink-900">{brl(summary.saidasMes.investimentos)}</span></div>
          </div>
        </div>
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

      <p className="text-xs text-ink-muted">Atualizado em {new Date(summary.geradoEm).toLocaleString("pt-BR")}</p>
    </div>
  );
}
