import { describe, expect, it } from "vitest";
import { lookupItemByCode, matchesFilter, matchesQuery, percent } from "@/lib/inventory";
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
    barcode: "7891234567895",
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

describe("lookupItemByCode", () => {
  const items = [
    item("PENDING", { id: "a", barcode: "7891234567895", sku: "TMP-001" }),
    item("PENDING", { id: "b", barcode: "", sku: "MP-002" }),
    item("COUNTED", { id: "c", barcode: "0012345678905", sku: "TMP-003" }),
  ];

  it("ignora leitura vazia", () => {
    expect(lookupItemByCode(items, "   ")).toEqual({ kind: "empty" });
  });

  it("localiza item único por código de barras ou SKU", () => {
    expect(lookupItemByCode(items, "7891234567895")).toMatchObject({ kind: "single", item: { id: "a" } });
    expect(lookupItemByCode(items, "mp-002")).toMatchObject({ kind: "single", item: { id: "b" } });
  });

  it("trata zeros à esquerda (EAN/UPC) como o mesmo código", () => {
    expect(lookupItemByCode(items, "12345678905")).toMatchObject({ kind: "single", item: { id: "c" } });
  });

  it("código fora da sessão não abre nenhum item", () => {
    expect(lookupItemByCode(items, "999")).toEqual({ kind: "none" });
  });

  it("código ligado a mais de um item exige escolha, nunca sorteia", () => {
    const duplicated = [...items, item("PENDING", { id: "d", barcode: "7891234567895", sku: "TMP-004" })];
    const result = lookupItemByCode(duplicated, "7891234567895");
    expect(result.kind).toBe("multiple");
    if (result.kind === "multiple") expect(result.items.map((row) => row.id)).toEqual(["a", "d"]);
  });
});
