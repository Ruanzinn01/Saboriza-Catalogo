import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Inbox, Wallet } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";
import { formatCurrency } from "@/lib/currency";
import { buildDailyRevenue } from "@/lib/daily-revenue";
import { AdminState } from "@/components/admin/AdminState";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderDetailSheet } from "@/components/admin/OrderDetailSheet";
import { RevenueByDayChart } from "@/components/admin/RevenueByDayChart";

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function formatOrderDate(iso: string) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Hoje, ${time}` : `${date.toLocaleDateString("pt-BR")}, ${time}`;
}

export function DashboardPage() {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const catalogStatus = useCatalogStore((state) => state.status);
  const orders = useOrdersStore((state) => state.orders);
  const ordersStatus = useOrdersStore((state) => state.status);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const isLoading = catalogStatus === "loading" || ordersStatus === "loading";

  const activeProducts = products.filter((product) => product.active).length;
  const newOrders = orders.filter((order) => order.status === "NEW").length;
  const inReviewOrders = orders.filter((order) => order.status === "IN_REVIEW").length;
  const confirmedOrders = orders.filter((order) => order.status === "CONFIRMED").length;

  const now = new Date();
  const ordersThisMonth = orders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
  });
  const monthlySales = ordersThisMonth.reduce((total, order) => total + order.total, 0);

  const dailyRevenue = useMemo(() => buildDailyRevenue(orders), [orders]);
  const hasRevenueThisMonth = dailyRevenue.some((point) => point.amount > 0);

  const topProducts = useMemo(() => {
    const tally = new Map<string, number>();
    ordersThisMonth.forEach((order) => {
      order.items.forEach((item) => {
        const units = item.packs * item.packQuantity;
        tally.set(item.name, (tally.get(item.name) ?? 0) + units);
      });
    });
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);
  const topProductsMax = topProducts[0]?.[1] ?? 0;

  const cards = [
    { label: "Novos pedidos", value: newOrders, icon: Inbox },
    { label: "Em análise", value: inReviewOrders, icon: Clock },
    { label: "Confirmados", value: confirmedOrders, icon: CheckCircle2 },
    { label: "Vendas do mês", value: formatCurrency(monthlySales), icon: Wallet },
  ];

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Dashboard</h1>
        <p className="text-sm text-ink-700/60">Visão geral da operação da Saboriza.</p>
      </div>

      {isLoading ? (
        <AdminState variant="loading" message="Carregando indicadores..." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="flex items-start justify-between gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">{card.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-forest-950">{card.value}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
                  <card.icon size={18} />
                </span>
              </div>
            ))}
          </div>

          {hasRevenueThisMonth ? (
            <RevenueByDayChart data={dailyRevenue} monthLabel={monthLabelFormatter.format(now)} />
          ) : (
            <AdminState variant="empty" message="Nenhum faturamento registrado neste mês ainda." />
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-700/50">Pedidos recentes</p>
              {recentOrders.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm font-semibold text-ink-900">Você ainda não recebeu pedidos.</p>
                  <p className="mt-1 text-xs text-ink-700/60">Quando um pedido chegar, ele aparecerá aqui.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-forest-950/10 p-3 text-left transition-colors hover:border-forest-700/30 hover:bg-forest-950/[0.02]"
                    >
                      <div>
                        <p className="text-sm font-bold text-ink-900">{order.number}</p>
                        <p className="text-xs text-ink-700/60">
                          {order.customer.name} · {order.customer.company}
                        </p>
                        <p className="text-xs text-ink-700/50">{formatOrderDate(order.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold text-ink-900">{formatCurrency(order.total)}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-700/50">Resumo</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-700/70">Produtos ativos</span>
                    <span className="text-sm font-bold text-ink-900">{activeProducts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-700/70">Categorias</span>
                    <span className="text-sm font-bold text-ink-900">{categories.length}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-700/50">Produtos mais vendidos no mês</p>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-ink-700/60">Nenhuma venda registrada neste mês ainda.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topProducts.map(([name, units]) => (
                      <div key={name}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-ink-900">
                          <span className="truncate">{name}</span>
                          <span className="shrink-0 text-ink-700/60">{units}x</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-forest-950/5">
                          <div
                            className="h-full rounded-full bg-gold-500"
                            style={{ width: `${Math.max((units / topProductsMax) * 100, 6)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
