import type { CartItem } from "@/types/cart";
import type { Order } from "@/types/order";
import type { Database } from "@/types/supabase";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

export function cartItemFromOrderItemRow(row: OrderItemRow): CartItem {
  return {
    productId: row.product_id ?? "",
    name: row.product_name,
    presentation: row.presentation,
    weight: row.weight_volume,
    imageUrl: "",
    unitPrice: row.unit_price,
    packQuantity: row.pack_quantity,
    packs: row.packs_quantity,
  };
}

export function orderFromRow(row: OrderRow, itemRows: OrderItemRow[]): Order {
  return {
    id: row.id,
    number: row.order_number,
    createdAt: row.created_at,
    customer: {
      name: row.customer_name,
      company: row.company_name,
      phone: row.phone,
      tradeName: row.customer_trade_name,
      cnpj: row.customer_cnpj,
      ie: row.customer_ie,
      email: row.customer_email,
      address: row.customer_address,
      neighborhood: row.customer_neighborhood,
      cep: row.customer_cep,
      city: row.customer_city,
      state: row.customer_state,
    },
    items: itemRows.map(cartItemFromOrderItemRow),
    total: row.total_amount,
    status: row.status,
    paymentTerms: row.payment_terms,
  };
}
