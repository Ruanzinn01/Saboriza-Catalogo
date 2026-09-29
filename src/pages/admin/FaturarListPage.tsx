import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { useFaturarStore } from "@/store/faturar-store";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FaturarListPage() {
  const orders = useFaturarStore((s) => s.eligibleOrders);
  const status = useFaturarStore((s) => s.listStatus);
  const fetchEligibleOrders = useFaturarStore((s) => s.fetchEligibleOrders);

  useEffect(() => {
    fetchEligibleOrders();
  }, [fetchEligibleOrders]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Faturar</h1>
        <p className="text-sm text-ink-muted">
          Pedidos com separação concluída, aguardando faturamento antes de seguir para Carrega Entrega.
        </p>
      </div>

      {status === "loading" && orders.length === 0 ? (
        <AdminState variant="loading" message="Carregando pedidos..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os pedidos." />
      ) : orders.length === 0 ? (
        <AdminState variant="empty" message="Nenhum pedido aguardando faturamento." />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/admin/faturar/${order.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-forest-950/10 bg-white p-4 hover:bg-forest-950/5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/20 text-gold-700">
                  <Receipt size={18} />
                </span>
                <div>
                  <p className="font-extrabold text-forest-950">Pedido #{order.number}</p>
                  <p className="text-sm text-ink-700/70">{order.customer.company || order.customer.name}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-forest-950">{brl(order.total)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
