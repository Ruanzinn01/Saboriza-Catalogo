import { formatCurrency } from "@/lib/currency";
import { useOrdersStore } from "@/store/orders-store";
import type { OrderStatus } from "@/types/order";

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em-analise", label: "Em análise" },
  { value: "confirmado", label: "Confirmado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

const statusColors: Record<OrderStatus, string> = {
  novo: "bg-forest-700/10 text-forest-800",
  "em-analise": "bg-gold-500/20 text-gold-600",
  confirmado: "bg-forest-950/10 text-forest-950",
  finalizado: "bg-forest-900 text-cream-50",
  cancelado: "bg-red-100 text-red-700",
};

export function OrdersPage() {
  const orders = useOrdersStore((state) => state.orders);
  const updateStatus = useOrdersStore((state) => state.updateStatus);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">Pedidos</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-700/60">Nenhum pedido recebido ainda.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-3xl border border-forest-950/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-forest-950">{order.number}</p>
                  <p className="text-xs text-ink-700/60">{new Date(order.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                  className={`rounded-full border-none px-3 py-1.5 text-xs font-bold outline-none ${statusColors[order.status]}`}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-ink-700/70 sm:grid-cols-3">
                <span>
                  <strong className="text-ink-900">Nome:</strong> {order.customer.name}
                </span>
                <span>
                  <strong className="text-ink-900">Empresa:</strong> {order.customer.company}
                </span>
                <span>
                  <strong className="text-ink-900">Telefone:</strong> {order.customer.phone}
                </span>
              </div>
              <div className="mt-3 border-t border-forest-950/5 pt-3">
                {order.items.map((item) => (
                  <p key={item.productId} className="text-xs text-ink-700/70">
                    {item.packs}x pack · {item.name} · {item.presentation} · {item.weight} —{" "}
                    {formatCurrency(item.unitPrice * item.packQuantity * item.packs)}
                  </p>
                ))}
              </div>
              <p className="mt-2 text-right text-base font-extrabold text-forest-950">Total: {formatCurrency(order.total)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
