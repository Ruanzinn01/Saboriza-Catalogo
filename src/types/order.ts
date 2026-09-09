import type { CartItem } from "./cart";

export type OrderStatus = "novo" | "em-analise" | "confirmado" | "finalizado" | "cancelado";

export interface OrderCustomer {
  name: string;
  company: string;
  phone: string;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  customer: OrderCustomer;
  items: CartItem[];
  total: number;
  status: OrderStatus;
}
