import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomerPicker } from "@/components/admin/CustomerPicker";
import { CouponField } from "@/components/checkout/CouponField";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { formatCurrency } from "@/lib/currency";
import { formatProductTitle } from "@/lib/product-title";
import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";
import { submitOrder } from "@/lib/orders-api";
import type { CartItem } from "@/types/cart";
import type { Coupon } from "@/types/coupon";
import type { Customer } from "@/types/customer";
import type { OrderCustomer } from "@/types/order";
import type { Product } from "@/types/product";

function customerToOrderCustomer(customer: Customer): OrderCustomer {
  return {
    name: customer.name,
    company: customer.companyName,
    phone: customer.phone,
    tradeName: customer.tradeName,
    cnpj: customer.cnpj,
    ie: customer.ie,
    email: customer.email,
    address: customer.address,
    neighborhood: customer.neighborhood,
    cep: customer.cep,
    city: customer.city,
    state: customer.state,
  };
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const createOrder = useOrdersStore((state) => state.createOrder);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  function addItem(product: Product) {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => (item.productId === product.id ? { ...item, packs: item.packs + 1 } : item));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          presentation: product.presentation,
          weight: product.weight,
          imageUrl: product.imageUrl,
          unitPrice: product.unitPrice,
          packQuantity: product.packQuantity,
          packs: 1,
        },
      ];
    });
  }

  function increaseItem(productId: string) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, packs: item.packs + 1 } : item)));
  }

  function decreaseItem(productId: string) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, packs: item.packs - 1 } : item)).filter((item) => item.packs > 0));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  const filteredProducts = useMemo(
    () => products.filter((product) => product.active && (!categoryFilter || product.categoryId === categoryFilter)),
    [products, categoryFilter]
  );

  async function handleCreateOrder() {
    if (!selectedCustomer) {
      toast.error("Selecione ou cadastre um cliente");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione ao menos um produto");
      return;
    }

    setSubmitting(true);
    try {
      const order = await submitOrder(customerToOrderCustomer(selectedCustomer), items, coupon?.code, selectedCustomer.id);
      createOrder(order);
      toast.success(`Pedido ${order.number} criado`);
      navigate("/admin/pedidos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/pedidos" className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para Pedidos
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Novo pedido</h1>
        <p className="text-sm text-ink-700/60">Crie um pedido manualmente selecionando um cliente já cadastrado.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">1. Cliente</p>
        <CustomerPicker selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} onClear={() => setSelectedCustomer(null)} />
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">2. Produtos</p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter("")}
            className={
              !categoryFilter
                ? "rounded-full bg-forest-950 px-3 py-1.5 text-xs font-bold text-cream-50"
                : "rounded-full bg-forest-950/5 px-3 py-1.5 text-xs font-bold text-ink-700/70 hover:bg-forest-950/10"
            }
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryFilter(category.id)}
              className={
                categoryFilter === category.id
                  ? "rounded-full bg-forest-950 px-3 py-1.5 text-xs font-bold text-cream-50"
                  : "rounded-full bg-forest-950/5 px-3 py-1.5 text-xs font-bold text-ink-700/70 hover:bg-forest-950/10"
              }
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addItem(product)}
              className="flex flex-col gap-1 rounded-2xl border border-forest-950/10 bg-white p-4 text-left hover:border-forest-700/40"
            >
              <p className="text-sm font-bold text-ink-900">{formatProductTitle(product)}</p>
              <p className="text-xs text-ink-700/60">Pack de {product.packQuantity} un</p>
              <p className="text-sm font-extrabold text-forest-900">{formatCurrency(product.unitPrice)}/unid</p>
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <div className="flex flex-col divide-y divide-forest-950/5 rounded-2xl border border-forest-950/10">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-700/60">
                    {item.presentation} · {item.weight}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => decreaseItem(item.productId)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/15 text-ink-900 hover:bg-ink-900/5"
                    aria-label="Diminuir"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-ink-900">{item.packs}</span>
                  <button
                    onClick={() => increaseItem(item.productId)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/15 text-ink-900 hover:bg-ink-900/5"
                    aria-label="Aumentar"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                    aria-label="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">3. Cupom (opcional)</p>
        <CouponField appliedCoupon={coupon} onApply={setCoupon} onRemove={() => setCoupon(null)} />
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">4. Revisão</p>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-forest-950/10 bg-white p-6 text-sm text-ink-700/60">
            Adicione produtos para ver o resumo do pedido.
          </p>
        ) : (
          <OrderSummary items={items} coupon={coupon} />
        )}
      </section>

      <Button size="lg" disabled={submitting} onClick={() => void handleCreateOrder()}>
        {submitting ? "Criando pedido..." : "Criar pedido"}
      </Button>
    </div>
  );
}
