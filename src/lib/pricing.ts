import type { CartItem } from "@/types/cart";

export function calculateLineTotal(unitPrice: number, packQuantity: number, packs: number) {
  return unitPrice * packQuantity * packs;
}

export function calculateCartTotal(items: CartItem[]) {
  return items.reduce((total, item) => total + calculateLineTotal(item.unitPrice, item.packQuantity, item.packs), 0);
}

export function calculateItemCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.packs, 0);
}
