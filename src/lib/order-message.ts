import type { Order } from "@/types/order";
import { formatCurrency } from "./currency";
import { calculateLineTotal } from "./pricing";

const DIVIDER = "━━━━━━━━━━━━━━━━━━";

export function formatOrderWhatsAppMessage(order: Order) {
  const itemLines = order.items
    .map((item) => {
      const units = item.packs * item.packQuantity;
      const lineTotal = calculateLineTotal(item.unitPrice, item.packQuantity, item.packs);
      return (
        `${item.packs}x Pack ${item.name} (${item.packQuantity} Und/Pack) · ${item.presentation} · ${item.weight}\n` +
        `${units} unidades — ${formatCurrency(lineTotal)}`
      );
    })
    .join("\n\n");

  const totalUnits = order.items.reduce((total, item) => total + item.packs * item.packQuantity, 0);
  const hasDiscount = order.discountAmount > 0;

  return [
    "🏭 *NOVO PEDIDO — SABORIZA*",
    "",
    DIVIDER,
    "",
    "📋 *PEDIDO*",
    "",
    itemLines,
    "",
    DIVIDER,
    "",
    ...(hasDiscount
      ? [
          `💰 *SUBTOTAL: ${formatCurrency(order.subtotal)}*`,
          `🎟️ *CUPOM: ${order.couponCode}*`,
          `🏷️ *DESCONTO: ${formatCurrency(order.discountAmount)}*`,
          "",
        ]
      : []),
    `💰 *TOTAL: ${formatCurrency(order.total)}*`,
    "",
    `📦 *TOTAL DE UNIDADES: ${totalUnits}*`,
    "",
    DIVIDER,
    "",
    "👤 *CLIENTE:*",
    order.customer.name,
    "",
    "🏢 *EMPRESA:*",
    order.customer.company,
    "",
    "📱 *TELEFONE:*",
    order.customer.phone,
    "",
    DIVIDER,
    "",
    "Aguardo a confirmação do pedido.",
  ].join("\n");
}
