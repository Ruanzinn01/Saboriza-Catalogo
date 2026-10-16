import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), storage: { from: vi.fn() } } }));

import type { ApiResult, CommercialSummary, ReceivablesView } from "@/lib/customers-api";
import { OpenTitlesCard, PaymentHistoryCard, ProductsCard, PurchasesCard, RecentActivityCard, UnavailableCard } from "./CustomerDetailParts";

const receivables = (over: Partial<ReceivablesView> = {}): ApiResult<ReceivablesView> => ({
  state: "ready",
  data: {
    as_of: "2026-10-16", since: "2025-10-16", open: [], paid: [],
    summary: { paid_count: 0, on_time_count: 0, late_count: 0, on_time_percent: null },
    open_summary: { overdue_count: 0, overdue_amount: 0, oldest_days: 0, upcoming_count: 0, upcoming_amount: 0 },
    ...over,
  },
});

const commercial = (over: Partial<CommercialSummary> = {}): ApiResult<CommercialSummary> => ({
  state: "ready",
  data: {
    as_of: "2026-10-16", period: "six", from: "2026-05-01", total: 0, count: 0,
    series: [{ key: "2026-09", value: 0, count: 0 }, { key: "2026-10", value: 0, count: 0 }],
    last_order_at: null, last_billed_purchase: null, rank: { position: null, universe: 10, criterion: "dense_rank" }, products_total: 0, products: [],
    ...over,
  },
});

const html = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);

describe("histórico de pagamentos", () => {
  it("sem permissão mostra restrito, nunca zero nem 100%", () => {
    const out = html(createElement(PaymentHistoryCard, { receivables: { state: "unavailable" }, filter: "all", onFilter: () => {} }));
    expect(out).toContain("Restrito ao seu perfil");
    expect(out).not.toContain("100%");
  });

  it("sem pagamentos quitados não inventa percentual", () => {
    const out = html(createElement(PaymentHistoryCard, { receivables: receivables(), filter: "all", onFilter: () => {} }));
    expect(out).toContain("Sem histórico de títulos quitados");
    expect(out).toContain("—");
    expect(out).not.toContain("100%");
  });

  it("lista pagamento em atraso com a data efetiva", () => {
    const out = html(createElement(PaymentHistoryCard, {
      receivables: receivables({
        paid: [{ id: "abcdef123456", order_number: "#298", amount: 100, due_date: "2026-09-01", paid_date: "2026-09-05", days_late: 4, on_time: false, method: "BOLETO" }],
        summary: { paid_count: 1, on_time_count: 0, late_count: 1, on_time_percent: 0 },
      }),
      filter: "all", onFilter: () => {},
    }));
    expect(out).toContain("Pedido #298");
    expect(out).toContain("4 dias de atraso");
    expect(out).toContain("Pago em 05/09/2026");
  });
});

describe("títulos em aberto", () => {
  it("é consulta: nenhum botão de pagar/baixar (PRD §6)", () => {
    const out = html(createElement(OpenTitlesCard, {
      receivables: receivables({
        open: [{ id: "t1", order_number: "#1", amount: 1000, balance: 600, partial: true, due_date: "2026-10-06", days_late: 10, overdue: true, method: "BOLETO" }],
        open_summary: { overdue_count: 1, overdue_amount: 600, oldest_days: 10, upcoming_count: 0, upcoming_amount: 0 },
      }),
    }));
    expect(out).toContain("10 dias de atraso");
    expect(out).toContain("pago em parte");
    expect(out).not.toMatch(/Pagar|Baixar|Quitar agora/);
    expect(out).toContain("nunca nesta ficha");
  });

  it("falha de leitura aparece como erro, não como 'sem títulos'", () => {
    const out = html(createElement(OpenTitlesCard, { receivables: { state: "error", message: "falhou" } }));
    expect(out).toContain("Não foi possível carregar os títulos: falhou");
    expect(out).not.toContain("Nenhum título em aberto");
  });
});

describe("compras e produtos", () => {
  it("meses sem compra aparecem zerados e o ranking sem posição não inventa lugar", () => {
    const out = html(createElement(PurchasesCard, { summary: commercial(), period: "six", onPeriod: () => {}, ordersOfMonth: () => [] }));
    expect(out).toContain("set/26: R$");
    expect(out).toContain("0 compra(s)");
    expect(out).toContain("Sem posição no período");
    expect(out).toContain("Devoluções ainda não entram");
  });

  it("produto sem foto usa placeholder identificado", () => {
    const out = html(createElement(ProductsCard, {
      summary: commercial({ products_total: 1, products: [{ position: 1, product_id: null, name: "Colorau", value: 50, units: 5, image_url: null, share: 100 }] }),
      onMore: () => {}, loadingMore: false,
    }));
    expect(out).toContain("Sem foto cadastrada");
    expect(out).toContain("1º MAIS COMPRADO");
  });

  it("'ver mais' só aparece quando há produtos além dos carregados", () => {
    const p = { position: 1, product_id: null, name: "A", value: 1, units: 1, image_url: null, share: 50 };
    expect(html(createElement(ProductsCard, { summary: commercial({ products_total: 2, products: [p] }), onMore: () => {}, loadingMore: false }))).toContain("Ver mais produtos");
    expect(html(createElement(ProductsCard, { summary: commercial({ products_total: 1, products: [p] }), onMore: () => {}, loadingMore: false }))).not.toContain("Ver mais produtos");
  });
});

describe("blocos sem fonte oficial", () => {
  it("visitas e tarefas aparecem como indisponíveis, sem número", () => {
    const out = html(createElement(RecentActivityCard, { summary: commercial() }));
    expect(out).toContain("Indisponível");
    expect(out).toContain("Sem registro");
    const card = html(createElement(UnavailableCard, { title: "Cumprimento dos roteiros", children: "sem fonte" }));
    expect(card).toContain("Indisponível");
    expect(card).not.toContain("%");
  });
});
