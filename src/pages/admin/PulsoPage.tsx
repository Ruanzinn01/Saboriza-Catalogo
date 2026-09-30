import { useEffect } from "react";
import { Link } from "react-router-dom";
import { usePulsoStore } from "@/store/pulso-store";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EVENT_LABEL: Record<string, string> = {
  pedido: "Novo pedido",
  producao: "Produção confirmada",
};

export function PulsoPage() {
  const summary = usePulsoStore((s) => s.summary);
  const status = usePulsoStore((s) => s.status);
  const fetchSummary = usePulsoStore((s) => s.fetchSummary);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (status === "loading" && !summary) return <AdminState variant="loading" message="Carregando pulso do dia..." />;
  if (status === "error" || !summary) return <AdminState variant="error" message="Não foi possível carregar o pulso do dia." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Pulso</h1>
        <p className="text-sm text-ink-muted">A operação de hoje, em tempo real.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Link to="/admin/pedidos" className="rounded-2xl border border-forest-950/10 bg-white p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Vendas hoje</p>
          <p className="mt-1 text-lg font-extrabold text-forest-950">{brl(summary.vendasHoje)}</p>
        </Link>
        <Link to="/admin/pedidos" className="rounded-2xl border border-forest-950/10 bg-white p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pedidos hoje</p>
          <p className="mt-1 text-lg font-extrabold text-forest-950">{summary.pedidosHoje}</p>
        </Link>
        <Link to="/admin/producao" className="rounded-2xl border border-forest-950/10 bg-white p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Produção hoje</p>
          <p className="mt-1 text-lg font-extrabold text-forest-950">{summary.producaoHoje} un.</p>
        </Link>
        <Link to="/admin/carrega-entrega" className="rounded-2xl border border-forest-950/10 bg-white p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Entregas hoje</p>
          <p className="mt-1 text-lg font-extrabold text-forest-950">{summary.entregasHoje}</p>
        </Link>
        <Link to="/admin/usuarios" className="rounded-2xl border border-forest-950/10 bg-white p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Colaboradores ativos</p>
          <p className="mt-1 text-lg font-extrabold text-forest-950">{summary.colaboradoresAtivos}</p>
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Diário do Pulso</h2>
        {summary.eventos.length === 0 ? (
          <AdminState variant="empty" message="Nenhum acontecimento registrado hoje ainda." />
        ) : (
          <div className="flex flex-col divide-y divide-forest-950/5 rounded-3xl border border-forest-950/10 bg-white">
            {summary.eventos.map((evt, i) => (
              <Link key={i} to={evt.deepLink} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-forest-950/5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{EVENT_LABEL[evt.eventType] ?? evt.eventType}</p>
                  <p className="truncate text-xs text-ink-muted">{evt.subject}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-muted">
                  {new Date(evt.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-ink-muted">Atualizado em {new Date(summary.geradoEm).toLocaleString("pt-BR")}</p>
    </div>
  );
}
