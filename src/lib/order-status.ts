import type { OrderStatus } from "@/types/order";

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
