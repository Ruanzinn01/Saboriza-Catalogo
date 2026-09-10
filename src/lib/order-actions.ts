import { toast } from "sonner";
import { formatOrderWhatsAppMessage } from "@/lib/order-message";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { generateOrderPdf } from "@/lib/order-pdf";
import type { Order } from "@/types/order";
import type { Settings } from "@/types/settings";

export function copyOrderText(order: Order) {
  navigator.clipboard.writeText(formatOrderWhatsAppMessage(order));
  toast.success("Comanda copiada");
}

export function sendOrderWhatsApp(order: Order, phone: string) {
  window.open(buildWhatsAppLink(phone, formatOrderWhatsAppMessage(order)), "_blank");
}

export async function downloadOrderPdf(order: Order, settings: Settings) {
  try {
    const doc = await generateOrderPdf(order, settings);
    doc.save(`comanda-pedido-${order.number.replace("#", "")}.pdf`);
    toast.success("Comanda gerada com sucesso.");
  } catch {
    toast.error("Não foi possível gerar a comanda.");
  }
}
