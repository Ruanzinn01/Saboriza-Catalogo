import { describe, expect, it } from "vitest";
import { isMissingFunctionError, isNewInQueue, parseSnapshot } from "@/lib/separation-snapshot";

describe("parseSnapshot", () => {
  it("rejeita resposta sem a lista de pedidos", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({})).toBeNull();
    expect(parseSnapshot("x")).toBeNull();
  });

  it("normaliza listas ausentes e campos de produto nulos", () => {
    const snapshot = parseSnapshot({ orders: [{ id: "o1" }], products: [{ id: "p1", image_url: null, code: null, gtin: null }] });
    expect(snapshot?.orders).toHaveLength(1);
    expect(snapshot?.items).toEqual([]);
    expect(snapshot?.adjustments).toEqual([]);
    expect(snapshot?.products[0]).toMatchObject({ image_url: "", gtin: "" });
  });
});

describe("isMissingFunctionError", () => {
  it("reconhece função ausente no banco", () => {
    expect(isMissingFunctionError("Could not find the function public.separation_snapshot(p_company_id) in the schema cache")).toBe(true);
    expect(isMissingFunctionError("PGRST202")).toBe(true);
  });

  it("não confunde erro de autorização com função ausente", () => {
    expect(isMissingFunctionError("Sem acesso a este app")).toBe(false);
    expect(isMissingFunctionError("Empresa não encontrada")).toBe(false);
  });
});

describe("isNewInQueue", () => {
  const known = new Set(["a"]);

  it("alerta só para pedido confirmado, em aberto e desconhecido", () => {
    expect(isNewInQueue({ order_id: "b", status: "CONFIRMED", separation_finished: false }, known)).toBe(true);
  });

  it("não alerta em atualização de pedido já conhecido, concluído ou de outro status", () => {
    expect(isNewInQueue({ order_id: "a", status: "CONFIRMED", separation_finished: false }, known)).toBe(false);
    expect(isNewInQueue({ order_id: "b", status: "CONFIRMED", separation_finished: true }, known)).toBe(false);
    expect(isNewInQueue({ order_id: "b", status: "NEW", separation_finished: false }, known)).toBe(false);
  });
});
