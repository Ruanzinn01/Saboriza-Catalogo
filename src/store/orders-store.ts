import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, OrderStatus } from "@/types/order";

interface OrdersState {
  orders: Order[];
  createOrder: (order: Order) => void;
  updateStatus: (orderId: string, status: OrderStatus) => void;
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      createOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      updateStatus: (orderId, status) =>
        set((state) => ({
          orders: state.orders.map((order) => (order.id === orderId ? { ...order, status } : order)),
        })),
    }),
    { name: "saboriza-orders" }
  )
);
