import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { CustomerForm } from "@/components/checkout/CustomerForm";
import { useCartStore } from "@/store/cart-store";
import { useOrdersStore } from "@/store/orders-store";
import { calculateCartTotal } from "@/lib/pricing";
import { generateOrderNumber } from "@/lib/order-number";
import type { OrderCustomer } from "@/types/order";

export function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const orders = useOrdersStore((state) => state.orders);
  const createOrder = useOrdersStore((state) => state.createOrder);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-cream-50">
        <AmbientBackground />
        <div className="relative border-b border-forest-950/10 bg-cream-50">
          <TopBar showCart={false} dark={false} centerLogo />
        </div>
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
          <p className="text-lg font-bold text-ink-900">Seu carrinho está vazio</p>
          <p className="text-sm text-ink-700/60">Volte ao catálogo para adicionar produtos ao seu pedido.</p>
        </div>
      </div>
    );
  }

  function handleSubmit(customer: OrderCustomer) {
    setSubmitting(true);
    const order = {
      id: crypto.randomUUID(),
      number: generateOrderNumber(orders.length + 1),
      createdAt: new Date().toISOString(),
      customer,
      items,
      total: calculateCartTotal(items),
      status: "novo" as const,
    };
    createOrder(order);
    clearCart();
    navigate(`/pedido-confirmado/${order.id}`, { state: { order } });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream-50 pb-16">
      <AmbientBackground />
      <div className="relative border-b border-forest-950/10 bg-cream-50">
        <TopBar showCart={false} dark={false} centerLogo />
      </div>
      <main className="relative mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        <h1 className="w-fit bg-linear-to-r from-forest-950 to-forest-700 bg-clip-text text-2xl font-extrabold text-transparent">
          Finalizar pedido
        </h1>
        <OrderSummary items={items} />
        <CustomerForm onSubmit={handleSubmit} submitting={submitting} />
      </main>
    </div>
  );
}
