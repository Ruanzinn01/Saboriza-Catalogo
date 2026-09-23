import type { Order, OrderStatus } from "@/types/order";

export type OperationalSubstatus = "em_separacao" | "a_faturar" | "em_carregamento" | "entrega" | null;

type SubstatusOrder = Pick<
  Order,
  "status" | "separationResponsible" | "separationFinishedAt" | "loadingResponsible" | "loadingFinishedAt"
>;

// Substatus operacional (separação -> faturamento -> carregamento -> entrega): nunca muda o
// status principal do pedido (fica "Pedido" até faturar, e "Faturado" até finalizar a entrega).
// É só um indicador visual na tela de Pedidos.
export function operationalSubstatus(order: SubstatusOrder): OperationalSubstatus {
  if (order.status === "CONFIRMED") {
    if (order.separationFinishedAt) return "a_faturar";
    if (order.separationResponsible) return "em_separacao";
    return null;
  }
  if (order.status === "COMPLETED") {
    if (order.loadingFinishedAt) return "entrega";
    if (order.loadingResponsible) return "em_carregamento";
    return null;
  }
  return null;
}

export const OPERATIONAL_SUBSTATUS_LABELS: Record<Exclude<OperationalSubstatus, null>, string> = {
  em_separacao: "Em separação",
  a_faturar: "A faturar",
  em_carregamento: "Em carregamento",
  entrega: "Entrega",
};

// "em_*" (trabalho em andamento) usa vermelho pulsante; o resto (pronto pra próxima etapa) usa verde.
export const OPERATIONAL_SUBSTATUS_TONE: Record<Exclude<OperationalSubstatus, null>, "active" | "ready"> = {
  em_separacao: "active",
  a_faturar: "ready",
  em_carregamento: "active",
  entrega: "ready",
};

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "NEW", label: "Novo" },
  { value: "IN_REVIEW", label: "Orçamento" },
  { value: "CONFIRMED", label: "Pedido" },
  { value: "COMPLETED", label: "Faturado" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Novo",
  IN_REVIEW: "Orçamento",
  CONFIRMED: "Pedido",
  COMPLETED: "Faturado",
  FINALIZADO: "Finalizado",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-forest-700/10 text-forest-800",
  IN_REVIEW: "bg-gold-500/20 text-gold-600",
  CONFIRMED: "bg-forest-950/10 text-forest-950",
  COMPLETED: "bg-forest-900 text-cream-50",
  FINALIZADO: "bg-forest-950 text-gold-400",
  CANCELLED: "bg-red-100 text-red-700",
};

export const ORDER_STATUS_BADGE_COLORS: Record<OrderStatus, string> = {
  NEW: "border-forest-700/40 bg-forest-700/10 text-forest-800",
  IN_REVIEW: "border-gold-500/50 bg-gold-500/15 text-gold-700",
  CONFIRMED: "border-[#0e6e3a]/40 bg-[#128C4A] text-cream-50",
  COMPLETED: "border-forest-900/40 bg-forest-900 text-cream-50",
  FINALIZADO: "border-gold-500/50 bg-forest-950 text-gold-400",
  CANCELLED: "border-red-300 bg-red-100 text-red-700",
};

export const ORDER_STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-forest-700",
  IN_REVIEW: "bg-gold-500",
  CONFIRMED: "bg-forest-950",
  COMPLETED: "bg-ink-700",
  FINALIZADO: "bg-gold-500",
  CANCELLED: "bg-red-600",
};

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["FINALIZADO"],
  FINALIZADO: [],
  CANCELLED: [],
};

export interface OrderDayGroup {
  label: string;
  orders: Order[];
}

export function groupOrdersByDay(orders: Order[]): OrderDayGroup[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  function labelFor(date: Date) {
    if (date.toDateString() === today.toDateString()) return "Hoje";
    if (date.toDateString() === yesterday.toDateString()) return "Ontem";
    return `Dia ${date.toLocaleDateString("pt-BR")}`;
  }

  const groups: OrderDayGroup[] = [];
  for (const order of orders) {
    const label = labelFor(new Date(order.createdAt));
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.orders.push(order);
    } else {
      groups.push({ label, orders: [order] });
    }
  }
  return groups;
}
