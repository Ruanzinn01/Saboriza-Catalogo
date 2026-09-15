import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Search, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { ORDER_STATUS_OPTIONS, groupOrdersByDay } from "@/lib/order-status";
import { useOrdersStore } from "@/store/orders-store";
import { AdminState } from "@/components/admin/AdminState";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Order, OrderStatus } from "@/types/order";

type StatusFilter = "ALL" | OrderStatus;

function formatOrderDate(iso: string) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Hoje, ${time}` : `${date.toLocaleDateString("pt-BR")}, ${time}`;
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Link
      to={`/admin/pedidos/${order.id}`}
      className="flex flex-col overflow-hidden rounded-3xl border border-forest-950/10 bg-white transition-colors hover:border-forest-700/30 hover:bg-forest-950/[0.02]"
    >
      <div className="flex items-center justify-between gap-3 bg-ink-900/5 px-4 py-3 sm:px-5">
        <span className="text-base font-extrabold text-forest-950">{order.number}</span>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Building2 size={15} className="shrink-0 text-ink-700/50" />
          {order.customer.company}
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-700/70">
          <Tag size={15} className="shrink-0 text-ink-700/50" />
          {order.customer.tradeName || order.customer.name}
        </div>
        <span className="text-sm font-bold text-ink-900">{formatCurrency(order.total)}</span>
        <span className="text-xs text-ink-700/60">{formatOrderDate(order.createdAt)}</span>
      </div>
    </Link>
  );
}

export function OrdersPage() {
  const orders = useOrdersStore((state) => state.orders);
  const status = useOrdersStore((state) => state.status);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

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

  const groupedFiltered = useMemo(() => groupOrdersByDay(filtered), [filtered]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Pedidos</h1>
          <p className="text-sm text-ink-700/60">Acompanhe e gerencie os pedidos recebidos.</p>
        </div>
        <Link to="/admin/pedidos/novo">
          <Button className="w-full sm:w-auto">
            <Plus size={18} /> Novo pedido
          </Button>
        </Link>
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
            <div className="flex flex-col gap-6">
              {groupedFiltered.map((group) => (
                <div key={group.label} className="flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-700/60">{group.label}</p>
                  <div className="grid grid-cols-1 gap-3">
                    {group.orders.map((order) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
