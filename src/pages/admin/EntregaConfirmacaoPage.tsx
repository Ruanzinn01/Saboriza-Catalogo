import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, FileText, MapPin, Phone, User, Wallet } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { SignaturePad, type SignaturePadHandle } from "@/components/admin/SignaturePad";
import { formatCurrency } from "@/lib/currency";
import { useFulfillmentStore } from "@/store/fulfillment-store";

function ComingSoonCard({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-950/5 text-forest-950">{icon}</span>
        <span className="text-sm font-bold text-ink-900">{title}</span>
      </div>
      <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-[11px] font-bold text-gold-700">Em breve</span>
    </div>
  );
}

export function EntregaConfirmacaoPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const order = useFulfillmentStore((state) => state.currentOrder);
  const orderStatus = useFulfillmentStore((state) => state.currentOrderStatus);
  const fetchOrder = useFulfillmentStore((state) => state.fetchOrder);
  const confirmDelivery = useFulfillmentStore((state) => state.confirmDelivery);

  const signatureRef = useRef<SignaturePadHandle>(null);
  const [confirming, setConfirming] = useState(false);

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

  async function handleConfirm() {
    if (!order || !signatureRef.current) return;
    if (signatureRef.current.isEmpty()) {
      toast.error("Peça pro cliente assinar antes de confirmar");
      return;
    }
    const blob = await signatureRef.current.toBlob();
    if (!blob) {
      toast.error("Não foi possível capturar a assinatura");
      return;
    }
    setConfirming(true);
    const ok = await confirmDelivery(order.id, blob);
    setConfirming(false);
    if (ok) navigate("/admin/carrega-entrega");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Confirmar entrega — Pedido ${order.number}`} back={{ to: "/admin/carrega-entrega", label: "Voltar" }} />

      <div className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
        {(order.address || order.neighborhood || order.city) && (
          <div className="flex items-start gap-2 rounded-2xl border border-forest-950/10 p-3 text-sm text-ink-900">
            <MapPin size={16} className="mt-0.5 shrink-0 text-ink-muted" />
            <div className="flex flex-col">
              {order.address && <span className="font-semibold">{order.address}</span>}
              {(order.neighborhood || order.city) && (
                <span className="text-ink-muted">{[order.neighborhood, order.city].filter(Boolean).join(", ")}</span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-base font-bold text-ink-900">
            <Building2 size={18} className="shrink-0 text-ink-muted" />
            {order.companyName || order.customerName}
          </div>
          <span className="text-lg font-extrabold text-forest-950">{formatCurrency(order.totalAmount)}</span>
        </div>
        {order.customerTradeName && <span className="text-xs text-ink-muted">{order.customerTradeName}</span>}
        {order.customerName && (
          <div className="flex items-center gap-2 text-sm text-ink-700/70">
            <User size={15} className="shrink-0 text-ink-muted" />
            {order.customerName}
          </div>
        )}
        {order.phone && (
          <div className="flex items-center gap-2 text-sm text-ink-700/70">
            <Phone size={15} className="shrink-0 text-ink-muted" />
            {order.phone}
          </div>
        )}
      </div>

      <ComingSoonCard icon={<FileText size={18} />} title="Nota fiscal" />
      <ComingSoonCard icon={<Wallet size={18} />} title="Forma de pagamento" />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Assinatura do responsável</p>
        <SignaturePad ref={signatureRef} />
      </div>

      <Button size="lg" disabled={confirming} onClick={() => void handleConfirm()}>
        {confirming ? "Confirmando..." : "CONFIRMAR ENTREGA"}
      </Button>
    </div>
  );
}
