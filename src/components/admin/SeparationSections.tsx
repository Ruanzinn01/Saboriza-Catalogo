import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AdminState } from "@/components/admin/AdminState";
import { SeparationOrderCard } from "@/components/admin/SeparationOrderCard";
import { SeparationWeeklyDonut } from "@/components/admin/SeparationWeeklyDonut";
import { cn } from "@/lib/cn";
import { playAlertBeep } from "@/lib/audio-beep";
import { orderPath, useSeparaBase } from "@/lib/separa-base";
import { agingLevel, durationLabel } from "@/lib/separation";
import { useSeparationStore } from "@/store/separation-store";
import type { AgingLevel } from "@/types/separation";

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

/** Fila ao vivo: carrega, assina o realtime e toca o alerta enquanto houver pedido não visto. */
export function useSeparationLive() {
  const fetchQueue = useSeparationStore((state) => state.fetchQueue);
  const subscribeRealtime = useSeparationStore((state) => state.subscribeRealtime);
  const unsubscribeRealtime = useSeparationStore((state) => state.unsubscribeRealtime);
  const unseenOrderIds = useSeparationStore((state) => state.unseenOrderIds);

  useEffect(() => {
    void fetchQueue();
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
}

export function SeparationQueueSection() {
  const queue = useSeparationStore((state) => state.queue);
  const queueStatus = useSeparationStore((state) => state.queueStatus);
  const fetchQueue = useSeparationStore((state) => state.fetchQueue);

  const orderedQueue = useMemo(
    () => [...queue].sort((a, b) => new Date(a.queuedAt ?? a.createdAt).getTime() - new Date(b.queuedAt ?? b.createdAt).getTime()),
    [queue]
  );

  if (queueStatus === "loading" && queue.length === 0) return <AdminState variant="loading" message="Carregando fila de separação..." />;
  if (queueStatus === "error") return <AdminState variant="error" message="Não foi possível carregar a fila." onRetry={fetchQueue} />;
  if (orderedQueue.length === 0) return <AdminState variant="empty" message="Nenhum pedido aguardando separação." />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {orderedQueue.map((order) => (
        <SeparationOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

export function SeparationHistorySection() {
  const base = useSeparaBase();
  const history = useSeparationStore((state) => state.history);
  const historyStatus = useSeparationStore((state) => state.historyStatus);
  const fetchHistory = useSeparationStore((state) => state.fetchHistory);

  useEffect(() => {
    if (historyStatus === "idle") void fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekCounts = useMemo(() => {
    const counts = { ...EMPTY_COUNTS };
    history
      .filter((order) => order.status === "COMPLETED" && order.finishedAt && new Date(order.finishedAt) >= weekStart)
      .forEach((order) => {
        if (!order.startedAt || !order.finishedAt) return;
        const durationDays = Math.floor((new Date(order.finishedAt).getTime() - new Date(order.startedAt).getTime()) / (1000 * 60 * 60 * 24));
        counts[agingLevel(durationDays)] += 1;
      });
    return counts;
  }, [history, weekStart]);

  return (
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
                      <Link to={orderPath(base, order.id)} className="font-bold text-forest-950 hover:underline">
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{order.completedBy ?? order.startedBy ?? "-----"}</td>
                    <td className="px-4 py-3 text-ink-muted">{durationLabel(order.startedAt, order.finishedAt)}</td>
                    <td className="px-4 py-3 text-ink-muted">{order.finishedAt ? new Date(order.finishedAt).toLocaleString("pt-BR") : "-----"}</td>
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
                to={orderPath(base, order.id)}
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
  );
}
