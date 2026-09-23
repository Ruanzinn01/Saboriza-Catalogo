import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import packageJson from "../../../package.json";
import { AdminState } from "@/components/admin/AdminState";
import { SeparationOrderCard } from "@/components/admin/SeparationOrderCard";
import { SeparationWeeklyDonut } from "@/components/admin/SeparationWeeklyDonut";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/cn";
import { agingLevel, durationLabel } from "@/lib/separation";
import { playAlertBeep } from "@/lib/audio-beep";
import { useSeparationStore } from "@/store/separation-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { AgingLevel } from "@/types/separation";

type Tab = "pendentes" | "historico" | "sobre";

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

const EMPTY_COUNTS: Record<AgingLevel, number> = {
  normal: 0,
  atencao: 0,
  "laranja-claro": 0,
  "laranja-forte": 0,
  vermelho: 0,
  critico: 0,
};

export function SeparaConferePage() {
  const [tab, setTab] = useState<Tab>("pendentes");
  const queue = useSeparationStore((state) => state.queue);
  const queueStatus = useSeparationStore((state) => state.queueStatus);
  const fetchQueue = useSeparationStore((state) => state.fetchQueue);
  const history = useSeparationStore((state) => state.history);
  const historyStatus = useSeparationStore((state) => state.historyStatus);
  const fetchHistory = useSeparationStore((state) => state.fetchHistory);
  const subscribeRealtime = useSeparationStore((state) => state.subscribeRealtime);
  const unsubscribeRealtime = useSeparationStore((state) => state.unsubscribeRealtime);
  const unseenOrderIds = useSeparationStore((state) => state.unseenOrderIds);
  const session = useAdminAuthStore((state) => state.session);

  useEffect(() => {
    fetchQueue();
    subscribeRealtime();
    return () => unsubscribeRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (unseenOrderIds.size === 0) return;
    playAlertBeep();
    const interval = setInterval(playAlertBeep, 4000);
    return () => clearInterval(interval);
  }, [unseenOrderIds.size]);

  useEffect(() => {
    if (tab === "historico" && historyStatus === "idle") fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const orderedQueue = useMemo(
    () => [...queue].sort((a, b) => new Date(a.queuedAt ?? a.createdAt).getTime() - new Date(b.queuedAt ?? b.createdAt).getTime()),
    [queue]
  );

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekCompleted = useMemo(
    () => history.filter((order) => order.status === "COMPLETED" && order.finishedAt && new Date(order.finishedAt) >= weekStart),
    [history, weekStart]
  );
  const weekCounts = useMemo(() => {
    const counts = { ...EMPTY_COUNTS };
    weekCompleted.forEach((order) => {
      if (!order.startedAt || !order.finishedAt) return;
      const durationDays = Math.floor((new Date(order.finishedAt).getTime() - new Date(order.startedAt).getTime()) / (1000 * 60 * 60 * 24));
      counts[agingLevel(durationDays)] += 1;
    });
    return counts;
  }, [weekCompleted]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Separa Confere" description="Separação e conferência física dos pedidos." />

      <div className="flex gap-2 rounded-2xl bg-ink-900/5 p-1">
        {(
          [
            { key: "pendentes", label: "Pendentes" },
            { key: "historico", label: "Histórico" },
            { key: "sobre", label: "Sobre" },
          ] as { key: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "min-h-11 flex-1 rounded-xl text-sm font-bold transition-colors",
              tab === item.key ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted hover:text-ink-900"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "pendentes" && (
        <>
          {queueStatus === "loading" && queue.length === 0 ? (
            <AdminState variant="loading" message="Carregando fila de separação..." />
          ) : queueStatus === "error" ? (
            <AdminState variant="error" message="Não foi possível carregar a fila." onRetry={fetchQueue} />
          ) : orderedQueue.length === 0 ? (
            <AdminState variant="empty" message="Nenhum pedido aguardando separação." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orderedQueue.map((order) => (
                <SeparationOrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "historico" && (
        <div className="flex flex-col gap-4">
          <SeparationWeeklyDonut counts={weekCounts} />

          {historyStatus === "loading" && history.length === 0 ? (
            <AdminState variant="loading" message="Carregando histórico..." />
          ) : historyStatus === "error" ? (
            <AdminState variant="error" message="Não foi possível carregar o histórico." onRetry={fetchHistory} />
          ) : history.length === 0 ? (
            <AdminState variant="empty" message="Nenhuma separação concluída ainda." />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3">Duração</th>
                      <th className="px-4 py-3">Concluído em</th>
                      <th className="px-4 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((order) => (
                      <tr key={order.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                        <td className="px-4 py-3">
                          <Link to={`/admin/separa-confere/${order.id}`} className="font-bold text-forest-950 hover:underline">
                            {order.number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{order.completedBy ?? order.startedBy ?? "-----"}</td>
                        <td className="px-4 py-3 text-ink-muted">{durationLabel(order.startedAt, order.finishedAt)}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {order.finishedAt ? new Date(order.finishedAt).toLocaleString("pt-BR") : "-----"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-bold",
                              order.status === "COMPLETED" ? "bg-forest-950/10 text-forest-950" : "bg-red-100 text-red-700"
                            )}
                          >
                            {order.status === "COMPLETED" ? "Finalizado" : "Cancelado"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 lg:hidden">
                {history.map((order) => (
                  <Link
                    key={order.id}
                    to={`/admin/separa-confere/${order.id}`}
                    className="flex flex-col gap-2 rounded-2xl border border-forest-950/10 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-forest-950">{order.number}</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          order.status === "COMPLETED" ? "bg-forest-950/10 text-forest-950" : "bg-red-100 text-red-700"
                        )}
                      >
                        {order.status === "COMPLETED" ? "Finalizado" : "Cancelado"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-ink-muted">
                      <span>Responsável: {order.completedBy ?? order.startedBy ?? "-----"}</span>
                      <span>Duração: {durationLabel(order.startedAt, order.finishedAt)}</span>
                      <span>Concluído em: {order.finishedAt ? new Date(order.finishedAt).toLocaleString("pt-BR") : "-----"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "sobre" && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-forest-950/10 bg-white p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-950/10 text-forest-950">
            <PackageSearch size={26} />
          </span>
          <h2 className="text-lg font-extrabold text-forest-950">Separa Confere</h2>
          <p className="font-mono text-xs text-ink-muted">v{packageJson.version}</p>
          <p className="max-w-sm text-sm text-ink-700/80">
            Ferramenta de separação e conferência física dos produtos de um pedido, integrada ao Saboriza.
          </p>
          <p className="text-xs font-semibold text-ink-muted">Logado como {session?.user.user_metadata?.name || session?.user.email}</p>
        </div>
      )}
    </div>
  );
}

