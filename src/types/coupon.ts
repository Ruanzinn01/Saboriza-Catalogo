export type CouponDiscountType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  active: boolean;
}
