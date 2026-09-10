import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { orderFromRow } from "@/lib/mappers/order-mapper";
import type { Order, OrderCustomer, OrderStatus } from "@/types/order";

interface OrdersState {
  orders: Order[];
  status: "idle" | "loading" | "ready" | "error";
  fetchOrders: () => Promise<void>;
  createOrder: (order: Order) => void;
  updateStatus: (orderId: string, status: OrderStatus) => void;
  updateOrderDetails: (orderId: string, customer: OrderCustomer, paymentTerms: string) => void;
  linkCustomer: (orderId: string, customerId: string) => Promise<boolean>;
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  orders: [],
  status: "idle",

  fetchOrders: async () => {
    set({ status: "loading" });
    const [{ data: orderRows, error: orderError }, { data: itemRows, error: itemError }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("order_items").select("*"),
    ]);

    if (orderError || itemError) {
      toast.error("Não foi possível carregar os pedidos");
      set({ status: "error" });
      return;
    }

    const orders = (orderRows ?? []).map((row) =>
      orderFromRow(
        row,
        (itemRows ?? []).filter((item) => item.order_id === row.id)
      )
    );

    set({ orders, status: "ready" });
  },

  createOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),

  updateStatus: (orderId, status) => {
    const previous = get().orders;
    set((state) => ({
      orders: state.orders.map((order) => (order.id === orderId ? { ...order, status } : order)),
    }));
    const order = previous.find((item) => item.id === orderId);
    supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível atualizar o status do pedido");
          set({ orders: previous });
        } else if (order) {
          toast.success(`Pedido ${order.number} atualizado`);
        }
      });
  },

  updateOrderDetails: (orderId, customer, paymentTerms) => {
    const previous = get().orders;
    set((state) => ({
      orders: state.orders.map((order) => (order.id === orderId ? { ...order, customer, paymentTerms } : order)),
    }));
    supabase
      .from("orders")
      .update({
        customer_trade_name: customer.tradeName,
        customer_cnpj: customer.cnpj,
        customer_ie: customer.ie,
        customer_email: customer.email,
        customer_address: customer.address,
        customer_neighborhood: customer.neighborhood,
        customer_cep: customer.cep,
        customer_city: customer.city,
        customer_state: customer.state,
        payment_terms: paymentTerms,
      })
      .eq("id", orderId)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível atualizar o pedido");
          set({ orders: previous });
        } else {
          toast.success("Pedido atualizado");
        }
      });
  },

  linkCustomer: async (orderId, customerId) => {
    const previous = get().orders;
    const { error } = await supabase.from("orders").update({ customer_id: customerId }).eq("id", orderId);

    if (error) {
      toast.error("Não foi possível vincular o cliente ao pedido");
      return false;
    }

    set({ orders: previous.map((order) => (order.id === orderId ? { ...order, customerId } : order)) });
    return true;
  },
}));
