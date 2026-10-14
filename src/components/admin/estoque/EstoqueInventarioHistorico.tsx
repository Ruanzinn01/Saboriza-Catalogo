import { useEffect, useState } from "react";
import { AdminState } from "@/components/admin/AdminState";
import { cn } from "@/lib/cn";
import { accuracy } from "@/lib/estoque";
import { formatDateTime, formatQuantity } from "@/lib/inventory";
import { rpcUntyped } from "@/lib/supabase-rpc";

interface SummaryRow {
  closed_sessions: number;
  open_sessions: number;
  scheduled_sessions: number;
  incomplete_sessions: number;
  last_closed_at: string | null;
  open_divergences: number;
  counted_total: number;
  divergent_total: number;
}

interface HistoryRow {
  id: string;
  unit_name: string;
  modality: "SCHEDULED" | "EXTRAORDINARY";
  scope_kind: string;
  location_label: string;
  status: string;
  starts_at: string;
  closed_at: string | null;
  opened_by_name: string;
  total: number;
  counted: number;
  divergences: number;
  group1_total: number;
  group1_counted: number;
  group2_total: number;
  group2_counted: number;
}

interface DivergenceReportRow {
  session_id: string;
  session_starts_at: string;
  location_label: string;
  group_no: 1 | 2;
  item_name: string;
  sku: string | null;
  round_no: number;
  expected_balance: number;
  base_quantity: number;
  difference: number;
  counted_by_name: string;
  counted_at: string;
  adjustment_status: "NONE" | "APPROVED" | "DISMISSED";
  has_recount: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programado",
  OPEN: "Em andamento",
  CLOSED: "Concluído",
  CLOSED_INCOMPLETE: "Encerrado incompleto",
};

const DECISION_LABEL: Record<DivergenceReportRow["adjustment_status"], string> = {
  NONE: "Aguardando decisão",
  APPROVED: "Ajuste aprovado",
  DISMISSED: "Sem ajuste",
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-forest-950/10 bg-white p-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">{label}</span>
      <span className="text-xl font-extrabold text-forest-950">{value}</span>
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </div>
  );
}

/** Histórico de sessões e relatório de divergências de inventário (as faltas de pedido ficam em relatório próprio no Separa Confere). */
export function EstoqueInventarioHistorico() {
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [sessions, setSessions] = useState<HistoryRow[]>([]);
  const [divergences, setDivergences] = useState<DivergenceReportRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setStatus("loading");
    const [summaryResult, historyResult, divergenceResult] = await Promise.all([
      rpcUntyped("inventory_history_summary"),
      rpcUntyped("inventory_sessions_history"),
      rpcUntyped("inventory_divergence_report", { p_from: from || null, p_to: to || null }),
    ]);
    const failure = summaryResult.error ?? historyResult.error ?? divergenceResult.error;
    if (failure) {
      setMessage(failure.message);
      setStatus("error");
      return;
    }
    setSummary(((summaryResult.data as SummaryRow[] | null) ?? [])[0] ?? null);
    setSessions((historyResult.data as HistoryRow[] | null) ?? []);
    setDivergences((divergenceResult.data as DivergenceReportRow[] | null) ?? []);
    setStatus("ready");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  if (status === "loading" && !summary) return <AdminState variant="loading" message="Carregando histórico de inventários..." />;
  if (status === "error") return <AdminState variant="error" message={message || "Não foi possível carregar o histórico."} onRetry={() => void load()} />;
  if (!summary) return null;

  const rate = accuracy(summary.counted_total, summary.divergent_total);

  return (
    <section className="flex flex-col gap-4" aria-label="Histórico de inventários">
      <h3 className="text-lg font-extrabold text-forest-950">Histórico de inventários</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Concluídos" value={String(summary.closed_sessions)} hint={summary.incomplete_sessions > 0 ? `${summary.incomplete_sessions} encerrados incompletos` : undefined} />
        <Metric label="Em andamento" value={String(summary.open_sessions)} hint={summary.scheduled_sessions > 0 ? `${summary.scheduled_sessions} programados` : undefined} />
        <Metric label="Último concluído" value={summary.last_closed_at ? formatDateTime(summary.last_closed_at) : "Ainda sem dados"} />
        <Metric label="Acuracidade" value={rate === null ? "Ainda sem dados" : `${rate.toLocaleString("pt-BR")}%`} hint={`${summary.divergent_total} divergentes em ${summary.counted_total} contados · ${summary.open_divergences} abertas`} />
      </div>

      {sessions.length === 0 ? (
        <AdminState variant="empty" message="Nenhum inventário realizado ainda." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Modalidade</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Produtos</th>
                <th className="px-4 py-3 text-right">Matérias-primas e insumos</th>
                <th className="px-4 py-3 text-right">Divergências</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr key={row.id} className="border-b border-forest-950/5 last:border-none">
                  <td className="px-4 py-3 text-ink-muted">{formatDateTime(row.starts_at)}</td>
                  <td className="px-4 py-3">{row.modality === "SCHEDULED" ? "Programado" : "Imediato"}</td>
                  <td className="px-4 py-3 text-ink-muted">{row.opened_by_name || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{[row.unit_name, row.location_label].filter(Boolean).join(" · ")}</td>
                  <td className="px-4 py-3 font-semibold">{STATUS_LABEL[row.status] ?? row.status}</td>
                  <td className="px-4 py-3 text-right font-mono">{row.group1_counted}/{row.group1_total}</td>
                  <td className="px-4 py-3 text-right font-mono">{row.group2_counted}/{row.group2_total}</td>
                  <td className="px-4 py-3 text-right font-mono">{row.divergences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-lg font-extrabold text-forest-950">Divergências de inventário</h3>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
          <label className="flex flex-col gap-1">
            De
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900" />
          </label>
          <label className="flex flex-col gap-1">
            Até
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900" />
          </label>
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        Diferenças de contagem física. Não incluem faltas na separação de pedidos e não são perda confirmada antes da decisão do Estoque.
      </p>
      {divergences.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma divergência no período." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Contagem</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Grupo</th>
                <th className="px-4 py-3 text-right">Saldo fotografado</th>
                <th className="px-4 py-3 text-right">Contado</th>
                <th className="px-4 py-3 text-right">Diferença</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Decisão</th>
              </tr>
            </thead>
            <tbody>
              {divergences.map((row) => (
                <tr key={`${row.session_id}-${row.item_name}-${row.round_no}`} className="border-b border-forest-950/5 last:border-none">
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDateTime(row.counted_at)} · rodada {row.round_no}
                    {row.has_recount ? " · recontado" : ""}
                  </td>
                  <td className="px-4 py-3 font-bold text-ink-900">
                    {row.item_name} <span className="font-mono text-[11px] font-normal text-ink-muted">{row.sku}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.group_no === 1 ? "Produtos" : "Matérias-primas e insumos"}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatQuantity(row.expected_balance)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatQuantity(row.base_quantity)}</td>
                  <td className={cn("px-4 py-3 text-right font-mono font-bold", row.difference < 0 ? "text-red-700" : "text-forest-950")}>
                    {row.difference > 0 ? "+" : ""}
                    {formatQuantity(row.difference)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.counted_by_name}</td>
                  <td className="px-4 py-3">{DECISION_LABEL[row.adjustment_status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
