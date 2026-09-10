import { supabase } from "@/lib/supabase";
import { orderFromRow } from "@/lib/mappers/order-mapper";
import type { CartItem } from "@/types/cart";
import type { Order, OrderCustomer } from "@/types/order";
import type { Database } from "@/types/supabase";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type CreateOrderResult = OrderRow & { items: OrderItemRow[] };

export async function submitOrder(
  customer: OrderCustomer,
  items: CartItem[],
  couponCode?: string,
  customerId?: string
): Promise<Order> {
  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: customer.name,
    p_company_name: customer.company,
    p_phone: customer.phone,
    p_items: items.map((item) => ({ product_id: item.productId, packs_quantity: item.packs })),
    p_customer_trade_name: customer.tradeName,
    p_customer_cnpj: customer.cnpj,
    p_customer_ie: customer.ie,
    p_customer_email: customer.email,
    p_customer_address: customer.address,
    p_customer_neighborhood: customer.neighborhood,
    p_customer_cep: customer.cep,
    p_customer_city: customer.city,
    p_customer_state: customer.state,
    p_coupon_code: couponCode ?? "",
    p_customer_id: customerId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar o pedido");
  }

  const result = data as unknown as CreateOrderResult;
  return orderFromRow(result, result.items);
}
