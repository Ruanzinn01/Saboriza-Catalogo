import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import type { CustomerListItem } from "@/lib/customers-api";
import {
  activeFilterTags,
  buildCustomersCsv,
  clearedFilters,
  DEFAULT_FILTERS,
  documentKind,
  formatAge,
  formatCustomerNumber,
  formatDocument,
  hasActiveFilters,
  pageWindow,
  parseListFilters,
  serializeListFilters,
} from "./customers-list";

const item: CustomerListItem = {
  id: "1", display_number: 34, trade_name: "Tio Óris", legal_name: "Óris Ltda", contact_name: "Óris", document: "12ABC34501DE35", person_type: "PJ",
  phone: "9", city: "Canaã dos Carajás", state: "PA", registration_status: "ATIVO", revision: 1, has_location: true, photo_count: 0,
  category: "active", last_purchase: "2026-10-01", seller: { id: "s", name: "Raimundo" }, promoter: null, open_balance: 10, overdue_balance: 5, overdue_count: 1,
};

describe("filtros da lista na URL", () => {
  it("padrões não poluem a URL e o ciclo parse/serialize é estável", () => {
    expect(serializeListFilters(DEFAULT_FILTERS).toString()).toBe("");
    const filters = { ...DEFAULT_FILTERS, search: "são joão", city: "Salvador", finance: "debt" as const, sort: "name" as const, page: 3, pageSize: 30 };
    expect(parseListFilters(serializeListFilters(filters))).toEqual(filters);
  });

  it("a opção de 5 por página foi removida: tamanho inválido volta para 10", () => {
    expect(parseListFilters(new URLSearchParams("tamanho=5")).pageSize).toBe(10);
    expect(parseListFilters(new URLSearchParams("tamanho=50")).pageSize).toBe(50);
  });

  it("valores inválidos na URL caem nos padrões (nada de página 0 ou segmento inventado)", () => {
    const parsed = parseListFilters(new URLSearchParams("pagina=0&segmento=xyz&ordem=visita&financeiro=zzz&uf=para"));
    expect(parsed).toMatchObject({ page: 1, category: "all", sort: "purchase", finance: "all", uf: "PA" });
  });

  it("limpar filtros preserva ordenação e tamanho da página, mas volta à página 1", () => {
    const cleared = clearedFilters({ ...DEFAULT_FILTERS, city: "X", sort: "debt", pageSize: 20, page: 4 });
    expect(cleared).toMatchObject({ city: "", sort: "debt", pageSize: 20, page: 1 });
    expect(hasActiveFilters(cleared)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, neighborhood: "  centro " })).toBe(true);
  });

  it("etiquetas de filtros ativos usam nome da pessoa", () => {
    const tags = activeFilterTags({ ...DEFAULT_FILTERS, sellerId: "s", finance: "debt", category: "old" }, { sellers: [{ id: "s", name: "Raimundo" }], promoters: [] });
    expect(tags).toEqual(["Vendedor: Raimundo", "Com títulos vencidos", "Sem comprar · antigo"]);
  });
});

describe("apresentação", () => {
  it("documento alfanumérico mantém letras; CPF/CNPJ pelo tipo", () => {
    expect(formatDocument("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(formatDocument("12345678909")).toBe("123.456.789-09");
    expect(documentKind(item)).toBe("CNPJ");
    expect(documentKind({ person_type: "PF", document: "12345678909" })).toBe("CPF");
  });

  it("número de exibição não é o UUID", () => {
    expect(formatCustomerNumber(34)).toBe("CLI-0034");
  });

  it("sem fato é 'Sem registro', nunca 'hoje'", () => {
    expect(formatAge(null, "2026-10-16")).toBe("Sem registro");
    expect(formatAge("2026-10-16", "2026-10-16")).toBe("Hoje");
    expect(formatAge("2026-10-15", "2026-10-16")).toBe("Há 1 dia");
    expect(formatAge("2026-09-16", "2026-10-16")).toBe("Há 30 dias");
    expect(formatAge("2026-10-20", "2026-10-16")).toBe("Sem registro");
  });

  it("janela de páginas com reticências", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
  });
});

describe("exportação CSV dos filtrados", () => {
  it("tem BOM, separador ; e neutraliza fórmulas", () => {
    const csv = buildCustomersCsv([{ ...item, trade_name: '=HYPERLINK("x")', legal_name: "A;B" }], true);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"A;B"');
    expect(csv.split("\r\n")[0]).toContain("Saldo vencido");
  });

  it("sem permissão financeira o arquivo não leva colunas de saldo", () => {
    const csv = buildCustomersCsv([item], false);
    expect(csv).not.toContain("Saldo");
  });
});
