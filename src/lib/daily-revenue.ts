import type { Order } from "@/types/order";

export interface DailyRevenuePoint {
  day: number;
  date: Date;
  amount: number;
}

export function buildDailyRevenue(orders: Order[], reference = new Date()): DailyRevenuePoint[] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const points: DailyRevenuePoint[] = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    date: new Date(year, month, index + 1),
    amount: 0,
  }));

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    if (createdAt.getFullYear() === year && createdAt.getMonth() === month) {
      points[createdAt.getDate() - 1].amount += order.total;
    }
  }

  return points;
}
