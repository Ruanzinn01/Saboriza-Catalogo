import { ORDER_STATUS_BADGE_COLORS, ORDER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus } from "@/types/order";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${ORDER_STATUS_BADGE_COLORS[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
