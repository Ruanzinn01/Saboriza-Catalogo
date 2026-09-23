import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ImageOff, ScanLine, Undo2 } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { BarcodeScannerModal } from "@/components/admin/BarcodeScannerModal";
import { FulfillmentItemSheet } from "@/components/admin/FulfillmentItemSheet";
import { useFulfillmentStore } from "@/store/fulfillment-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { packsLabel } from "@/lib/separation";
import type { FulfillmentItem } from "@/types/fulfillment";

export function CarregamentoOrderPage() {
  const { orderId } = useParams();

  const order = useFulfillmentStore((state) => state.currentOrder);
  const orderStatus = useFulfillmentStore((state) => state.currentOrderStatus);
  const fetchOrder = useFulfillmentStore((state) => state.fetchOrder);
  const confirmLoadingItem = useFulfillmentStore((state) => state.confirmLoadingItem);
  const undoLoadingItem = useFulfillmentStore((state) => state.undoLoadingItem);
  const requestAdjustment = useFulfillmentStore((state) => state.requestAdjustment);
  const resolveAdjustment = useFulfillmentStore((state) => state.resolveAdjustment);
  const releaseLoading = useFulfillmentStore((state) => state.releaseLoading);
  const operatorName = useAdminAuthStore((state) => state.session?.user.user_metadata?.name || state.session?.user.email);

  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (orderId) fetchOrder(orderId);
  }, [orderId, fetchOrder]);

  if (!order || order.id !== orderId) {
    return orderStatus === "loading" || orderStatus === "idle" ? (
      <AdminState variant="loading" message="Carregando pedido..." />
    ) : (
      <AdminState variant="empty" message="Pedido não encontrado." />
    );
  }

  const loadingDone = Boolean(order.loadingFinishedAt);
  const isMine = order.loadingResponsible === operatorName && !loadingDone;
  const readOnly = !isMine;
  const pendingItems = order.items.filter((item) => !item.loadedAt);
  const loadedItems = order.items.filter((item) => item.loadedAt);

  function handleScan(code: string) {
    setScannerOpen(false);
    const found = order!.items.find((item) => item.code === code || item.gtin === code);
    if (!found) {
      toast.error("Produto não pertence a este pedido");
      return;
    }
    setSelectedItem(found);
  }

  async function handleRelease() {
    if (!order) return;
    await releaseLoading(order.id);
  }

  const description = loadingDone ? "Carregamento concluído — em entrega" : `Faltam ${pendingItems.length} de ${order.items.length} produtos`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Pedido ${order.number}`}
        description={description}
        back={{ to: "/admin/carrega-entrega", label: "Voltar" }}
        actions={
          isMine ? (
            <>
              <Button variant="outline" onClick={() => setScannerOpen(true)}>
                <ScanLine size={16} /> Ler código
              </Button>
              <Button variant="outline" onClick={() => void handleRelease()}>
                Liberar carregamento
              </Button>
            </>
          ) : undefined
        }
      />

      {order.pendingAdjustments.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">Ajustes pendentes — carregamento não termina sozinho até resolver</p>
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
                <span className="shrink-0 text-sm font-bold text-forest-950">{packsLabel(item.packsQuantity, item.packQuantity)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loadedItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Ver carregados</p>
          <div className="flex flex-col gap-2">
            {loadedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-forest-950/10 bg-white p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950/10 text-forest-950">
                  <CheckCircle2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{item.productName}</p>
                  <p className="truncate text-xs text-ink-muted">{packsLabel(item.packsQuantity, item.packQuantity)}</p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => void undoLoadingItem(order.id, item.id)}
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

      <FulfillmentItemSheet
        item={selectedItem}
        readOnly={readOnly}
        onClose={() => setSelectedItem(null)}
        onConfirm={(itemId) => confirmLoadingItem(order.id, itemId)}
        onRequestAdjustment={(itemId, message) => requestAdjustment(order.id, itemId, message)}
      />

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}
