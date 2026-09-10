import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { ORDER_STATUS_OPTIONS } from "@/lib/order-status";
import { useOrdersStore } from "@/store/orders-store";
import { AdminState } from "@/components/admin/AdminState";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderDetailSheet } from "@/components/admin/OrderDetailSheet";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/types/order";

type StatusFilter = "ALL" | OrderStatus;

function formatOrderDate(iso: string) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Hoje, ${time}` : `${date.toLocaleDateString("pt-BR")}, ${time}`;
}

export function OrdersPage() {
  const orders = useOrdersStore((state) => state.orders);
  const status = useOrdersStore((state) => state.status);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
      const matchesQuery =
        !query ||
        order.number.toLowerCase().includes(query) ||
        order.customer.name.toLowerCase().includes(query) ||
        order.customer.company.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [orders, search, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      ALL: orders.length,
      NEW: 0,
      IN_REVIEW: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    orders.forEach((order) => {
      map[order.status] += 1;
    });
    return map;
  }, [orders]);

  const filterTabs: { value: StatusFilter; label: string }[] = [
    { value: "ALL", label: "Todos" },
    ...ORDER_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
  ];

  // "Novo" plural fica estranho ("Novos" já é o rótulo natural pra essa aba)
  const tabLabel = (tab: (typeof filterTabs)[number]) =>
    tab.value === "NEW" ? "Novos" : tab.value === "CONFIRMED" ? "Confirmados" : tab.value === "COMPLETED" ? "Finalizados" : tab.label;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Pedidos</h1>
        <p className="text-sm text-ink-700/60">Acompanhe e gerencie os pedidos recebidos.</p>
      </div>

      {status === "loading" && orders.length === 0 ? (
        <AdminState variant="loading" message="Carregando pedidos..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os pedidos. Tente recarregar a página." />
      ) : orders.length === 0 ? (
        <AdminState variant="empty" message="Nenhum pedido recebido ainda." />
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-700/60">
            {filtered.length} pedido{filtered.length === 1 ? "" : "s"}
          </p>

          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pedido, cliente ou empresa..."
              className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold",
                  statusFilter === tab.value ? "bg-forest-950 text-cream-50" : "bg-forest-950/5 text-ink-700/70 hover:bg-forest-950/10"
                )}
              >
                {tabLabel(tab)} {counts[tab.value]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <AdminState variant="empty" message="Nenhum pedido encontrado com esse filtro." />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-700/50">
                    <tr>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className="cursor-pointer border-b border-forest-950/5 last:border-none hover:bg-forest-950/5"
                      >
                        <td className="px-4 py-3 font-semibold text-ink-900">{order.number}</td>
                        <td className="px-4 py-3 text-ink-700/70">{order.customer.name}</td>
                        <td className="px-4 py-3 text-ink-700/70">{order.customer.company}</td>
                        <td className="px-4 py-3 text-ink-700/70">{formatOrderDate(order.createdAt)}</td>
                        <td className="px-4 py-3 font-semibold text-ink-900">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 lg:hidden">
                {filtered.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className="flex flex-col gap-1 rounded-2xl border border-forest-950/10 bg-white p-4 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-forest-950">{order.number}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-ink-900">{order.customer.name}</p>
                    <p className="text-xs text-ink-700/60">{order.customer.company}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-ink-700/60">
                      <span>{formatOrderDate(order.createdAt)}</span>
                      <span className="text-sm font-bold text-ink-900">{formatCurrency(order.total)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
