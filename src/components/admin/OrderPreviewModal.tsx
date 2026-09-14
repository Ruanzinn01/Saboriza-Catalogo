import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Download, MessageCircle, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/settings-store";
import { generateOrderPdf } from "@/lib/order-pdf";
import { downloadOrderPdf, sendOrderWhatsApp } from "@/lib/order-actions";
import { cn } from "@/lib/cn";
import type { Order } from "@/types/order";

interface OrderPreviewModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

export function OrderPreviewModal({ order, open, onClose }: OrderPreviewModalProps) {
  const settings = useSettingsStore((state) => state.settings);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (!order || !settings) return;

    let cancelled = false;
    setLoading(true);

    generateOrderPdf(order, settings)
      .then((doc) => {
        if (cancelled) return;
        const url = doc.output("bloburl").toString();
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("Não foi possível gerar a visualização do pedido");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, order, settings]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handlePrint() {
    if (!previewUrl) return;
    const printWindow = window.open(previewUrl, "_blank");
    printWindow?.addEventListener("load", () => printWindow.print());
  }

  if (!order) return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-[60] flex items-center justify-center p-4", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-ink-900/50 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-cream-50 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
          <h2 className="text-lg font-bold text-ink-900">Visualizar pedido {order.number}</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900/60 hover:bg-ink-900/5"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-ink-900/10 px-5 py-3">
          <Button type="button" size="sm" variant="outline" onClick={handlePrint} disabled={!previewUrl}>
            <Printer size={16} /> Imprimir
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!settings}
            onClick={() => settings && downloadOrderPdf(order, settings)}
          >
            <Download size={16} /> Baixar PDF
          </Button>
          <Button type="button" size="sm" onClick={() => sendOrderWhatsApp(order, order.customer.phone)}>
            <MessageCircle size={16} /> Enviar por WhatsApp
          </Button>
        </div>

        <div className="flex-1 overflow-hidden bg-ink-900/5">
          {loading || !previewUrl ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-700/60">Gerando visualização...</div>
          ) : (
            <iframe title={`Pedido ${order.number}`} src={previewUrl} className="h-full w-full border-0" />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
