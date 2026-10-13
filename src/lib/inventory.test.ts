import { describe, expect, it } from "vitest";
import { matchesFilter, matchesQuery, percent } from "@/lib/inventory";
import type { InventoryItem, InventoryState } from "@/types/inventory";

function item(state: InventoryState, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "1",
    itemType: "PRODUCT",
    itemId: "p1",
    groupNo: 1,
    name: "Tempero Açafrão",
    presentation: "Pote 100g",
    kindLabel: "Produto",
    sku: "TMP-001",
    imageUrl: "",
    baseUnit: "unidade",
    packLabel: null,
    state,
    ...overrides,
  };
}

describe("matchesFilter", () => {
  it("Contados inclui itens com divergência", () => {
    expect(matchesFilter(item("COUNTED"), "contados")).toBe(true);
    expect(matchesFilter(item("DIVERGENCE"), "contados")).toBe(true);
    expect(matchesFilter(item("PENDING"), "contados")).toBe(false);
  });

  it("Divergências é subconjunto de Contados", () => {
    expect(matchesFilter(item("DIVERGENCE"), "divergencias")).toBe(true);
    expect(matchesFilter(item("COUNTED"), "divergencias")).toBe(false);
  });

  it("Pendentes só mostra itens sem primeira contagem", () => {
    expect(matchesFilter(item("PENDING"), "pendentes")).toBe(true);
    expect(matchesFilter(item("RECOUNT"), "pendentes")).toBe(false);
    expect(matchesFilter(item("RECOUNT"), "recontagem")).toBe(true);
  });
});

describe("matchesQuery", () => {
  it("ignora acento e caixa em nome, apresentação e SKU", () => {
    expect(matchesQuery(item("PENDING"), "acafrao")).toBe(true);
    expect(matchesQuery(item("PENDING"), "POTE")).toBe(true);
    expect(matchesQuery(item("PENDING"), "tmp-001")).toBe(true);
    expect(matchesQuery(item("PENDING"), "pimenta")).toBe(false);
  });
});

describe("percent", () => {
  it("exemplo do adendo: 62 de 86 realizados", () => {
    expect(percent(62, 86)).toBe(72);
  });

  it("sem itens previstos não divide por zero", () => {
    expect(percent(0, 0)).toBe(0);
  });
});
