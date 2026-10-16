import { describe, expect, it } from "vitest";
import type { PaidTitle, ReceivablesView } from "@/lib/customers-api";
import {
  addressLines,
  buildBars,
  customerMapUrl,
  filterPaid,
  methodLabel,
  onTimePercentLabel,
  openBadge,
  paidBadge,
  rankLabel,
  seriesLabel,
  titleRowLabel,
  whatsappUrl,
} from "./customer-detail";

const paid = (id: string, daysLate: number): PaidTitle => ({
  id, order_number: null, amount: 10, due_date: "2026-09-01", paid_date: "2026-09-02", days_late: daysLate, on_time: daysLate === 0, method: "BOLETO",
});

describe("compras ao longo do período", () => {
  it("meses sem compra continuam na série com altura zero", () => {
    const bars = buildBars([
      { key: "2026-08", value: 0, count: 0 },
      { key: "2026-09", value: 200, count: 2 },
      { key: "2026-10", value: 100, count: 1 },
    ]);
    expect(bars.map((b) => b.heightPercent)).toEqual([0, 100, 50]);
    expect(bars[0].label).toBe("ago/26");
    expect(seriesLabel("2026-10-05")).toBe("05");
  });

  it("série toda zerada não divide por zero", () => {
    expect(buildBars([{ key: "2026-10", value: 0, count: 0 }])[0].heightPercent).toBe(0);
  });

  it("ranking sem posição não inventa lugar", () => {
    expect(rankLabel({ position: null, universe: 0, criterion: "" })).toBe("Sem posição no período");
    expect(rankLabel({ position: 34, universe: 186, criterion: "" })).toBe("34º lugar");
  });
});

describe("pagamentos e títulos", () => {
  it("filtra em dia e com atraso; antecipado conta como em dia", () => {
    const list = [paid("a", 0), paid("b", 4), paid("c", 0)];
    expect(filterPaid(list, "ontime").map((p) => p.id)).toEqual(["a", "c"]);
    expect(filterPaid(list, "late").map((p) => p.id)).toEqual(["b"]);
    expect(filterPaid(list, "all")).toHaveLength(3);
  });

  it("rótulos de atraso", () => {
    expect(paidBadge(paid("a", 0))).toBe("Pago em dia");
    expect(paidBadge(paid("a", 1))).toBe("1 dia de atraso");
    expect(openBadge({ overdue: true, days_late: 10 })).toBe("10 dias de atraso");
    expect(openBadge({ overdue: false, days_late: 0 })).toBe("A vencer");
  });

  it("sem histórico o percentual é traço, nunca 100%", () => {
    const empty: ReceivablesView["summary"] = { paid_count: 0, on_time_count: 0, late_count: 0, on_time_percent: null };
    expect(onTimePercentLabel(empty)).toBe("—");
    expect(onTimePercentLabel({ ...empty, paid_count: 2, on_time_count: 1, late_count: 1, on_time_percent: 50 })).toBe("50%");
  });

  it("não chama todo recebível de boleto: usa o meio real", () => {
    expect(methodLabel("BOLETO")).toBe("Boleto");
    expect(methodLabel("PIX")).toBe("Pix");
    expect(methodLabel(null)).toBe("Título");
    expect(titleRowLabel({ order_number: "#298", id: "abcdef123456" })).toBe("Pedido #298");
    expect(titleRowLabel({ order_number: null, id: "abcdef123456" })).toBe("Título abcdef12");
  });
});

describe("contato e endereço", () => {
  it("WhatsApp só com telefone completo e prefixo do país", () => {
    expect(whatsappUrl("(94) 99138-5788")).toBe("https://wa.me/5594991385788");
    expect(whatsappUrl("5594991385788")).toBe("https://wa.me/5594991385788");
    expect(whatsappUrl("9138")).toBeNull();
  });

  it("endereço compacto com número, complemento e CEP", () => {
    expect(addressLines({ address: "Avenida Castanheira", address_number: "S/N", address_complement: "Qd. 33", neighborhood: "Park Carajás", city: "Canaã dos Carajás", state: "PA", cep: "68537000" })).toEqual([
      "Avenida Castanheira, S/N · Qd. 33",
      "Park Carajás · Canaã dos Carajás/PA",
      "CEP 68537-000",
    ]);
  });

  it("mapa usa o ponto informado; sem ponto busca o endereço e avisa que não é confirmado", () => {
    expect(customerMapUrl({ latitude: -6.5, longitude: -49.8, address: "x", address_number: "1", city: "c", state: "PA" })).toEqual({
      url: "https://www.google.com/maps/search/?api=1&query=-6.5%2C-49.8",
      confirmed: true,
    });
    const approx = customerMapUrl({ latitude: null, longitude: null, address: "Rua A", address_number: "2", city: "Salvador", state: "BA" });
    expect(approx.confirmed).toBe(false);
    expect(approx.url).toContain("Rua%20A");
    expect(customerMapUrl({ latitude: null, longitude: null, address: "", address_number: "", city: "", state: "" }).url).toBeNull();
  });
});
