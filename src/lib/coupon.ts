import type { Coupon } from "@/types/coupon";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export function calculateDiscount(coupon: Coupon, subtotal: number) {
  const raw = coupon.discountType === "percentage" ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
  return Math.min(Math.max(raw, 0), subtotal);
}
