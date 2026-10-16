import { describe, expect, it } from "vitest";
import { buildSuppliersCsv, csvCell, type SupplierExportRow } from "@/lib/supplier-csv";

const row = (over: Partial<SupplierExportRow> = {}): SupplierExportRow => ({
  id: "1",
  trade_name: "Norte",
  company_name: "Norte Ltda",
  document: "11.222.333/0001-81",
  person_type: "PJ",
  active: true,
  city: "Salvador",
  state: "BA",
  contact: "Ana",
  phone: "71",
  email: "a@b.com",
  buyer: "Carlos",
  supply_type: "Embalagens",
  categories: "Embalagens | Aluguéis",
  ...over,
});

describe("csvCell", () => {
  it("protege contra conteúdo de fórmula", () => {
    for (const bad of ["=1+1", "+cmd", "-2", "@SOMA(A1)", "\tx", "\rx"]) expect(csvCell(bad)).toBe(`"'${bad}"`);
  });
  it("escapa aspas e preserva texto normal", () => {
    expect(csvCell('Fábrica "Sol"')).toBe('"Fábrica ""Sol"""');
    expect(csvCell("Texto normal")).toBe('"Texto normal"');
    expect(csvCell(null)).toBe('""');
  });
});

describe("buildSuppliersCsv", () => {
  const ctx = { scope: "Conjunto filtrado", exportedOn: "16/10/2026" };
  it("começa com BOM, usa ; e CRLF e traz escopo e data", () => {
    const csv = buildSuppliersCsv([row()], undefined, ctx);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toContain("Escopo: Conjunto filtrado");
    expect(lines[0]).toContain("Exportado em: 16/10/2026");
    expect(lines[1].split(";")[0]).toBe('"Fornecedor"');
    expect(lines).toHaveLength(3);
  });
  it("sem permissão financeira o arquivo NÃO tem colunas de valores", () => {
    const csv = buildSuppliersCsv([row()], undefined, ctx);
    expect(csv).not.toMatch(/Comprado no período|Pago no período|Saldo em aberto/);
  });
  it("com financeiro acrescenta comprado, pago e saldo em reais", () => {
    const csv = buildSuppliersCsv([row()], new Map([["1", { purchasedCents: 123456, paidCents: 1000, openCents: 0 }]]), { ...ctx, periodLabel: "Últimos 12 meses" });
    expect(csv).toContain('"1234.56";"10.00";"0.00"');
    expect(csv).toContain("Período: Últimos 12 meses");
  });
  it("célula maliciosa vinda do cadastro é neutralizada", () => {
    const csv = buildSuppliersCsv([row({ trade_name: "=HYPERLINK(\"http://x\")" })], undefined, ctx);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
  it("não inclui banco/Pix", () => {
    expect(buildSuppliersCsv([row()], undefined, ctx)).not.toMatch(/\bpix\b|conta e dígito|ag[êe]ncia|favorecido/i);
  });
});
