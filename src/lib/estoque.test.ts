import { describe, expect, it } from "vitest";
import { accuracy, healthRangeNote, summarizePosition } from "@/lib/estoque";
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
    incoming: 0,
    inProduction: 0,
    minStock: 0,
    maxStock: 0,
    dailyRate: null,
    historyDays: 90,
    coverageDays: null,
    netNeed: null,
    unitCost: null,
    stockValue: null,
    excessQty: 0,
    excessValue: 0,
    idleDays: null,
    health: "HEALTHY",
    policyMin: 30,
    policyIdeal: 45,
    policyMax: 60,
    ...overrides,
  };
}

describe("summarizePosition", () => {
  it("conta faixas de saúde, reservado, valor a custo e excesso", () => {
    const summary = summarizePosition([
      item({ health: "ZERO", physical: 0, available: 0 }),
      item({ health: "LOW", reserved: 4, available: 6 }),
      item({ itemType: "RAW_MATERIAL", unitCost: 5, stockValue: 50, physical: 10 }),
      item({ health: "EXCESS", excessQty: 3, excessValue: 12 }),
    ]);
    expect(summary).toMatchObject({ total: 4, reservedUnits: 4, valueAtCost: 50, excessItems: 1, excessValue: 12 });
    expect(summary.byHealth).toMatchObject({ ZERO: 1, LOW: 1, HEALTHY: 1, EXCESS: 1 });
  });

  it("não inventa custo: item com saldo e sem custo é contado à parte", () => {
    const summary = summarizePosition([item({ physical: 10, stockValue: null }), item({ physical: 0, stockValue: null, health: "ZERO" })]);
    expect(summary.itemsWithoutCost).toBe(1);
    expect(summary.valueAtCost).toBe(0);
  });

  it("capital sem giro só conta saldo parado há 90+ dias", () => {
    const summary = summarizePosition([
      item({ idleDays: 120, stockValue: 100 }),
      item({ idleDays: 30, stockValue: 500 }),
      item({ idleDays: null, stockValue: 700 }),
    ]);
    expect(summary).toMatchObject({ idleItems: 1, idleValue: 100 });
  });

  it("sem demanda não gera necessidade de reposição estimada", () => {
    const summary = summarizePosition([item({ dailyRate: null, netNeed: null, unitCost: 5 }), item({ dailyRate: 2, netNeed: 10, unitCost: 5 })]);
    expect(summary.netNeedValue).toBe(50);
    expect(summary.withoutDemand).toBe(1);
  });
});

describe("healthRangeNote", () => {
  it("usa a política vigente nas faixas", () => {
    const policy = { min: 30, ideal: 45, max: 60 };
    expect(healthRangeNote("CRITICAL", policy)).toBe("Abaixo de 15 dias");
    expect(healthRangeNote("LOW", policy)).toBe("15 até abaixo de 30 dias");
    expect(healthRangeNote("HEALTHY", policy)).toBe("30 a 45 dias");
    expect(healthRangeNote("EXCESS", policy)).toBe("Acima de 60 dias");
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
