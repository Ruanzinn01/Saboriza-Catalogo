import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, CheckCircle2, Clock, Inbox, Minus, Wallet } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";
import { useCustomersStore } from "@/store/customers-store";
import { formatCurrency } from "@/lib/currency";
import { buildDailyRevenue } from "@/lib/daily-revenue";
import { cn } from "@/lib/cn";
import { AdminState } from "@/components/admin/AdminState";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { RevenueByDayChart } from "@/components/admin/RevenueByDayChart";

const MONTHS_BACK = 6;
const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const shortMonthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function formatOrderDate(iso: string) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Hoje, ${time}` : `${date.toLocaleDateString("pt-BR")}, ${time}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function buildLastMonths(count: number) {
  const now = new Date();
  const months: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return months;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function ComparisonCard({ label, value, delta }: { label: string; value: string; delta: number }) {
  const isFlat = Math.abs(delta) < 0.5;
  const isUp = delta >= 0;
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;

  return (
    <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-forest-950">{value}</p>
      <div
        className={cn(
          "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
          isFlat ? "bg-ink-900/5 text-ink-700/60" : isUp ? "bg-forest-700/10 text-forest-800" : "bg-red-100 text-red-700"
        )}
      >
        <Icon size={12} />
        {Math.abs(delta).toFixed(0)}% vs mês anterior
      </div>
    </div>
  );
}

export function IndicatorsPage() {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const catalogStatus = useCatalogStore((state) => state.status);
  const orders = useOrdersStore((state) => state.orders);
  const ordersStatus = useOrdersStore((state) => state.status);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const customers = useCustomersStore((state) => state.customers);
  const customersStatus = useCustomersStore((state) => state.status);
  const fetchCustomers = useCustomersStore((state) => state.fetchCustomers);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, [fetchOrders, fetchCustomers]);

  const isLoading = catalogStatus === "loading" || ordersStatus === "loading" || customersStatus === "loading";

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

  const monthlySeries = useMemo(() => {
    const months = buildLastMonths(MONTHS_BACK);
    return months.map((month) => {
      const key = monthKey(month);
      const monthOrders = orders.filter((order) => monthKey(new Date(order.createdAt)) === key);
      const monthCustomers = customers.filter((customer) => monthKey(new Date(customer.createdAt)) === key);
      return {
        label: shortMonthLabelFormatter.format(month),
        revenue: monthOrders.reduce((sum, order) => sum + order.total, 0),
        ordersCount: monthOrders.length,
        newCustomers: monthCustomers.length,
      };
    });
  }, [orders, customers]);

  const current = monthlySeries[monthlySeries.length - 1];
  const previous = monthlySeries[monthlySeries.length - 2];
  const maxRevenue = Math.max(...monthlySeries.map((point) => point.revenue), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Indicadores</h1>
        <p className="text-sm text-ink-700/60">Visão geral e comparativo da operação da Saboriza.</p>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ComparisonCard
              label="Vendas do mês"
              value={formatCurrency(current.revenue)}
              delta={pctChange(current.revenue, previous.revenue)}
            />
            <ComparisonCard label="Pedidos do mês" value={String(current.ordersCount)} delta={pctChange(current.ordersCount, previous.ordersCount)} />
            <ComparisonCard
              label="Novos clientes"
              value={String(current.newCustomers)}
              delta={pctChange(current.newCustomers, previous.newCustomers)}
            />
          </div>

          {hasRevenueThisMonth ? (
            <RevenueByDayChart data={dailyRevenue} monthLabel={monthLabelFormatter.format(now)} />
          ) : (
            <AdminState variant="empty" message="Nenhum faturamento registrado neste mês ainda." />
          )}

          <div className="rounded-3xl border border-forest-950/10 bg-white p-5 sm:p-6">
            <p className="text-sm font-bold text-forest-950">Vendas — últimos {MONTHS_BACK} meses</p>
            <div className="mt-6 flex h-40 items-end gap-3">
              {monthlySeries.map((point, index) => {
                const heightPct = maxRevenue > 0 ? Math.max((point.revenue / maxRevenue) * 100, point.revenue > 0 ? 4 : 0) : 0;
                const isCurrent = index === monthlySeries.length - 1;
                return (
                  <div key={point.label} className="group relative flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end justify-center">
                      <div
                        className={cn("w-6 max-w-[24px] rounded-t-[4px] transition-colors", isCurrent ? "bg-gold-600" : "bg-gold-500/70")}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold uppercase text-ink-700/50">{point.label}</span>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg bg-forest-950 px-2.5 py-1.5 text-xs text-cream-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      <span className="block font-bold">{formatCurrency(point.revenue)}</span>
                      <span className="block text-cream-100/70">{point.ordersCount} pedido(s)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
                    <Link
                      key={order.id}
                      to={`/admin/pedidos/${order.id}`}
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
                    </Link>
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
    </div>
  );
}
