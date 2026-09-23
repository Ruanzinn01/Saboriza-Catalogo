import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import packageJson from "../../../package.json";
import { AdminState } from "@/components/admin/AdminState";
import { FulfillmentOrderCard } from "@/components/admin/FulfillmentOrderCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/cn";
import { useFulfillmentStore } from "@/store/fulfillment-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";

type Tab = "carregar" | "entregar" | "sobre";

export function CarregaEntregaPage() {
  const [tab, setTab] = useState<Tab>("carregar");
  const loadingQueue = useFulfillmentStore((state) => state.loadingQueue);
  const loadingQueueStatus = useFulfillmentStore((state) => state.loadingQueueStatus);
  const fetchLoadingQueue = useFulfillmentStore((state) => state.fetchLoadingQueue);
  const deliveryQueue = useFulfillmentStore((state) => state.deliveryQueue);
  const deliveryQueueStatus = useFulfillmentStore((state) => state.deliveryQueueStatus);
  const fetchDeliveryQueue = useFulfillmentStore((state) => state.fetchDeliveryQueue);
  const subscribeRealtime = useFulfillmentStore((state) => state.subscribeRealtime);
  const unsubscribeRealtime = useFulfillmentStore((state) => state.unsubscribeRealtime);
  const session = useAdminAuthStore((state) => state.session);

  useEffect(() => {
    fetchLoadingQueue();
    fetchDeliveryQueue();
    subscribeRealtime();
    return () => unsubscribeRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Carrega Entrega" description="Carregamento e entrega dos pedidos faturados." />

      <div className="flex gap-2 rounded-2xl bg-ink-900/5 p-1">
        {(
          [
            { key: "carregar", label: "Carregar" },
            { key: "entregar", label: "Entregar" },
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

      {tab === "carregar" &&
        (loadingQueueStatus === "loading" && loadingQueue.length === 0 ? (
          <AdminState variant="loading" message="Carregando fila..." />
        ) : loadingQueueStatus === "error" ? (
          <AdminState variant="error" message="Não foi possível carregar a fila." onRetry={fetchLoadingQueue} />
        ) : loadingQueue.length === 0 ? (
          <AdminState variant="empty" message="Nenhum pedido faturado aguardando carregamento." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loadingQueue.map((order) => (
              <FulfillmentOrderCard key={order.id} order={order} phase="carregar" />
            ))}
          </div>
        ))}

      {tab === "entregar" &&
        (deliveryQueueStatus === "loading" && deliveryQueue.length === 0 ? (
          <AdminState variant="loading" message="Carregando fila..." />
        ) : deliveryQueueStatus === "error" ? (
          <AdminState variant="error" message="Não foi possível carregar a fila." onRetry={fetchDeliveryQueue} />
        ) : deliveryQueue.length === 0 ? (
          <AdminState variant="empty" message="Nenhum pedido pronto para entrega." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deliveryQueue.map((order) => (
              <FulfillmentOrderCard key={order.id} order={order} phase="entregar" />
            ))}
          </div>
        ))}

      {tab === "sobre" && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-forest-950/10 bg-white p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-950/10 text-forest-950">
            <Truck size={26} />
          </span>
          <h2 className="text-lg font-extrabold text-forest-950">Carrega Entrega</h2>
          <p className="font-mono text-xs text-ink-muted">v{packageJson.version}</p>
          <p className="max-w-sm text-sm text-ink-700/80">
            Ferramenta de carregamento e confirmação de entrega dos pedidos já faturados, integrada ao Saboriza.
          </p>
          <p className="text-xs font-semibold text-ink-muted">Logado como {session?.user.user_metadata?.name || session?.user.email}</p>
        </div>
      )}
    </div>
  );
}
