import type { CartItem } from "./cart";

export type OrderStatus = "NEW" | "IN_REVIEW" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export interface OrderCustomer {
  name: string;
  company: string;
  phone: string;
  tradeName: string;
  cnpj: string;
  ie: string;
  email: string;
  address: string;
  neighborhood: string;
  cep: string;
  city: string;
  state: string;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  customer: OrderCustomer;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  paymentTerms: string;
}
