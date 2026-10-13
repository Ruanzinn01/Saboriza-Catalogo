import { describe, expect, it } from "vitest";
import { accuracy, summarizePosition } from "@/lib/estoque";
import type { StockPositionItem } from "@/types/estoque";

function item(overrides: Partial<StockPositionItem>): StockPositionItem {
  return {
    itemType: "PRODUCT",
    itemId: "i1",
    sku: "SKU-1",
    name: "Item",
    category: "",
    baseUnit: "unidade",
    isActive: true,
    physical: 10,
    reserved: 0,
    available: 10,
    minStock: 0,
    maxStock: 0,
    avgCost: null,
    stockValue: null,
    situation: "OK",
    ...overrides,
  };
}

describe("summarizePosition", () => {
  it("conta situações, soma reservado e valor a custo", () => {
    const summary = summarizePosition([
      item({ situation: "OUT", physical: 0, available: 0 }),
      item({ situation: "LOW", reserved: 4, available: 6 }),
      item({ itemType: "RAW_MATERIAL", avgCost: 5, stockValue: 50, physical: 10 }),
      item({ situation: "OVER" }),
    ]);
    expect(summary).toMatchObject({ total: 4, zeroed: 1, low: 1, over: 1, reservedUnits: 4, valueAtCost: 50 });
  });

  it("não inventa custo: item com saldo e sem custo é contado à parte", () => {
    const summary = summarizePosition([item({ physical: 10, stockValue: null }), item({ physical: 0, stockValue: null, situation: "OUT" })]);
    expect(summary.itemsWithoutCost).toBe(1);
    expect(summary.valueAtCost).toBe(0);
  });
});

describe("accuracy", () => {
  it("é indisponível sem contagens", () => {
    expect(accuracy(0, 0)).toBeNull();
  });

  it("usa primeira contagem sem divergência sobre contados", () => {
    expect(accuracy(62, 5)).toBe(91.9);
    expect(accuracy(10, 0)).toBe(100);
  });
});
