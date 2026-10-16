import { describe, expect, it } from "vitest";
import {
  agoLabel,
  concentration,
  daysBetween,
  financeChip,
  type FinanceRow,
  formatBrl,
  formatDateBr,
  formatPercent,
  matchesFinanceFilter,
  monthLabel,
  periodRange,
  purchaseStateLabel,
  todayInZone,
} from "@/lib/supplier-finance";

const row = (over: Partial<FinanceRow> = {}): FinanceRow => ({
  supplier_id: "s",
  purchased_cents: 0,
  purchase_count: 0,
  last_purchase_on: null,
  paid_cents: 0,
  open_cents: 0,
  overdue_cents: 0,
  due_today_cents: 0,
  overdue_count: 0,
  rank: null,
  ...over,
});

describe("períodos (regra do pacote: meses incluem o atual parcial)", () => {
  it("mês, 3, 6 e 12 meses a partir da referência 14/10/2026", () => {
    expect(periodRange("month", "2026-10-14")).toEqual({ from: "2026-10-01", to: "2026-10-14" });
    expect(periodRange("three", "2026-10-14")).toEqual({ from: "2026-08-01", to: "2026-10-14" });
    expect(periodRange("six", "2026-10-14")).toEqual({ from: "2026-05-01", to: "2026-10-14" });
    expect(periodRange("year", "2026-10-14")).toEqual({ from: "2025-11-01", to: "2026-10-14" });
  });
  it("histórico completo não tem limites", () => {
    expect(periodRange("all", "2026-10-14")).toEqual({ from: null, to: null });
  });
  it("virada de ano", () => {
    expect(periodRange("three", "2026-01-31")).toEqual({ from: "2025-11-01", to: "2026-01-31" });
  });
  it("hoje no fuso da empresa, independente do fuso do navegador", () => {
    const instant = new Date("2026-10-15T02:30:00Z");
    expect(todayInZone("America/Sao_Paulo", instant)).toBe("2026-10-14");
    expect(todayInZone("UTC", instant)).toBe("2026-10-15");
  });
});

describe("formatação", () => {
  it("moeda, data e percentuais em pt-BR", () => {
    expect(formatBrl(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatDateBr("2026-10-14")).toBe("14/10/2026");
    expect(formatDateBr(null)).toBe("Não informado");
    expect(formatPercent(81.234)).toBe("81,2%");
    expect(monthLabel("2026-10")).toBe("out/26");
  });
  it("datas relativas", () => {
    expect(daysBetween("2026-10-01", "2026-10-14")).toBe(13);
    expect(agoLabel("2026-10-14", "2026-10-14")).toBe("Hoje");
    expect(agoLabel("2026-10-13", "2026-10-14")).toBe("Há 1 dia");
    expect(agoLabel("2026-10-04", "2026-10-14")).toBe("Há 10 dias");
    expect(agoLabel(null, "2026-10-14")).toBe("Sem registro");
  });
  it("rótulos de estado da compra", () => {
    expect(purchaseStateLabel("ABERTO")).toBe("Confirmada");
    expect(purchaseStateLabel("RASCUNHO")).toBe("Rascunho");
  });
});

describe("filtros e chips financeiros", () => {
  it("filtra por situação financeira", () => {
    const vencido = row({ open_cents: 100, overdue_cents: 50 });
    const aVencer = row({ open_cents: 100 });
    const quitado = row();
    expect(matchesFinanceFilter(vencido, "overdue")).toBe(true);
    expect(matchesFinanceFilter(aVencer, "overdue")).toBe(false);
    expect(matchesFinanceFilter(aVencer, "open")).toBe(true);
    expect(matchesFinanceFilter(quitado, "open")).toBe(false);
    expect(matchesFinanceFilter(quitado, "clear")).toBe(true);
    expect(matchesFinanceFilter(vencido, "clear")).toBe(false);
  });
  it("sem a fonte financeira o filtro não afirma nada (não esconde fornecedores)", () => {
    expect(matchesFinanceFilter(undefined, "clear")).toBe(true);
    expect(matchesFinanceFilter(undefined, "overdue")).toBe(true);
  });
  it("chip nunca diz 'Sem saldo' quando a fonte está indisponível", () => {
    expect(financeChip(undefined).label).toBe("Indisponível");
    expect(financeChip(row()).label).toBe("Sem saldo");
    expect(financeChip(row({ open_cents: 1 })).label).toBe("A vencer");
    expect(financeChip(row({ open_cents: 1, overdue_cents: 1 })).tone).toBe("red");
  });
});

describe("concentração das compras", () => {
  it("usa o total de TODOS os filtrados como denominador (não normaliza os 4 exibidos para 100%)", () => {
    const items = [
      { id: "a", cents: 50 },
      { id: "b", cents: 20 },
      { id: "c", cents: 10 },
      { id: "d", cents: 10 },
      { id: "e", cents: 10 },
    ];
    const top = concentration(items, 4);
    expect(top).toHaveLength(4);
    expect(top.reduce((sum, item) => sum + item.percent, 0)).toBeCloseTo(90);
    expect(top[0].percent).toBe(50);
  });
  it("desempata de forma estável e lida com total zero", () => {
    expect(concentration([{ id: "b", cents: 5 }, { id: "a", cents: 5 }]).map((x) => x.id)).toEqual(["a", "b"]);
    expect(concentration([{ id: "a", cents: 0 }])[0].percent).toBe(0);
  });
});
