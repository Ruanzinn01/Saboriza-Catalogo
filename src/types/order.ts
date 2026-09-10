import type { CartItem } from "./cart";
import type { CouponDiscountType } from "./coupon";

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
  customerId: string | null;
  customer: OrderCustomer;
  items: CartItem[];
  total: number;
  subtotal: number;
  status: OrderStatus;
  paymentTerms: string;
  couponCode: string;
  couponType: CouponDiscountType | "";
  couponValue: number;
  discountAmount: number;
}
