import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePainelProprietarioStore } from "@/store/painel-proprietario-store";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function KpiCard({ label, children, to }: { label: string; children: ReactNode; to?: string }) {
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

export function PainelProprietarioPage() {
  const summary = usePainelProprietarioStore((s) => s.summary);
  const status = usePainelProprietarioStore((s) => s.status);
  const fetchSummary = usePainelProprietarioStore((s) => s.fetchSummary);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (status === "loading" && !summary) return <AdminState variant="loading" message="Carregando painel do proprietário..." />;
  if (status === "error" || !summary) return <AdminState variant="error" message="Não foi possível carregar o painel do proprietário." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Painel do Proprietário</h1>
        <p className="text-sm text-ink-muted">Resumo executivo somente leitura. Cada indicador vem de um único motor de origem — toque para ver o detalhe lá.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Saldo disponível">
          <UnavailableValue motivo={summary.saldoDisponivel.motivo} />
        </KpiCard>
        <KpiCard label="Projeção de caixa">
          <UnavailableValue motivo={summary.projecaoCaixa.motivo} />
        </KpiCard>
        <KpiCard label="A receber (em aberto)" to="/admin/faturar">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.aReceber)}</p>
        </KpiCard>
        <KpiCard label="A pagar (em aberto)" to="/admin/despesas">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.aPagar)}</p>
        </KpiCard>
        <KpiCard label="Resultado do mês (DRE)" to="/admin/dre">
          {summary.resultadoMes.disponivel ? (
            <p className={`text-xl font-extrabold ${summary.resultadoMes.valor! >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {brl(summary.resultadoMes.valor!)}
            </p>
          ) : (
            <UnavailableValue motivo="Sem fechamento do DRE para o mês corrente ainda" />
          )}
        </KpiCard>
        <KpiCard label="Ativos monitorados" to="/admin/patrimonio">
          <p className="text-xl font-extrabold text-forest-950">{summary.ativosMonitorados}</p>
        </KpiCard>
        <KpiCard label="Risco de ruptura de estoque" to="/admin/estoque/indicadores">
          <p className={`text-xl font-extrabold ${summary.estoqueCriticos > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {summary.estoqueCriticos} {summary.estoqueCriticos === 1 ? "item crítico" : "itens críticos"}
          </p>
        </KpiCard>
        <KpiCard label="Aportes de sócios no mês" to="/admin/aportes">
          <p className="text-xl font-extrabold text-forest-950">{brl(summary.aportesMes)}</p>
        </KpiCard>
      </div>

      <p className="text-xs text-ink-muted">Atualizado em {new Date(summary.geradoEm).toLocaleString("pt-BR")}</p>
    </div>
  );
}
