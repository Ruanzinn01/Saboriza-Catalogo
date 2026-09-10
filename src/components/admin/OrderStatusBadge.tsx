import { ORDER_STATUS_DOT_COLORS, ORDER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus } from "@/types/order";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-900">
      <span className={`h-2 w-2 rounded-full ${ORDER_STATUS_DOT_COLORS[status]}`} aria-hidden />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
