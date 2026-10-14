import { describe, expect, it } from "vitest";
import { buildReportCsv, buildReportHtml, escapeHtml, reportTotals } from "@/lib/estoque-report";
import type { ReportData, ReportItem } from "@/types/estoque";

const item = (overrides: Partial<ReportItem> = {}): ReportItem => ({
  item_type: "PRODUCT",
  sku: "PRD-1",
  name: "Tempero <b>X</b>",
  category: "",
  base_unit: "unidade",
  physical: 10,
  reserved: 2,
  available: 8,
  incoming: 0,
  in_production: 0,
  unit_cost: 5,
  stock_value: 50,
  coverage_days: 12.34,
  net_need: null,
  health: "HEALTHY",
  ...overrides,
});

const data = (items: ReportItem[]): ReportData => ({
  title: "Relatório de teste",
  company: "Empresa",
  unit: "Matriz",
  periodLabel: "10/2026",
  generatedAt: "14/10/2026 10:00",
  closed: false,
  items,
  movements: [{ type: "PURCHASE_ENTRY", count: 2, quantity: 30 }],
  inventory: [{ items: 10, counted: 8, divergences: 2 }],
  losses: { count: 1, total_cost: 10, unknown_cost: 0, awaiting_returns: 3 },
  policy: null,
});

describe("escapeHtml", () => {
  it("neutraliza marcação vinda de nomes cadastrados", () => {
    expect(escapeHtml('<script>"x"&')).toBe("&lt;script&gt;&quot;x&quot;&amp;");
  });
});

describe("buildReportHtml", () => {
  it("escapa o nome do item e informa contexto, política e custo ausente", () => {
    const html = buildReportHtml(data([item(), item({ sku: "PRD-2", name: "Sem custo", unit_cost: null, stock_value: null })]));
    expect(html).not.toContain("<b>X</b>");
    expect(html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("padrão do sistema (30/45/60 dias)");
    expect(html).toContain("Sem custo");
    expect(html).toContain("1 com saldo e sem custo conhecido");
    expect(html).toContain("posição parcial");
  });

  it("separa contagem realizada de acuracidade e calcula 75%", () => {
    expect(buildReportHtml(data([item()]))).toContain("acuracidade: 75%");
  });
});

describe("reportTotals", () => {
  it("não soma custo desconhecido como zero silencioso", () => {
    expect(reportTotals([item(), item({ stock_value: null })])).toEqual({ value: 50, withoutCost: 1 });
  });
});

describe("buildReportCsv", () => {
  it("usa BOM, ponto e vírgula e protege aspas", () => {
    const csv = buildReportCsv([item({ name: 'Item "A"' })]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Item ""A"""');
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain('"12.3"');
  });
});
