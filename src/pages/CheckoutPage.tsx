import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/TopBar";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { CouponField } from "@/components/checkout/CouponField";
import { CustomerForm } from "@/components/checkout/CustomerForm";
import { useCartStore } from "@/store/cart-store";
import { useOrdersStore } from "@/store/orders-store";
import { submitOrder } from "@/lib/orders-api";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { formatOrderWhatsAppMessage } from "@/lib/order-message";
import { CONTACT } from "@/config/contact";
import type { OrderCustomer } from "@/types/order";
import type { Coupon } from "@/types/coupon";

export function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const createOrder = useOrdersStore((state) => state.createOrder);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);

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

  async function handleSubmit(customer: OrderCustomer) {
    setSubmitting(true);
    try {
      const order = await submitOrder(customer, items, coupon?.code);
      createOrder(order);
      clearCart();

      navigate(`/pedido-confirmado/${order.id}`, { state: { order } });
      window.location.href = buildWhatsAppLink(CONTACT.whatsappNumber, formatOrderWhatsAppMessage(order));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o pedido");
      setSubmitting(false);
    }
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
        <OrderSummary items={items} coupon={coupon} />
        <CouponField appliedCoupon={coupon} onApply={setCoupon} onRemove={() => setCoupon(null)} />
        <CustomerForm onSubmit={handleSubmit} submitting={submitting} />
      </main>
    </div>
  );
}
