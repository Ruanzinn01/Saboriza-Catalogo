import { describe, expect, it, vi } from "vitest";

const listIbgeCitiesByState = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/ibge", () => ({ listIbgeCitiesByState: (...a: unknown[]) => listIbgeCitiesByState(...a) }));

import { supplierFromRow } from "@/lib/mappers/supplier-mapper";
import { filterSuppliers, sortSuppliers } from "@/lib/supplier-search";
import { findMunicipality, searchMunicipalities } from "@/lib/supplier-municipios";
import type { Supplier, SupplierCategory } from "@/types/supplier";

function make(id: string, over: Partial<Supplier> = {}): Supplier {
  return {
    ...supplierFromRow({
      id, name: "Contato " + id, company_name: "Empresa " + id, phone: "1", trade_name: "", cnpj: "", ie: "", email: "", address: "", neighborhood: "", cep: "", city: "Salvador", state: "BA", created_at: "", updated_at: "",
    }),
    ...over,
  };
}

const none = new Map<string, SupplierCategory>();

describe("filtros novos da lista", () => {
  const list = [make("a", { buyerName: "Ana", active: true }), make("b", { buyerName: "Carlos", active: false }), make("c", { buyerName: "ana", active: true })];
  const run = (filters: Partial<Parameters<typeof filterSuppliers>[3]>) => filterSuppliers(list, new Map(), none, { query: "", categoryIds: [], city: "", ...filters }).map((s) => s.id);

  it("comprador ignora caixa e acento", () => {
    expect(run({ buyer: "ANA" })).toEqual(["a", "c"]);
  });
  it("situação cadastral: ativos, inativos e todos", () => {
    expect(run({ status: "active" })).toEqual(["a", "c"]);
    expect(run({ status: "inactive" })).toEqual(["b"]);
    expect(run({ status: "all" })).toEqual(["a", "b", "c"]);
    expect(run({})).toEqual(["a", "b", "c"]);
  });
  it("sem filtro de categoria inclui fornecedores sem categoria", () => {
    expect(run({})).toHaveLength(3);
  });
  it("a busca encontra pelo comprador", () => {
    expect(run({ query: "carlos" })).toEqual(["b"]);
  });
});

describe("ordenação", () => {
  const items = [make("a", { tradeName: "Zeta" }), make("b", { tradeName: "Alfa" }), make("c", { tradeName: "Beta" })];
  it("por nome usa o nome de exibição em pt-BR", () => {
    expect(sortSuppliers(items, "name", () => undefined).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });
  it("por valor comprado e por saldo; empate cai para o nome; sem fonte cai para o nome", () => {
    const metrics: Record<string, { value: number; debt: number }> = { a: { value: 10, debt: 0 }, b: { value: 10, debt: 5 }, c: { value: 50, debt: 5 } };
    expect(sortSuppliers(items, "value", (id) => metrics[id]).map((s) => s.id)).toEqual(["c", "b", "a"]);
    expect(sortSuppliers(items, "debt", (id) => metrics[id]).map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(sortSuppliers(items, "value", () => undefined).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });
});

describe("municípios do catálogo oficial do projeto", () => {
  it("só consulta com UF válida e descarta códigos fora de 7 dígitos", async () => {
    listIbgeCitiesByState.mockResolvedValue([
      { code: "2927408", name: "Salvador", stateCode: "BA", stateName: "Bahia" },
      { code: "12", name: "Inválido", stateCode: "BA", stateName: "Bahia" },
    ]);
    expect(await searchMunicipalities("", "sal")).toEqual([]);
    expect(listIbgeCitiesByState).not.toHaveBeenCalled();
    expect(await searchMunicipalities("BA", "sal")).toEqual([{ name: "Salvador", code: "2927408" }]);
    expect(listIbgeCitiesByState).toHaveBeenCalledWith("BA", "sal");
  });
  it("casa o nome sem acento e sem caixa, só por igualdade exata", () => {
    const list = [{ name: "Canaã dos Carajás", code: "1502152" }, { name: "Salvador", code: "2927408" }];
    expect(findMunicipality(list, "canaa dos carajas")?.code).toBe("1502152");
    expect(findMunicipality(list, "Salvad")).toBeNull();
    expect(findMunicipality(list, "")).toBeNull();
  });
});
