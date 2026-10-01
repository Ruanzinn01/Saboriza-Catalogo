import { describe, expect, it } from "vitest";
import { calculateCartTotal, calculateItemCount, calculateLineTotal } from "./pricing";
import type { CartItem } from "@/types/cart";

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "p1",
    name: "Tempero Teste",
    presentation: "Pote",
    weight: "500g",
    imageUrl: "",
    unitPrice: 10,
    packQuantity: 12,
    packs: 1,
    ...overrides,
  };
}

describe("calculateLineTotal", () => {
  it("multiplica preço unitário × quantidade no pack × packs", () => {
    expect(calculateLineTotal(10, 12, 2)).toBe(240);
  });
});

describe("calculateCartTotal", () => {
  it("soma o total de várias linhas", () => {
    const items = [makeItem({ unitPrice: 10, packQuantity: 12, packs: 1 }), makeItem({ unitPrice: 5, packQuantity: 6, packs: 3 })];
    expect(calculateCartTotal(items)).toBe(10 * 12 * 1 + 5 * 6 * 3);
  });

  it("retorna 0 pro carrinho vazio", () => {
    expect(calculateCartTotal([])).toBe(0);
  });
});

describe("calculateItemCount", () => {
  it("soma os packs de todas as linhas (não unidades)", () => {
    const items = [makeItem({ packs: 2 }), makeItem({ packs: 3 })];
    expect(calculateItemCount(items)).toBe(5);
  });
});
