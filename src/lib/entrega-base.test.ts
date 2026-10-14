import { describe, expect, it } from "vitest";
import { ADMIN_ENTREGA_BASE, OPERATOR_ENTREGA_BASE, entregaBaseFor } from "./entrega-base";

describe("entrega-base", () => {
  it("rotas operacionais usam a base do app isolado", () => {
    expect(entregaBaseFor("/operacao/entrega-registra")).toBe(OPERATOR_ENTREGA_BASE);
    expect(entregaBaseFor("/operacao/entrega-registra/entregar/1")).toBe(OPERATOR_ENTREGA_BASE);
  });
  it("rotas administrativas mantêm a base atual", () => {
    expect(entregaBaseFor("/admin/carrega-entrega")).toBe(ADMIN_ENTREGA_BASE);
    expect(entregaBaseFor("/admin/carrega-entrega/carregar/1")).toBe(ADMIN_ENTREGA_BASE);
  });
});
