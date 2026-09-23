import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/currency";
import { useFulfillmentStore } from "@/store/fulfillment-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function CarregamentoOrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const order = useFulfillmentStore((state) => state.currentOrder);
  const orderStatus = useFulfillmentStore((state) => state.currentOrderStatus);
  const fetchOrder = useFulfillmentStore((state) => state.fetchOrder);
  const finishLoading = useFulfillmentStore((state) => state.finishLoading);
  const operatorName = useAdminAuthStore((state) => state.session?.user.user_metadata?.name || state.session?.user.email);

  const [finishing, setFinishing] = useState(false);

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

  const isMine = order.loadingResponsible === operatorName && !order.loadingFinishedAt;

  async function handleFinish() {
    if (!order) return;
    setFinishing(true);
    await finishLoading(order.id);
    setFinishing(false);
    navigate("/admin/carrega-entrega");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Pedido ${order.number}`}
        description={order.loadingFinishedAt ? "Carregamento finalizado" : "Carregando mercadoria"}
        back={{ to: "/admin/carrega-entrega", label: "Voltar" }}
      />

      <div className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
        <div className="flex items-center gap-2 text-base font-bold text-ink-900">
          <Building2 size={18} className="shrink-0 text-ink-muted" />
          {order.companyName || order.customerName}
        </div>
        <span className="text-lg font-extrabold text-forest-950">{formatCurrency(order.totalAmount)}</span>
      </div>

      {isMine && (
        <Button size="lg" disabled={finishing} onClick={() => void handleFinish()}>
          {finishing ? "Finalizando..." : "Finalizar carregamento"}
        </Button>
      )}
    </div>
  );
}
