import type { Order, OrderStatus } from "@/types/order";

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "NEW", label: "Novo" },
  { value: "IN_REVIEW", label: "Em análise" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "COMPLETED", label: "Finalizado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Novo",
  IN_REVIEW: "Em análise",
  CONFIRMED: "Confirmado",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-forest-700/10 text-forest-800",
  IN_REVIEW: "bg-gold-500/20 text-gold-600",
  CONFIRMED: "bg-forest-950/10 text-forest-950",
  COMPLETED: "bg-forest-900 text-cream-50",
  CANCELLED: "bg-red-100 text-red-700",
};

export const ORDER_STATUS_BADGE_COLORS: Record<OrderStatus, string> = {
  NEW: "border-forest-700/40 bg-forest-700/10 text-forest-800",
  IN_REVIEW: "border-gold-500/50 bg-gold-500/15 text-gold-700",
  CONFIRMED: "border-forest-950/30 bg-forest-950/10 text-forest-950",
  COMPLETED: "border-forest-900/40 bg-forest-900 text-cream-50",
  CANCELLED: "border-red-300 bg-red-100 text-red-700",
};

export const ORDER_STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-forest-700",
  IN_REVIEW: "bg-gold-500",
  CONFIRMED: "bg-forest-950",
  COMPLETED: "bg-ink-700",
  CANCELLED: "bg-red-600",
};

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
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
