import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { estornarAporte, estornarRecebimento, financeiroErrorMessage, newCommandId, pagarDespesa, receberReceita, registrarAporte } from "./financeiro-rpcs";

beforeEach(() => rpc.mockReset());

describe("financeiro-rpcs", () => {
  it("pagarDespesa envia command_id e separa o flag replayed do resultado", async () => {
    rpc.mockResolvedValue({ data: { expense_id: "e1", status: "PAGO", paid_amount: 10, balance: 0, replayed: true }, error: null });
    const r = await pagarDespesa("c1", "e1", 10);
    expect(rpc).toHaveBeenCalledWith("financeiro_pagar_despesa", { p_command_id: "c1", p_expense_id: "e1", p_amount: 10 });
    expect(r).toEqual({ data: { expense_id: "e1", status: "PAGO", paid_amount: 10, balance: 0 }, error: null, replayed: true });
  });

  it("receberReceita usa data efetiva nula por padrão", async () => {
    rpc.mockResolvedValue({ data: { receipt_id: "r1", receivable_id: "t1", status: "ABERTO", open_balance: 5, replayed: false }, error: null });
    const r = await receberReceita("c2", "t1", 5);
    expect(rpc).toHaveBeenCalledWith("financeiro_receber_receita", { p_command_id: "c2", p_receivable_id: "t1", p_amount: 5, p_effective_date: null });
    expect(r.replayed).toBe(false);
  });

  it("estorno repetido volta com mensagem amigável e sem dados", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "ESTORNO_JA_REALIZADO: recebimento já estornado" } });
    const r = await estornarRecebimento("c3", "r1");
    expect(r).toEqual({ data: null, error: "Este lançamento já foi estornado.", replayed: false });
  });

  it("registrarAporte e estornarAporte mapeiam os parâmetros", async () => {
    rpc.mockResolvedValue({ data: { contribution_id: "a1", status: "REALIZADO", replayed: false }, error: null });
    await registrarAporte("c4", { partnerId: "p1", amount: 100, status: "REALIZADO", origin: "PIX" });
    expect(rpc).toHaveBeenLastCalledWith("financeiro_registrar_aporte", {
      p_command_id: "c4", p_partner_id: "p1", p_amount: 100, p_status: "REALIZADO", p_origin: "PIX",
      p_planned_date: null, p_realized_date: null, p_notes: null, p_expense_id: null,
    });
    rpc.mockResolvedValue({ data: { reversal_id: "x", contribution_id: "a1", replayed: false }, error: null });
    await estornarAporte("c5", "a1", "erro");
    expect(rpc).toHaveBeenLastCalledWith("financeiro_estornar_aporte", { p_command_id: "c5", p_contribution_id: "a1", p_reason: "erro" });
  });

  it("gera command_id único e preserva mensagens desconhecidas", () => {
    expect(newCommandId()).not.toBe(newCommandId());
    expect(financeiroErrorMessage("Pagamento excede o saldo da despesa")).toBe("Pagamento excede o saldo da despesa");
  });
});
