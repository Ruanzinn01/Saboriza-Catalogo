import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Button } from "@/components/ui/Button";
import { useOrdersStore } from "@/store/orders-store";
import { formatCurrency } from "@/lib/currency";
import { formatOrderWhatsAppMessage } from "@/lib/order-message";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { CONTACT } from "@/config/contact";
import type { Order } from "@/types/order";

export function OrderConfirmedPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const orderFromState = (location.state as { order?: Order } | null)?.order;
  const orderFromStore = useOrdersStore((state) => state.orders.find((order) => order.id === orderId));
  const order = orderFromState ?? orderFromStore;

  if (!order) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-cream-50">
        <AmbientBackground />
        <div className="relative border-b border-forest-950/10 bg-cream-50">
          <TopBar showCart={false} dark={false} centerLogo />
        </div>
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
          <p className="text-lg font-bold text-ink-900">Pedido não encontrado</p>
          <Link to="/" className="text-sm font-semibold text-forest-800 underline">
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream-50 pb-16">
      <AmbientBackground />
      <div className="relative border-b border-forest-950/10 bg-cream-50">
        <TopBar showCart={false} dark={false} centerLogo />
      </div>
      <main className="relative mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <CheckCircle2 size={56} className="text-forest-700" />
        <h1 className="text-2xl font-extrabold text-forest-950">Pedido {order.number} recebido!</h1>
        <p className="text-sm text-ink-700/70">
          Obrigado, {order.customer.name}. Recebemos seu pedido para {order.customer.company} e entraremos em contato pelo
          telefone {order.customer.phone} em breve.
        </p>
        <div className="mt-2 w-full rounded-3xl border border-forest-950/10 bg-white p-5 text-left">
          <p className="mb-2 text-sm font-bold text-ink-900">Resumo</p>
          {order.items.map((item) => (
            <p key={item.productId} className="text-xs text-ink-700/70">
              {item.packs}x pack · {item.name} · {item.presentation} · {item.weight}
            </p>
          ))}
          <p className="mt-3 text-base font-extrabold text-forest-950">Total: {formatCurrency(order.total)}</p>
        </div>
        <a
          href={buildWhatsAppLink(CONTACT.whatsappNumber, formatOrderWhatsAppMessage(order))}
          target="_blank"
          rel="noreferrer"
          className="w-full"
        >
          <Button className="w-full" size="lg">
            <MessageCircle size={18} /> Reenviar pedido no WhatsApp
          </Button>
        </a>
        <Link to="/" className="w-full">
          <Button className="w-full" size="lg" variant="secondary">
            Voltar ao catálogo
          </Button>
        </Link>
      </main>
    </div>
  );
}
