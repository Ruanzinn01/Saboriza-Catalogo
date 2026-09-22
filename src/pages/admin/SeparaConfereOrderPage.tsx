import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ImageOff, ScanLine, Undo2 } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { BarcodeScannerModal } from "@/components/admin/BarcodeScannerModal";
import { SeparationItemSheet } from "@/components/admin/SeparationItemSheet";
import { useSeparationStore } from "@/store/separation-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import type { SeparationItem } from "@/types/separation";

export function SeparaConfereOrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const queue = useSeparationStore((state) => state.queue);
  const queueStatus = useSeparationStore((state) => state.queueStatus);
  const fetchQueue = useSeparationStore((state) => state.fetchQueue);
  const history = useSeparationStore((state) => state.history);
  const historyStatus = useSeparationStore((state) => state.historyStatus);
  const fetchHistory = useSeparationStore((state) => state.fetchHistory);
  const confirmItem = useSeparationStore((state) => state.confirmItem);
  const undoItem = useSeparationStore((state) => state.undoItem);
  const requestAdjustment = useSeparationStore((state) => state.requestAdjustment);
  const resolveAdjustment = useSeparationStore((state) => state.resolveAdjustment);
  const finalizeOrder = useSeparationStore((state) => state.finalizeOrder);
  const releaseOrder = useSeparationStore((state) => state.releaseOrder);
  const operatorName = useAdminAuthStore((state) => state.session?.user.user_metadata?.name || state.session?.user.email);

  const [selectedItem, setSelectedItem] = useState<SeparationItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const order = useMemo(() => queue.find((o) => o.id === orderId) ?? history.find((o) => o.id === orderId), [queue, history, orderId]);

  useEffect(() => {
    if (order) return;
    if (queueStatus === "idle") fetchQueue();
    if (historyStatus === "idle") fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  if (!order) {
    const stillLoading = queueStatus === "loading" || historyStatus === "loading" || queueStatus === "idle" || historyStatus === "idle";
    return stillLoading ? (
      <AdminState variant="loading" message="Carregando pedido..." />
    ) : (
      <AdminState variant="empty" message="Pedido não encontrado." />
    );
  }

  const isMine = order.status === "CONFIRMED" && order.responsible === operatorName;
  const readOnly = !isMine;
  const pendingItems = order.items.filter((item) => !item.separatedAt);
  const separatedItems = order.items.filter((item) => item.separatedAt);
  const canFinalize = isMine && pendingItems.length === 0 && order.pendingAdjustments.length === 0;

  function handleScan(code: string) {
    setScannerOpen(false);
    const found = order!.items.find((item) => item.code === code || item.gtin === code);
    if (!found) {
      toast.error("Produto não pertence a este pedido");
      return;
    }
    setSelectedItem(found);
  }

  async function handleFinalize() {
    if (!order) return;
    setFinalizing(true);
    const ok = await finalizeOrder(order.id);
    setFinalizing(false);
    if (ok) navigate("/admin/separa-confere");
  }

  async function handleRelease() {
    if (!order) return;
    await releaseOrder(order.id);
    navigate("/admin/separa-confere");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Pedido ${order.number}`}
        description={
          order.status === "CONFIRMED"
            ? `Faltam ${pendingItems.length} de ${order.items.length} produtos`
            : order.status === "COMPLETED"
              ? "Conferência finalizada"
              : "Pedido cancelado"
        }
        back={{ to: "/admin/separa-confere", label: "Voltar" }}
        actions={
          isMine ? (
            <>
              <Button variant="outline" onClick={() => setScannerOpen(true)}>
                <ScanLine size={16} /> Ler código
              </Button>
              <Button variant="outline" onClick={() => void handleRelease()}>
                Liberar separação
              </Button>
              <Button disabled={!canFinalize || finalizing} onClick={() => void handleFinalize()}>
                {finalizing ? "Finalizando..." : "FINALIZAR CONFERÊNCIA"}
              </Button>
            </>
          ) : undefined
        }
      />

      {order.pendingAdjustments.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">Ajustes pendentes — finalização bloqueada</p>
          {order.pendingAdjustments.map((adjustment) => (
            <div key={adjustment.id} className="flex items-center justify-between gap-3">
              <p className="text-sm text-red-700/90">{adjustment.message}</p>
              {isMine && (
                <button
                  onClick={() => void resolveAdjustment(adjustment.id)}
                  className="shrink-0 rounded-xl border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Marcar como resolvido
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Pendentes</p>
          <div className="flex flex-col gap-2">
            {pendingItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                disabled={readOnly}
                className="flex items-center gap-3 rounded-2xl border border-forest-950/10 bg-white p-3 text-left transition-colors hover:border-forest-700/30 hover:bg-forest-950/[0.02] disabled:pointer-events-none"
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.productName} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-900/5 text-ink-muted">
                    <ImageOff size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{item.productName}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {item.presentation} · {item.weightVolume}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-forest-950">{item.totalUnits} un</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {separatedItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Ver separados</p>
          <div className="flex flex-col gap-2">
            {separatedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-forest-950/10 bg-white p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950/10 text-forest-950">
                  <CheckCircle2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{item.productName}</p>
                  <p className="truncate text-xs text-ink-muted">{item.totalUnits} un</p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => void undoItem(order.id, item.id)}
                    className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-ink-muted hover:bg-ink-900/5"
                  >
                    <Undo2 size={14} /> Desfazer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <SeparationItemSheet
        item={selectedItem}
        readOnly={readOnly}
        onClose={() => setSelectedItem(null)}
        onConfirm={(itemId) => confirmItem(order.id, itemId)}
        onRequestAdjustment={(itemId, message) => requestAdjustment(order.id, itemId, message)}
      />

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}

