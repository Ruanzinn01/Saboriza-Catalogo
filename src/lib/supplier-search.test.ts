import { describe, expect, it } from "vitest";
import { supplierFromRow } from "@/lib/mappers/supplier-mapper";
import type { Supplier, SupplierCategory } from "@/types/supplier";
import {
  daysSince,
  diffIds,
  filterSuppliers,
  hasValidDocumentFormat,
  normalizeDocument,
  normalizeSearchText,
  paginate,
  parseProductLabels,
} from "@/lib/supplier-search";

function supplier(id: string, overrides: Partial<Supplier> = {}): Supplier {
  return {
    ...supplierFromRow({
      id,
      name: "Contato",
      company_name: "Empresa " + id,
      phone: "7199999",
      trade_name: "",
      cnpj: "",
      ie: "",
      email: "",
      address: "",
      neighborhood: "",
      cep: "",
      city: "Salvador",
      state: "BA",
      created_at: "",
      updated_at: "",
    }),
    ...overrides,
  };
}

const categories = new Map<string, SupplierCategory>([
  ["c1", { id: "c1", name: "Imóveis e aluguéis", active: true }],
  ["c2", { id: "c2", name: "Embalagens", active: false }],
]);

describe("normalização", () => {
  it("ignora caixa, acentos e espaços repetidos", () => {
    expect(normalizeSearchText("  Imóveis   E ALUGUÉIS ")).toBe("imoveis e alugueis");
  });

  it("preserva letras e zeros do documento", () => {
    expect(normalizeDocument("12.ABC.345/0001-09")).toBe("12ABC345000109");
    expect(normalizeDocument("00.000.000/0001-00")).toBe("00000000000100");
  });

  it("confere só o formato de CPF, CNPJ numérico e alfanumérico; vazio é válido", () => {
    expect(hasValidDocumentFormat("")).toBe(true);
    expect(hasValidDocumentFormat("123.456.789-09")).toBe(true);
    expect(hasValidDocumentFormat("12.ABC.345/01DE-35")).toBe(true);
    expect(hasValidDocumentFormat("12.ABC.345/01DE-3X")).toBe(false);
    expect(hasValidDocumentFormat("123")).toBe(false);
  });
});

describe("filtro de fornecedores", () => {
  const list = [
    supplier("a", { tradeName: "Norte Alimentos", cnpj: "11.222.333/0001-81" }),
    supplier("b", { companyName: "Locadora Beta", city: "Lauro de Freitas" }),
    supplier("c"),
  ];
  const links = new Map([
    ["a", ["c2"]],
    ["b", ["c1"]],
  ]);
  const base = { query: "", categoryIds: [] as string[], city: "" };

  it("sem filtro de categoria inclui todos, inclusive os não classificados", () => {
    expect(filterSuppliers(list, links, categories, base).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("filtra por categoria somente quando escolhida", () => {
    expect(filterSuppliers(list, links, categories, { ...base, categoryIds: ["c1"] }).map((s) => s.id)).toEqual(["b"]);
  });

  it("a busca encontra por nome da categoria (sem acento) e por documento", () => {
    expect(filterSuppliers(list, links, categories, { ...base, query: "alugueis" }).map((s) => s.id)).toEqual(["b"]);
    expect(filterSuppliers(list, links, categories, { ...base, query: "11222333" }).map((s) => s.id)).toEqual(["a"]);
  });

  it("filtra por cidade ignorando acento e caixa", () => {
    expect(filterSuppliers(list, links, categories, { ...base, city: "lauro de freitas" }).map((s) => s.id)).toEqual(["b"]);
  });
});

describe("apoio", () => {
  it("pagina com página segura", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 3, 10).rows).toHaveLength(5);
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate([], 1, 10).totalPages).toBe(1);
  });

  it("diff de categorias envia só o que mudou", () => {
    expect(diffIds(["a", "b"], ["b", "c"])).toEqual({ add: ["c"], remove: ["a"] });
    expect(diffIds([], [])).toEqual({ add: [], remove: [] });
  });

  it("separa produtos declarados sem duplicar", () => {
    expect(parseProductLabels("Farinha, granola; Palmito\nfarinha ,  ")).toEqual(["Farinha", "granola", "Palmito"]);
  });

  it("conta dias desde o primeiro registro", () => {
    expect(daysSince("2026-10-10T00:00:00Z", new Date("2026-10-15T12:00:00Z"))).toBe(5);
    expect(daysSince("invalido")).toBe(0);
  });
});
