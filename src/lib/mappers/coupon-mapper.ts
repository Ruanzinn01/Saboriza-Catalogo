import type { Coupon, CouponDiscountType } from "@/types/coupon";
import type { Database } from "@/types/supabase";

type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];

export function couponFromRow(row: CouponRow): Coupon {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type as CouponDiscountType,
    discountValue: row.discount_value,
    active: row.is_active,
  };
}

export function couponToRow(coupon: Pick<Coupon, "code" | "discountType" | "discountValue" | "active">) {
  return {
    code: coupon.code,
    discount_type: coupon.discountType,
    discount_value: coupon.discountValue,
    is_active: coupon.active,
  };
}
