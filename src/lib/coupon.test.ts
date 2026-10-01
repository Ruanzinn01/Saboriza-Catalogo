import { describe, expect, it } from "vitest";
import { calculateDiscount, normalizeCouponCode } from "./coupon";
import type { Coupon } from "@/types/coupon";

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return { id: "c1", code: "PROMO10", discountType: "percentage", discountValue: 10, active: true, ...overrides };
}

describe("normalizeCouponCode", () => {
  it("remove espaços e deixa maiúsculo", () => {
    expect(normalizeCouponCode("  promo10  ")).toBe("PROMO10");
  });
});

describe("calculateDiscount", () => {
  it("calcula desconto percentual", () => {
    expect(calculateDiscount(makeCoupon({ discountType: "percentage", discountValue: 10 }), 200)).toBe(20);
  });

  it("calcula desconto fixo", () => {
    expect(calculateDiscount(makeCoupon({ discountType: "fixed", discountValue: 15 }), 200)).toBe(15);
  });

  it("nunca deixa o desconto passar do subtotal (desconto fixo maior que a compra)", () => {
    expect(calculateDiscount(makeCoupon({ discountType: "fixed", discountValue: 500 }), 200)).toBe(200);
  });

  it("nunca retorna desconto negativo", () => {
    expect(calculateDiscount(makeCoupon({ discountType: "fixed", discountValue: -50 }), 200)).toBe(0);
  });
});
