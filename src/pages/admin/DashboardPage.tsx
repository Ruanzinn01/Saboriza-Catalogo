import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";
import { formatCurrency } from "@/lib/currency";

export function DashboardPage() {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const orders = useOrdersStore((state) => state.orders);

  const activeProducts = products.filter((product) => product.active).length;
  const newOrders = orders.filter((order) => order.status === "novo").length;
  const totalRevenue = orders.reduce((total, order) => total + order.total, 0);

  const cards = [
    { label: "Pedidos novos", value: newOrders },
    { label: "Total de pedidos", value: orders.length },
    { label: "Produtos ativos", value: `${activeProducts} / ${products.length}` },
    { label: "Categorias", value: categories.length },
    { label: "Faturamento em pedidos", value: formatCurrency(totalRevenue) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-forest-950/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">{card.label}</p>
            <p className="mt-2 text-2xl font-extrabold text-forest-950">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
